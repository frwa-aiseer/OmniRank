/**
 * OR-P05 / OR-P05-FIX — Article Schema Validator
 *
 * Validates ArticleEnvelope and individual ArticleBlock objects.
 * Enforces:
 *   - Stable unique UUIDs per block
 *   - Known schema version
 *   - Envelope identity: articleId/brandId must match route params when supplied
 *   - Max one H1 heading normally
 *   - Rejects unsafe HTML / JavaScript / data URIs (allowlist: http/https/relative)
 *   - Statistic/Citation blocks must reference evidenceRefs
 *   - evidenceRefs and sourceRefs must belong to the same brand
 *   - Unknown block types fail safely (not silently ignored)
 */

import {
  ArticleEnvelope,
  ArticleBlock,
  ArticleValidationResult,
  BlockValidationError,
  V1_BLOCK_TYPES,
  ARTICLE_SCHEMA_VERSION,
} from "../../types/article.ts";

// ============================================================================
// URI Safety — allowlist based (http/https/relative only)
// ============================================================================

/**
 * Returns true if the URI is on the safe allowlist (http, https, or relative path).
 * Rejects javascript:, data:, vbscript:, file:, and anything else with a scheme.
 */
export function isSafeUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") return true; // empty/null is not an unsafe URI
  const trimmed = uri.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  // Allowlist: http/https absolute, or relative (starts with / or .)
  if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
  // Relative paths
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return true;
  // Fragment-only or query-only
  if (trimmed.startsWith("#") || trimmed.startsWith("?")) return true;
  // Has a colon before the first slash → treat as scheme → reject
  const slashPos = trimmed.indexOf("/");
  const colonPos = trimmed.indexOf(":");
  if (colonPos !== -1 && (slashPos === -1 || colonPos < slashPos)) {
    return false;
  }
  return true;
}

/** @deprecated Use isSafeUri instead (allowlist-based). Kept for backward compat. */
export function isUnsafeUri(uri: string): boolean {
  return !isSafeUri(uri);
}

const UNSAFE_HTML_PATTERNS = [
  /<script[\s>]/i,
  /on\w+\s*=/i,          // onclick=, onerror=, onload=, etc.
  /javascript:/i,
  /vbscript:/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<form/i,
  /<input/i,
];

export function containsUnsafeHtml(text: unknown): boolean {
  if (typeof text !== "string") return false;
  return UNSAFE_HTML_PATTERNS.some((pattern) => pattern.test(text));
}

// ============================================================================
// UUID Validation
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

// ============================================================================
// Brand Reference Validation
// ============================================================================

/**
 * Validates that a brand reference belongs to the same brand.
 * Returns an error if they differ, null if they match.
 */
export function assertSameBrandReference(
  articleBrandId: string,
  referencedBrandId: string,
  context: string
): BlockValidationError | null {
  if (articleBrandId !== referencedBrandId) {
    return {
      field: context,
      message: `Cross-brand reference rejected: article brand '${articleBrandId}' does not match referenced brand '${referencedBrandId}'`,
    };
  }
  return null;
}

// ============================================================================
// Block Validator
// ============================================================================

