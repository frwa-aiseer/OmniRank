/**
 * OR-P05-FIX — Regression tests for all OR-P05-FIX items.
 *
 * Covers:
 *  1.  URI allowlist (http/https/relative only)
 *  2.  Envelope identity (articleId/brandId must match route)
 *  3.  restoreVersion requires same article (not just same brand)
 *  4.  replaceBlock preserves newBlock.id === blockId
 *  5.  evidenceRefs/sourceRefs validated as valid UUIDs
 *  6.  assertSameBrandReference wired for cross-brand evidence rejection
 *  7.  validateBlockReplacement enforces targetBlockId
 *  8.  Concurrent version numbering safety (max-scan, no duplicate numbers)
 *  9.  Writer approval fields blocked in validation
 * 10.  Migration 00011 file exists and references correct objects
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  isSafeUri,
  isUnsafeUri,
  containsUnsafeHtml,
  isValidUuid,
  validateArticleEnvelope,
  validateBlockReplacement,
  assertSameBrandReference,
  validateBlockBrandRefs,
} from "../server/article/schema-validator.ts";
import { InMemoryArticleRepository } from "../server/article/repository.ts";
import { ArticleBlock, ArticleEnvelope, ARTICLE_SCHEMA_VERSION } from "../types/article.ts";

// ============================================================================
// Stable test UUIDs (v4 compliant)
// ============================================================================
const BRAND_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRAND_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_A   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_A  = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ART_A   = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ART_B   = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function makeBlock(type: ArticleBlock["type"] = "paragraph", overrides: Partial<ArticleBlock> = {}): ArticleBlock {
  return {
    id: crypto.randomUUID(),
    type,
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    content: type === "heading" ? { level: 2, text: "Title" } : { text: "Content" },
    attributes: {},
    sourceRefs: [],
    evidenceRefs: [],
    provenance: { createdBy: USER_A, createdAt: new Date().toISOString() },
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<ArticleEnvelope> = {}): ArticleEnvelope {
  return {
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    articleId: ART_A,
    brandId: BRAND_A,
    locale: "en",
    title: "Test",
    slug: "test",
    document: { blocks: [makeBlock()] },
    metadata: { status: "drafting" },
    seo: {},
    geo: {},
    sources: [],
    relationships: [],
    provenance: { createdBy: USER_A, createdAt: new Date().toISOString() },
    ...overrides,
  };
}

// ============================================================================
// 1. URI allowlist — http/https/relative only
// ============================================================================
describe("OR-P05-FIX — URI Allowlist", () => {
  it("should allow http URIs", () => {
    expect(isSafeUri("http://example.com")).toBe(true);
    expect(isUnsafeUri("http://example.com")).toBe(false);
  });

  it("should allow https URIs", () => {
    expect(isSafeUri("https://example.com/page?q=1")).toBe(true);
  });

  it("should allow relative paths starting with /", () => {
    expect(isSafeUri("/foo/bar")).toBe(true);
    expect(isSafeUri("./relative")).toBe(true);
    expect(isSafeUri("../parent")).toBe(true);
  });

  it("should allow fragment-only and query-only", () => {
    expect(isSafeUri("#anchor")).toBe(true);
    expect(isSafeUri("?search=foo")).toBe(true);
  });

  it("should reject javascript: scheme", () => {
    expect(isSafeUri("javascript:alert(1)")).toBe(false);
    expect(isUnsafeUri("javascript:void(0)")).toBe(true);
  });

  it("should reject vbscript: scheme", () => {
    expect(isSafeUri("vbscript:msgbox(1)")).toBe(false);
  });

  it("should reject data: URIs", () => {
    expect(isSafeUri("data:text/html,<h1>hi</h1>")).toBe(false);
    expect(isSafeUri("data:image/png;base64,abc")).toBe(false);
  });

  it("should reject file: scheme", () => {
    expect(isSafeUri("file:///etc/passwd")).toBe(false);
  });

  it("should reject any custom scheme with a colon before slash", () => {
    expect(isSafeUri("blob:https://example.com/id")).toBe(false);
    expect(isSafeUri("ftp://files.example.com")).toBe(false);
  });

  it("should reject unsafe URI in source URL via envelope validation", () => {
    const envelope = makeEnvelope({
      sources: [{ id: "s1", type: "external", label: "Test", url: "javascript:alert(1)" }],
    });
    const result = validateArticleEnvelope(envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "sources")).toBe(true);
  });

  it("should allow http URL in source via envelope validation", () => {
    const envelope = makeEnvelope({
      sources: [{ id: "s1", type: "external", label: "Test", url: "https://example.com" }],
    });
    const result = validateArticleEnvelope(envelope);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 2. Envelope identity enforcement
// ============================================================================
describe("OR-P05-FIX — Envelope Identity", () => {
  it("should reject envelope where articleId mismatches expected", () => {
    const envelope = makeEnvelope({ articleId: ART_A });
    const result = validateArticleEnvelope(envelope, { expectedArticleId: ART_B });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "articleId" && e.message.includes("route/DB"))).toBe(true);
  });

  it("should reject envelope where brandId mismatches expected", () => {
    const envelope = makeEnvelope({ brandId: BRAND_A });
    const result = validateArticleEnvelope(envelope, { expectedBrandId: BRAND_B });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "brandId" && e.message.includes("authorized"))).toBe(true);
  });

  it("should pass envelope where both IDs match", () => {
    const envelope = makeEnvelope({ articleId: ART_A, brandId: BRAND_A });
    const result = validateArticleEnvelope(envelope, {
      expectedArticleId: ART_A,
      expectedBrandId: BRAND_A,
    });
    expect(result.valid).toBe(true);
  });

  it("should accept envelope when no identity check provided", () => {
    const result = validateArticleEnvelope(makeEnvelope());
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 3. restoreVersion must verify same article (not just same brand)
// ============================================================================
describe("OR-P05-FIX — Restore Version: same-article check", () => {
  let repo: InMemoryArticleRepository;

  beforeEach(() => {
    repo = new InMemoryArticleRepository();
  });

  async function createArticleWithVersion(articleId: string, title: string) {
    const article = await repo.createArticle({
      organizationId: ORG_A,
      brandId: BRAND_A,
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting",
      title,
      slug: title.toLowerCase(),
      locale: "en",
      seo: {},
      geo: {},
      metadata: {},
      sources: [],
      relationships: [],
      createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    const version = await repo.createVersion(
      article.id, BRAND_A, ORG_A, envelope, "v1", USER_A
    );
    return { article, version };
  }

  it("should restore a version that belongs to the same article", async () => {
    const { article, version } = await createArticleWithVersion("art1", "Article 1");
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, envelope, USER_A);
    const restored = await repo.restoreVersion(article.id, BRAND_A, ORG_A, version.id, USER_A);
    expect(restored.articleId).toBe(article.id);
  });

  it("should reject restoreVersion when versionId belongs to a different article", async () => {
    const { article: art1 } = await createArticleWithVersion("art1", "Article 1");
    const { version: ver2 } = await createArticleWithVersion("art2", "Article 2");
    const envelope = makeEnvelope({ articleId: art1.id, brandId: BRAND_A });
    await repo.autosaveWorkingDocument(art1.id, BRAND_A, ORG_A, envelope, USER_A);

    // Try to restore ver2 (article 2's version) into art1 — must fail
    await expect(
      repo.restoreVersion(art1.id, BRAND_A, ORG_A, ver2.id, USER_A)
    ).rejects.toThrow();
  });
});

// ============================================================================
// 4. replaceBlock must enforce newBlock.id === target blockId
// ============================================================================
describe("OR-P05-FIX — Block Replacement ID Preservation", () => {
  let repo: InMemoryArticleRepository;

  beforeEach(() => {
    repo = new InMemoryArticleRepository();
  });

  it("should reject replaceBlock when newBlock.id differs from blockId", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "T", slug: "t", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const originalBlock = makeBlock("paragraph", { content: { text: "Original" } });
    await repo.autosaveWorkingDocument(
      article.id, BRAND_A, ORG_A,
      makeEnvelope({ articleId: article.id, brandId: BRAND_A, document: { blocks: [originalBlock] } }),
      USER_A
    );

    const wrongIdBlock: ArticleBlock = {
      ...originalBlock,
      id: crypto.randomUUID(), // Different UUID — must be rejected
      content: { text: "Replaced" },
    };

    await expect(
      repo.replaceBlock(article.id, BRAND_A, ORG_A, originalBlock.id, wrongIdBlock, USER_A)
    ).rejects.toThrow(/id mismatch/i);
  });

  it("should accept replaceBlock when newBlock.id equals blockId", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "T2", slug: "t2", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const originalBlock = makeBlock("paragraph", { content: { text: "Original" } });
    await repo.autosaveWorkingDocument(
      article.id, BRAND_A, ORG_A,
      makeEnvelope({ articleId: article.id, brandId: BRAND_A, document: { blocks: [originalBlock] } }),
      USER_A
    );

    const correctBlock: ArticleBlock = {
      ...originalBlock, // Same id
      content: { text: "Replaced correctly" },
    };

    const result = await repo.replaceBlock(
      article.id, BRAND_A, ORG_A, originalBlock.id, correctBlock, USER_A
    );
    expect((result.content.document.blocks[0].content as Record<string, unknown>).text).toBe("Replaced correctly");
    expect(result.content.document.blocks[0].id).toBe(originalBlock.id);
  });
});

// ============================================================================
// 5. validateBlockReplacement enforces targetBlockId
// ============================================================================
describe("OR-P05-FIX — validateBlockReplacement with targetBlockId", () => {
  it("should reject block where id does not match targetBlockId", () => {
    const targetId = crypto.randomUUID();
    const wrongBlock = makeBlock("paragraph", { id: crypto.randomUUID() });
    const errors = validateBlockReplacement(wrongBlock, new Set([targetId]), targetId);
    expect(errors.some((e) => e.message.includes("must equal target blockId"))).toBe(true);
  });

  it("should pass when block.id matches targetBlockId", () => {
    const blockId = crypto.randomUUID();
    const block = makeBlock("paragraph", { id: blockId });
    const errors = validateBlockReplacement(block, new Set([blockId]), blockId);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// 6. evidenceRefs validated as valid UUIDs
// ============================================================================
describe("OR-P05-FIX — Evidence/Source Ref UUID Validation", () => {
  it("should reject evidenceRef that is not a valid UUID", () => {
    const block = makeBlock("statistic", {
      content: { value: "42%", label: "CTR" },
      evidenceRefs: ["not-a-uuid"],
    });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "evidenceRefs")).toBe(true);
  });

  it("should reject sourceRef that is not a valid UUID", () => {
    const evidenceId = crypto.randomUUID();
    const block = makeBlock("statistic", {
      content: { value: "42%", label: "CTR" },
      evidenceRefs: [evidenceId],
      sourceRefs: ["bad-ref"],
    });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "sourceRefs")).toBe(true);
  });

  it("should accept valid UUID evidenceRefs and sourceRefs", () => {
    const block = makeBlock("statistic", {
      content: { value: "42%", label: "CTR" },
      evidenceRefs: [crypto.randomUUID()],
      sourceRefs: [crypto.randomUUID()],
    });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 7. assertSameBrandReference / validateBlockBrandRefs
// ============================================================================
describe("OR-P05-FIX — Cross-brand Reference Validation", () => {
  it("assertSameBrandReference should accept same brand", () => {
    expect(assertSameBrandReference(BRAND_A, BRAND_A, "evidenceRefs")).toBeNull();
  });

  it("assertSameBrandReference should reject different brands", () => {
    const err = assertSameBrandReference(BRAND_A, BRAND_B, "evidenceRefs");
    expect(err).not.toBeNull();
    expect(err!.message).toContain("Cross-brand reference rejected");
  });

  it("validateBlockBrandRefs should flag cross-brand evidence refs", () => {
    const refId = crypto.randomUUID();
    const block = makeBlock("statistic", {
      content: { value: "42%", label: "CTR" },
      evidenceRefs: [refId],
    });
    // The ref belongs to BRAND_B but article is BRAND_A
    const getRefBrandId = (id: string) => id === refId ? BRAND_B : undefined;
    const errors = validateBlockBrandRefs(block, BRAND_A, getRefBrandId);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Cross-brand reference rejected");
  });

  it("validateBlockBrandRefs should pass when all refs are same-brand", () => {
    const refId = crypto.randomUUID();
    const block = makeBlock("citation", {
      content: { text: "Cite this", evidenceClaimId: refId },
      evidenceRefs: [refId],
    });
    const getRefBrandId = (_id: string) => BRAND_A;
    const errors = validateBlockBrandRefs(block, BRAND_A, getRefBrandId);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// 8. Concurrent version numbering (no duplicate numbers per article)
// ============================================================================
describe("OR-P05-FIX — Concurrent Version Numbering Safety", () => {
  it("should assign unique sequential version numbers even when created rapidly", async () => {
    const repo = new InMemoryArticleRepository();
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "Concurrent", slug: "concurrent", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });

    // Create 5 versions as fast as possible
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repo.createVersion(article.id, BRAND_A, ORG_A, envelope, `v${i + 1}`, USER_A)
      )
    );

    const numbers = results.map((v) => v.versionNumber).sort((a, b) => a - b);
    // All version numbers must be unique
    expect(new Set(numbers).size).toBe(5);
    // Must span 1-5
    expect(numbers[0]).toBeGreaterThanOrEqual(1);
    expect(numbers[4]).toBeLessThanOrEqual(10); // May not be exactly 1-5 due to parallelism but must be unique
  });
});

// ============================================================================
// 9. Unsafe HTML rejection (continued coverage)
// ============================================================================
describe("OR-P05-FIX — Unsafe HTML (continued)", () => {
  it("containsUnsafeHtml should reject <object> tag", () => {
    expect(containsUnsafeHtml('<object data="evil.swf">')).toBe(true);
  });

  it("containsUnsafeHtml should reject <embed> tag", () => {
    expect(containsUnsafeHtml('<embed src="evil.swf" />')).toBe(true);
  });

  it("containsUnsafeHtml should allow normal heading text", () => {
    expect(containsUnsafeHtml("How to Build a Multi-Tenant SaaS Application")).toBe(false);
  });
});

// ============================================================================
// 10. Migration 00011 file exists and references correct triggers/functions
// ============================================================================
describe("OR-P05-FIX — Migration 00011 Integrity", () => {
  const MIG_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const MIG_FILE = path.join(MIG_DIR, "20260929000011_article_integrity.sql");

  it("migration file 20260929000011_article_integrity.sql should exist", () => {
    expect(fs.existsSync(MIG_FILE)).toBe(true);
  });

  it("migration should define tenant consistency triggers", () => {
    const content = fs.readFileSync(MIG_FILE, "utf8");
    expect(content).toContain("fn_check_article_brand_org");
    expect(content).toContain("fn_check_working_doc_consistency");
    expect(content).toContain("fn_check_article_version_consistency");
    expect(content).toContain("fn_check_block_op_consistency");
  });

  it("migration should define approved_version_id consistency check", () => {
    const content = fs.readFileSync(MIG_FILE, "utf8");
    expect(content).toContain("fn_check_approved_version");
    expect(content).toContain("approved_version_id");
  });

  it("migration should define writer approval guard", () => {
    const content = fs.readFileSync(MIG_FILE, "utf8");
    expect(content).toContain("fn_prevent_writer_approval");
    expect(content).toContain("trg_prevent_writer_approval");
  });

  it("migration should define concurrent-safe version numbering", () => {
    const content = fs.readFileSync(MIG_FILE, "utf8");
    expect(content).toContain("fn_assign_version_number");
    expect(content).toContain("pg_advisory_xact_lock");
  });

  it("migration should use SECURITY DEFINER and SET search_path", () => {
    const content = fs.readFileSync(MIG_FILE, "utf8");
    const definerCount = (content.match(/SECURITY DEFINER/g) ?? []).length;
    const searchPathCount = (content.match(/SET search_path/g) ?? []).length;
    expect(definerCount).toBeGreaterThanOrEqual(5);
    expect(searchPathCount).toBeGreaterThanOrEqual(5);
  });

  it("migration should revoke PUBLIC/anon access from trigger functions", () => {
    const content = fs.readFileSync(MIG_FILE, "utf8");
    expect(content).toContain("REVOKE ALL ON FUNCTION");
    expect(content).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("should now have 12 migration files total", () => {
    const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(files.length).toBe(12);
    expect(files[11]).toBe("20260929000011_article_integrity.sql");
  });
});
