/**
 * OR-P05 — Article Schema Validator
 *
 * Validates ArticleEnvelope and individual ArticleBlock objects.
 * Enforces:
 *   - Stable unique UUIDs per block
 *   - Known schema version
 *   - Max one H1 heading normally
 *   - Rejects unsafe HTML / JavaScript / data URIs
 *   - Statistic/Citation blocks must reference evidenceRefs
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
// URI Safety
// ============================================================================

const UNSAFE_URI_PREFIXES = ["javascript:", "vbscript:", "data:", "file:"];
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

export function isUnsafeUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") return false;
  const lower = uri.trim().toLowerCase();
  return UNSAFE_URI_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function containsUnsafeHtml(text: string): boolean {
  if (!uri_stringCheck(text)) return false;
  return UNSAFE_HTML_PATTERNS.some((pattern) => pattern.test(text));
}

function uri_stringCheck(value: unknown): value is string {
  return typeof value === "string";
}

// ============================================================================
// UUID Validation
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

// ============================================================================
// Block Validator
// ============================================================================

function validateBlock(
  block: ArticleBlock,
  seenIds: Set<string>,
  errors: BlockValidationError[]
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

  // 4. Content safety checks — scan all string leaf values in content
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

  // 7. Recurse into children
  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      validateBlock(child, seenIds, errors);
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
    if (isUnsafeUri(obj)) {
      errors.push({ blockId, field, message: `Unsafe URI scheme detected in ${field}` });
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) scanObjectForUnsafe(item, blockId, field, errors);
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      scanObjectForUnsafe(val, blockId, field, errors);
    }
  }
}

// ============================================================================
// Envelope Validator
// ============================================================================

export function validateArticleEnvelope(envelope: ArticleEnvelope): ArticleValidationResult {
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

  // 4. Title — unsafe HTML check
  if (containsUnsafeHtml(envelope.title)) {
    errors.push({ field: "title", message: "Unsafe HTML/JS in article title" });
  }

  // 5. Blocks
  if (!Array.isArray(envelope.document?.blocks)) {
    errors.push({ field: "document.blocks", message: "document.blocks must be an array" });
  } else {
    for (const block of envelope.document.blocks) {
      validateBlock(block, seenIds, errors);
    }

    // 6. At most one H1 (warning-level: recorded as error with a note)
    const h1Count = envelope.document.blocks.filter(
      (b) => b.type === "heading" && (b.content as { level?: number }).level === 1
    ).length;
    if (h1Count > 1) {
      errors.push({ field: "document.blocks", message: `Article normally should have at most one H1 heading; found ${h1Count}` });
    }
  }

  // 7. Sources — check any external URLs
  if (Array.isArray(envelope.sources)) {
    for (const src of envelope.sources) {
      if (src && typeof src === "object" && "url" in src) {
        const url = (src as { url?: string }).url;
        if (url && isUnsafeUri(url)) {
          errors.push({ field: "sources", message: `Unsafe URI in source: ${url}` });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single block replacement (for AI one-block regeneration).
 * Returns errors specific to that block only.
 */
export function validateBlockReplacement(
  block: ArticleBlock,
  existingBlockIds: Set<string>
): BlockValidationError[] {
  const errors: BlockValidationError[] = [];
  const seenIds = new Set<string>(existingBlockIds);
  // Remove the replaced block's own ID before checking duplicates
  seenIds.delete(block.id);
  validateBlock(block, seenIds, errors);
  return errors;
}

/**
 * Validates that a brand reference in sources or evidenceRefs belongs to the same brand.
 * brandId is the article's brand; referencedBrandId must match.
 */
export function assertSameBrandReference(
  brandId: string,
  referencedBrandId: string,
  context: string
): BlockValidationError | null {
  if (brandId !== referencedBrandId) {
    return {
      field: context,
      message: `Cross-brand reference rejected: article brand '${brandId}' does not match referenced brand '${referencedBrandId}'`,
    };
  }
  return null;
}