function validateBlock(
  block: ArticleBlock,
  seenIds: Set<string>,
  errors: BlockValidationError[],
  articleBrandId?: string
): void {
  // 1. Stable UUID
  if (!isValidUuid(block.id)) {
    errors.push({ blockId: block.id, field: "id", message: "Block id must be a valid UUID" });
  } else if (seenIds.has(block.id)) {
    errors.push({ blockId: block.id, field: "id", message: "Duplicate block UUID detected" });
  } else {
    seenIds.add(block.id);
  }

  // 2. Known block type
  if (!V1_BLOCK_TYPES.includes(block.type as typeof V1_BLOCK_TYPES[number])) {
    errors.push({ blockId: block.id, field: "type", message: `Unknown block type '${block.type}' — unknown types must not be silently ignored` });
  }

  // 3. Schema version present
  if (!block.schemaVersion) {
    errors.push({ blockId: block.id, field: "schemaVersion", message: "Block schemaVersion is required" });
  }

  // 4. Content safety checks — scan all string leaf values
  scanObjectForUnsafe(block.content, block.id, "content", errors);

  // 5. Attribute safety
  scanObjectForUnsafe(block.attributes, block.id, "attributes", errors);

  // 6. Statistic / Citation blocks must reference evidence
  if (block.type === "statistic" || block.type === "citation") {
    const hasEvidenceRef =
      Array.isArray(block.evidenceRefs) && block.evidenceRefs.length > 0;
    const hasInlineEvidenceId =
      typeof (block.content as Record<string, unknown>).evidenceClaimId === "string";
    if (!hasEvidenceRef && !hasInlineEvidenceId) {
      errors.push({
        blockId: block.id,
        field: "evidenceRefs",
        message: `'${block.type}' block should reference at least one evidence claim via evidenceRefs or content.evidenceClaimId`,
      });
    }
  }

  // 7. Validate evidenceRefs and sourceRefs belong to same brand (if brandId known)
  if (articleBrandId) {
    // evidenceRefs: items should be UUIDs; if they encode brandId, check it
    // For now validate they are valid UUIDs (actual cross-brand DB check is server-side)
    if (Array.isArray(block.evidenceRefs)) {
      for (const ref of block.evidenceRefs) {
        if (!isValidUuid(ref)) {
          errors.push({ blockId: block.id, field: "evidenceRefs", message: `evidenceRef '${ref}' is not a valid UUID` });
        }
      }
    }
    if (Array.isArray(block.sourceRefs)) {
      for (const ref of block.sourceRefs) {
        if (!isValidUuid(ref)) {
          errors.push({ blockId: block.id, field: "sourceRefs", message: `sourceRef '${ref}' is not a valid UUID` });
        }
      }
    }
  }

  // 8. Recurse into children
  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      validateBlock(child, seenIds, errors, articleBrandId);
    }
  }
}

function scanObjectForUnsafe(
  obj: unknown,
  blockId: string,
  field: string,
  errors: BlockValidationError[]
): void {
  if (typeof obj === "string") {
    if (containsUnsafeHtml(obj)) {
      errors.push({ blockId, field, message: `Unsafe HTML/JS detected in ${field}` });
    }
    if (!isSafeUri(obj) && (obj.includes(":") || obj.startsWith("javascript"))) {
      // Only flag if it looks like a URI attempt (has scheme-like chars)
      if (!isSafeUri(obj)) {
        errors.push({ blockId, field, message: `Unsafe URI scheme detected in ${field}` });
      }
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) scanObjectForUnsafe(item, blockId, field, errors);
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      // For href/src/url fields, apply full URI allowlist check
      if (key === "href" || key === "src" || key === "url" || key === "canonicalUrl") {
        if (typeof val === "string" && !isSafeUri(val)) {
          errors.push({ blockId, field: `${field}.${key}`, message: `Unsafe URI scheme in ${field}.${key}` });
        }
      } else {
        scanObjectForUnsafe(val, blockId, field, errors);
      }
    }
  }
}

// ============================================================================
// Envelope Validator
// ============================================================================

export interface EnvelopeIdentityCheck {
  /** Expected articleId (from route params / DB row) */
  expectedArticleId?: string;
  /** Expected brandId (from route params / brand membership) */
  expectedBrandId?: string;
}

