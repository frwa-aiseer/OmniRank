/**
 * OR-P05 — Article Schema + Repository Tests
 *
 * Covers:
 *   - Schema validation (blocks, UUIDs, schema version, H1 count)
 *   - Unsafe URI / HTML rejection
 *   - Stable unique block UUIDs
 *   - Autosave (working document)
 *   - Immutable version creation
 *   - Version restore
 *   - Brand isolation
 *   - Block-level replacement + provenance
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateArticleEnvelope,
  validateBlockReplacement,
  isUnsafeUri,
  containsUnsafeHtml,
  isValidUuid,
  assertSameBrandReference,
} from "../server/article/schema-validator.ts";
import { InMemoryArticleRepository } from "../server/article/repository.ts";
import {
  ArticleEnvelope,
  ArticleBlock,
  ARTICLE_SCHEMA_VERSION,
} from "../types/article.ts";

// ============================================================================
// Helpers
// ============================================================================

const BRAND_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRAND_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_A   = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_A  = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ART_A   = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function makeBlock(type: ArticleBlock["type"] = "paragraph", overrides: Partial<ArticleBlock> = {}): ArticleBlock {
  return {
    id: crypto.randomUUID(),
    type,
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    content: type === "heading" ? { level: 2, text: "Title" } : { text: "Some content" },
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
    title: "Test Article",
    slug: "test-article",
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
// 1. Schema Validation — valid envelopes
// ============================================================================

describe("OR-P05 — Schema Validation", () => {
  it("should validate a correct article envelope as valid", () => {
    const result = validateArticleEnvelope(makeEnvelope());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject an envelope with a wrong schemaVersion", () => {
    const result = validateArticleEnvelope(makeEnvelope({ schemaVersion: "9.9" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "schemaVersion")).toBe(true);
  });

  it("should reject an envelope with an invalid articleId", () => {
    const result = validateArticleEnvelope(makeEnvelope({ articleId: "not-a-uuid" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "articleId")).toBe(true);
  });

  it("should reject an envelope with an invalid brandId", () => {
    const result = validateArticleEnvelope(makeEnvelope({ brandId: "bad" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "brandId")).toBe(true);
  });

  it("should flag more than one H1 heading", () => {
    const blocks = [
      makeBlock("heading", { content: { level: 1, text: "H1 First" } }),
      makeBlock("heading", { content: { level: 1, text: "H1 Second" } }),
    ];
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("H1"))).toBe(true);
  });

  it("should allow exactly one H1 heading", () => {
    const blocks = [
      makeBlock("heading", { content: { level: 1, text: "Page Title" } }),
      makeBlock("paragraph"),
    ];
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks } }));
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 2. Stable unique block UUIDs
// ============================================================================

describe("OR-P05 — Stable Block UUIDs", () => {
  it("should reject blocks with invalid (non-UUID) ids", () => {
    const block = makeBlock("paragraph", { id: "not-a-valid-uuid" });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "id")).toBe(true);
  });

  it("should reject duplicate block UUIDs in the same document", () => {
    const sharedId = crypto.randomUUID();
    const b1 = makeBlock("paragraph", { id: sharedId });
    const b2 = makeBlock("paragraph", { id: sharedId });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [b1, b2] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Duplicate"))).toBe(true);
  });

  it("should accept all blocks with distinct UUIDs", () => {
    const blocks = Array.from({ length: 5 }, () => makeBlock("paragraph"));
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks } }));
    expect(result.valid).toBe(true);
  });

  it("isValidUuid should accept a valid v4 UUID", () => {
    expect(isValidUuid(crypto.randomUUID())).toBe(true);
  });

  it("isValidUuid should reject non-UUID strings", () => {
    expect(isValidUuid("foo")).toBe(false);
    expect(isValidUuid("123")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});

// ============================================================================
// 3. Unsafe URI rejection
// ============================================================================

describe("OR-P05 — Unsafe URI Rejection", () => {
  it("should flag javascript: URIs as unsafe", () => {
    expect(isUnsafeUri("javascript:alert(1)")).toBe(true);
    expect(isUnsafeUri("JAVASCRIPT:void(0)")).toBe(true);
  });

  it("should flag vbscript: URIs as unsafe", () => {
    expect(isUnsafeUri("vbscript:msgbox(1)")).toBe(true);
  });

  it("should flag data: URIs as unsafe", () => {
    expect(isUnsafeUri("data:text/html,<h1>hi</h1>")).toBe(true);
  });

  it("should allow http/https URIs", () => {
    expect(isUnsafeUri("https://example.com")).toBe(false);
    expect(isUnsafeUri("http://example.com/page")).toBe(false);
  });

  it("should allow relative paths", () => {
    expect(isUnsafeUri("/some/path")).toBe(false);
  });

  it("should reject a block whose content contains a javascript: URI", () => {
    const block = makeBlock("cta", {
      content: { text: "Click here", href: "javascript:alert(1)", label: "Go" },
    });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Unsafe URI"))).toBe(true);
  });

  it("should reject a source with a data: URI", () => {
    const envelope = makeEnvelope({
      sources: [{ id: "src1", type: "external", label: "Test", url: "data:text/html,xss" }],
    });
    const result = validateArticleEnvelope(envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "sources")).toBe(true);
  });
});

// ============================================================================
// 4. Unsafe HTML rejection
// ============================================================================

describe("OR-P05 — Unsafe HTML Rejection", () => {
  it("should detect <script> tags", () => {
    expect(containsUnsafeHtml("<script>alert(1)</script>")).toBe(true);
    expect(containsUnsafeHtml("<SCRIPT src='evil.js'>")).toBe(true);
  });

  it("should detect inline event handlers", () => {
    expect(containsUnsafeHtml('<img onerror="alert(1)">')).toBe(true);
    expect(containsUnsafeHtml("onclick=doSomething()")).toBe(true);
  });

  it("should detect <iframe> tags", () => {
    expect(containsUnsafeHtml("<iframe src='evil.com'>")).toBe(true);
  });

  it("should allow plain text", () => {
    expect(containsUnsafeHtml("This is a normal paragraph.")).toBe(false);
  });

  it("should reject an article title with a <script> tag", () => {
    const result = validateArticleEnvelope(makeEnvelope({ title: "<script>alert(1)</script>" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "title")).toBe(true);
  });

  it("should reject block content with inline event handler", () => {
    const block = makeBlock("paragraph", { content: { text: '<p onclick="evil()">Hello</p>' } });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Unsafe HTML"))).toBe(true);
  });
});

// ============================================================================
// 5. Unknown block type fails safely
// ============================================================================

describe("OR-P05 — Unknown Block Types", () => {
  it("should reject unknown block types", () => {
    const block = makeBlock("paragraph", { type: "superFancyFutureBlock" as ArticleBlock["type"] });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Unknown block type"))).toBe(true);
  });
});

// ============================================================================
// 6. Statistic/Citation evidence references
// ============================================================================

describe("OR-P05 — Statistic/Citation Evidence Refs", () => {
  it("should warn when a statistic block has no evidenceRefs", () => {
    const block = makeBlock("statistic", { content: { value: "42%", label: "Conversion" } });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "evidenceRefs")).toBe(true);
  });

  it("should accept a statistic block with evidenceRefs populated", () => {
    const block = makeBlock("statistic", {
      content: { value: "42%", label: "Conversion" },
      evidenceRefs: [crypto.randomUUID()],
    });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(true);
  });

  it("should accept a citation block with inline evidenceClaimId", () => {
    const block = makeBlock("citation", {
      content: { text: "Source text", evidenceClaimId: crypto.randomUUID() },
    });
    const result = validateArticleEnvelope(makeEnvelope({ document: { blocks: [block] } }));
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 7. Brand isolation
// ============================================================================

describe("OR-P05 — Brand Isolation", () => {
  it("assertSameBrandReference should pass for matching brands", () => {
    const err = assertSameBrandReference(BRAND_A, BRAND_A, "evidenceRefs");
    expect(err).toBeNull();
  });

  it("assertSameBrandReference should fail for mismatched brands", () => {
    const err = assertSameBrandReference(BRAND_A, BRAND_B, "evidenceRefs");
    expect(err).not.toBeNull();
    expect(err!.message).toContain("Cross-brand reference rejected");
  });
});

// ============================================================================
// 8. Block-level replacement + provenance (InMemoryArticleRepository)
// ============================================================================

describe("OR-P05 — Block Replacement + Provenance", () => {
  let repo: InMemoryArticleRepository;

  beforeEach(() => {
    repo = new InMemoryArticleRepository();
  });

  async function setup() {
    const article = await repo.createArticle({
      organizationId: ORG_A,
      brandId: BRAND_A,
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting",
      title: "Test",
      slug: "test",
      locale: "en",
      seo: {},
      geo: {},
      metadata: {},
      sources: [],
      relationships: [],
      createdBy: USER_A,
    });

    const originalBlock = makeBlock("paragraph", { content: { text: "Original text" } });
    const envelope = makeEnvelope({
      articleId: article.id,
      brandId: BRAND_A,
      document: { blocks: [originalBlock] },
    });

    await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, envelope, USER_A);
    return { article, originalBlock };
  }

  it("should replace a single block and record provenance", async () => {
    const { article, originalBlock } = await setup();

    const newBlock: ArticleBlock = {
      ...makeBlock("paragraph"),
      id: originalBlock.id, // same stable UUID
      content: { text: "Replaced text" },
    };

    const updatedDoc = await repo.replaceBlock(
      article.id, BRAND_A, ORG_A,
      originalBlock.id, newBlock, USER_A,
      "block_rewrite", "gemini-flash", "Rewrite paragraph for clarity"
    );

    expect(updatedDoc.content.document.blocks[0].content).toMatchObject({ text: "Replaced text" });
    expect(updatedDoc.content.document.blocks[0].provenance.aiGenerated).toBe(true);
    expect(updatedDoc.content.document.blocks[0].provenance.aiTaskCode).toBe("block_rewrite");

    const ops = await repo.listBlockOperations(article.id, BRAND_A);
    expect(ops).toHaveLength(1);
    expect(ops[0].operationType).toBe("ai_replace");
    expect(ops[0].blockId).toBe(originalBlock.id);
    expect((ops[0].blockBefore?.content as Record<string, unknown>).text).toBe("Original text");
    expect((ops[0].blockAfter?.content as Record<string, unknown>).text).toBe("Replaced text");
    expect(ops[0].aiTaskCode).toBe("block_rewrite");
  });

  it("should not overwrite other blocks when replacing one", async () => {
    const block1 = makeBlock("paragraph", { content: { text: "Block 1" } });
    const block2 = makeBlock("paragraph", { content: { text: "Block 2" } });
    const block3 = makeBlock("paragraph", { content: { text: "Block 3" } });

    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "T", slug: "t", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    await repo.autosaveWorkingDocument(
      article.id, BRAND_A, ORG_A,
      makeEnvelope({ articleId: article.id, brandId: BRAND_A, document: { blocks: [block1, block2, block3] } }),
      USER_A
    );

    const replacedBlock: ArticleBlock = { ...block2, content: { text: "NEW Block 2" } };
    const updatedDoc = await repo.replaceBlock(
      article.id, BRAND_A, ORG_A, block2.id, replacedBlock, USER_A
    );

    const blocks = updatedDoc.content.document.blocks;
    expect((blocks[0].content as Record<string, unknown>).text).toBe("Block 1");
    expect((blocks[1].content as Record<string, unknown>).text).toBe("NEW Block 2");
    expect((blocks[2].content as Record<string, unknown>).text).toBe("Block 3");
  });
});

// ============================================================================
// 9. Autosave (working document)
// ============================================================================

describe("OR-P05 — Autosave", () => {
  let repo: InMemoryArticleRepository;

  beforeEach(() => {
    repo = new InMemoryArticleRepository();
  });

  it("should create a working document on first autosave", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "A", slug: "a", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    const doc = await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, envelope, USER_A);
    expect(doc.articleId).toBe(article.id);
    expect(doc.autosaveSeq).toBe(1);
  });

  it("should increment autosave_seq on subsequent saves", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "B", slug: "b", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, envelope, USER_A);
    const doc2 = await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, envelope, USER_A);
    expect(doc2.autosaveSeq).toBe(2);
  });

  it("should not return a working document for a different brand", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "C", slug: "c", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, envelope, USER_A);
    const result = await repo.getWorkingDocument(article.id, BRAND_B);
    expect(result).toBeNull();
  });
});

// ============================================================================
// 10. Immutable versions
// ============================================================================

describe("OR-P05 — Immutable Versions", () => {
  let repo: InMemoryArticleRepository;

  beforeEach(() => {
    repo = new InMemoryArticleRepository();
  });

  it("should create a version with monotonically increasing version numbers", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "V", slug: "v", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    const v1 = await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "Draft 1", USER_A);
    const v2 = await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "Draft 2", USER_A);
    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
    expect(v1.id).not.toBe(v2.id);
  });

  it("should return versions in descending order", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "W", slug: "w", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "v1", USER_A);
    await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "v2", USER_A);
    await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "v3", USER_A);
    const versions = await repo.listVersions(article.id, BRAND_A);
    expect(versions[0].versionNumber).toBe(3);
    expect(versions[2].versionNumber).toBe(1);
  });

  it("should return the version by exact ID", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "X", slug: "x", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    const v1 = await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "v1", USER_A);
    const fetched = await repo.getVersion(v1.id, BRAND_A);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(v1.id);
    expect(fetched!.versionNumber).toBe(1);
  });
});

// ============================================================================
// 11. Restore version
// ============================================================================

describe("OR-P05 — Restore Version", () => {
  let repo: InMemoryArticleRepository;

  beforeEach(() => {
    repo = new InMemoryArticleRepository();
  });

  it("should restore version content into the working document", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "R", slug: "r", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });

    const v1Envelope = makeEnvelope({
      articleId: article.id, brandId: BRAND_A,
      document: { blocks: [makeBlock("paragraph", { content: { text: "Version 1 content" } })] },
    });
    const v1 = await repo.createVersion(article.id, BRAND_A, ORG_A, v1Envelope, "Saved v1", USER_A);

    // Make edits
    const v2Envelope = makeEnvelope({
      articleId: article.id, brandId: BRAND_A,
      document: { blocks: [makeBlock("paragraph", { content: { text: "Edited content" } })] },
    });
    await repo.autosaveWorkingDocument(article.id, BRAND_A, ORG_A, v2Envelope, USER_A);

    // Restore v1
    const restored = await repo.restoreVersion(article.id, BRAND_A, ORG_A, v1.id, USER_A);
    expect((restored.content.document.blocks[0].content as Record<string, unknown>).text)
      .toBe("Version 1 content");

    // Restore records a block operation
    const ops = await repo.listBlockOperations(article.id, BRAND_A);
    expect(ops.some((o) => o.operationType === "restore")).toBe(true);
  });

  it("should throw when trying to restore a version from a different brand", async () => {
    const article = await repo.createArticle({
      organizationId: ORG_A, brandId: BRAND_A, schemaVersion: ARTICLE_SCHEMA_VERSION,
      status: "drafting", title: "S", slug: "s", locale: "en",
      seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: USER_A,
    });
    const envelope = makeEnvelope({ articleId: article.id, brandId: BRAND_A });
    const v = await repo.createVersion(article.id, BRAND_A, ORG_A, envelope, "v1", USER_A);

    await expect(
      repo.restoreVersion(article.id, BRAND_B, ORG_A, v.id, USER_A)
    ).rejects.toThrow();
  });
});

// ============================================================================
// 12. Block replacement validation
// ============================================================================

describe("OR-P05 — Block Replacement Validation", () => {
  it("should reject a replacement block with a non-UUID id", () => {
    const existingIds = new Set([crypto.randomUUID()]);
    const badBlock = makeBlock("paragraph", { id: "not-a-uuid" });
    const errors = validateBlockReplacement(badBlock, existingIds);
    expect(errors.some((e) => e.field === "id")).toBe(true);
  });

  it("should reject a replacement block with an unknown type", () => {
    const existingIds = new Set<string>();
    const block = makeBlock("paragraph", { type: "futureBlock" as ArticleBlock["type"] });
    const errors = validateBlockReplacement(block, existingIds);
    expect(errors.some((e) => e.message.includes("Unknown block type"))).toBe(true);
  });

  it("should pass for a valid replacement block", () => {
    const existingBlock = makeBlock("paragraph");
    const existingIds = new Set([existingBlock.id]);
    const replacement: ArticleBlock = { ...existingBlock, content: { text: "Updated" } };
    const errors = validateBlockReplacement(replacement, existingIds);
    expect(errors).toHaveLength(0);
  });
});