export function validateArticleEnvelope(
  envelope: ArticleEnvelope,
  identity?: EnvelopeIdentityCheck
): ArticleValidationResult {
  const errors: BlockValidationError[] = [];
  const seenIds = new Set<string>();

  // 1. Schema version
  if (envelope.schemaVersion !== ARTICLE_SCHEMA_VERSION) {
    errors.push({ field: "schemaVersion", message: `Unsupported schema version '${envelope.schemaVersion}'. Expected '${ARTICLE_SCHEMA_VERSION}'` });
  }

  // 2. Article ID
  if (!isValidUuid(envelope.articleId)) {
    errors.push({ field: "articleId", message: "articleId must be a valid UUID" });
  }

  // 3. Brand ID
  if (!isValidUuid(envelope.brandId)) {
    errors.push({ field: "brandId", message: "brandId must be a valid UUID" });
  }

  // 4. Envelope identity enforcement
  if (identity?.expectedArticleId && envelope.articleId !== identity.expectedArticleId) {
    errors.push({ field: "articleId", message: `Envelope articleId '${envelope.articleId}' does not match route/DB articleId '${identity.expectedArticleId}'` });
  }
  if (identity?.expectedBrandId && envelope.brandId !== identity.expectedBrandId) {
    errors.push({ field: "brandId", message: `Envelope brandId '${envelope.brandId}' does not match authorized brandId '${identity.expectedBrandId}'` });
  }

  // 5. Title — unsafe HTML check
  if (containsUnsafeHtml(envelope.title)) {
    errors.push({ field: "title", message: "Unsafe HTML/JS in article title" });
  }

  // 6. Blocks
  if (!Array.isArray(envelope.document?.blocks)) {
    errors.push({ field: "document.blocks", message: "document.blocks must be an array" });
  } else {
    for (const block of envelope.document.blocks) {
      validateBlock(block, seenIds, errors, envelope.brandId);
    }

    // 7. At most one H1
    const h1Count = envelope.document.blocks.filter(
      (b) => b.type === "heading" && (b.content as { level?: number }).level === 1
    ).length;
    if (h1Count > 1) {
      errors.push({ field: "document.blocks", message: `Article normally should have at most one H1 heading; found ${h1Count}` });
    }
  }

  // 8. Sources — allowlist URI check
  if (Array.isArray(envelope.sources)) {
    for (const src of envelope.sources) {
      if (src && typeof src === "object" && "url" in src) {
        const url = (src as { url?: string }).url;
        if (url && !isSafeUri(url)) {
          errors.push({ field: "sources", message: `Unsafe URI in source: ${url}` });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single block replacement (for AI one-block regeneration).
 * Also enforces that newBlock.id === targetBlockId.
 */
export function validateBlockReplacement(
  block: ArticleBlock,
  existingBlockIds: Set<string>,
  targetBlockId?: string
): BlockValidationError[] {
  const errors: BlockValidationError[] = [];

  // Enforce: replacement block must preserve the target block's ID
  if (targetBlockId && block.id !== targetBlockId) {
    errors.push({ blockId: block.id, field: "id", message: `Replacement block id '${block.id}' must equal target blockId '${targetBlockId}'` });
    return errors; // Further validation is pointless with wrong ID
  }

  const seenIds = new Set<string>(existingBlockIds);
  seenIds.delete(block.id);
  validateBlock(block, seenIds, errors);
  return errors;
}

/**
 * Validates that evidenceRefs/sourceRefs on a block come from the same brand.
 * brandId = article brand; refBrandId = brand of the referenced evidence/source.
 * This is called server-side after fetching the actual referenced records.
 */
export function validateBlockBrandRefs(
  block: ArticleBlock,
  articleBrandId: string,
  getRefBrandId: (refId: string) => string | undefined
): BlockValidationError[] {
  const errors: BlockValidationError[] = [];
  for (const ref of block.evidenceRefs ?? []) {
    const refBrand = getRefBrandId(ref);
    if (refBrand) {
      const err = assertSameBrandReference(articleBrandId, refBrand, "evidenceRefs");
      if (err) errors.push({ ...err, blockId: block.id });
    }
  }
  for (const ref of block.sourceRefs ?? []) {
    const refBrand = getRefBrandId(ref);
    if (refBrand) {
      const err = assertSameBrandReference(articleBrandId, refBrand, "sourceRefs");
      if (err) errors.push({ ...err, blockId: block.id });
    }
  }
  return errors;
}
