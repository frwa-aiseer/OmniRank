/**
 * OR-P05 — Article Repository
 *
 * Implements CRUD for articles, autosave working document, immutable versions,
 * restore, and block-level replacement with provenance.
 *
 * CRITICAL: Normal operations use user-scoped Supabase client (RLS enforced).
 *           Service role is NEVER used for normal user operations.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  Article,
  ArticleWorkingDocument,
  ArticleVersion,
  ArticleEnvelope,
  ContentBlockOperation,
  ArticleBlock,
  BlockOperationType,
} from "../../types/article.ts";
import {
  createScopedUserSupabaseClient,
  isLiveSupabaseConfigured,
} from "../supabase/client.ts";
import { assertSameBrandReference, isValidUuid } from "./schema-validator.ts";

// ============================================================================
// Repository Interface
// ============================================================================

export interface IArticleRepository {
  // Article CRUD
  createArticle(article: Omit<Article, "id" | "createdAt" | "updatedAt">): Promise<Article>;
  getArticle(articleId: string, brandId: string): Promise<Article | null>;
  listArticles(brandId: string): Promise<Article[]>;
  updateArticleStatus(articleId: string, brandId: string, status: Article["status"]): Promise<Article>;
  reviewArticle(articleId: string, versionId: string | null, status: Article["status"]): Promise<void>;

  // Working document (autosave)
  autosaveWorkingDocument(
    articleId: string,
    brandId: string,
    organizationId: string,
    content: ArticleEnvelope,
    userId: string
  ): Promise<ArticleWorkingDocument>;
  getWorkingDocument(articleId: string, brandId: string): Promise<ArticleWorkingDocument | null>;

  // Versions (immutable milestones)
  createVersion(
    articleId: string,
    brandId: string,
    organizationId: string,
    content: ArticleEnvelope,
    label: string,
    userId: string
  ): Promise<ArticleVersion>;
  listVersions(articleId: string, brandId: string): Promise<ArticleVersion[]>;
  getVersion(versionId: string, brandId: string, articleId?: string): Promise<ArticleVersion | null>;
  restoreVersion(
    articleId: string,
    brandId: string,
    organizationId: string,
    versionId: string,
    userId: string
  ): Promise<ArticleWorkingDocument>;

  // Block operations (provenance)
  recordBlockOperation(op: Omit<ContentBlockOperation, "id" | "performedAt">): Promise<ContentBlockOperation>;
  listBlockOperations(articleId: string, brandId: string): Promise<ContentBlockOperation[]>;

  // One-block AI replacement
  replaceBlock(
    articleId: string,
    brandId: string,
    organizationId: string,
    blockId: string,
    newBlock: ArticleBlock,
    userId: string,
    aiTaskCode?: string,
    aiModelHint?: string,
    aiPromptSummary?: string
  ): Promise<ArticleWorkingDocument>;
}

// ============================================================================
// In-Memory (Demo/Test) Implementation
// ============================================================================

interface MemStore {
  articles: Map<string, Article>;
  workingDocs: Map<string, ArticleWorkingDocument>;
  versions: Map<string, ArticleVersion>;
  blockOps: ContentBlockOperation[];
}

const mem: MemStore = {
  articles: new Map(),
  workingDocs: new Map(),
  versions: new Map(),
  blockOps: [],
};

function randomUuid(): string {
  return crypto.randomUUID();
}

export class InMemoryArticleRepository implements IArticleRepository {
  static knownEvidenceClaims = new Map<string, string>(); // claimId -> brandId
  static knownKnowledgeChunks = new Map<string, string>(); // chunkId -> brandId

  private validateBrandRefs(content: ArticleEnvelope, brandId: string): void {
    const collectRefs = (blocks: ArticleBlock[] | undefined, evRefs: string[], srcRefs: string[]) => {
      for (const b of blocks ?? []) {
        if (Array.isArray(b.evidenceRefs)) {
          for (const ref of b.evidenceRefs) {
            if (ref && isValidUuid(ref)) evRefs.push(ref);
          }
        }
        if (Array.isArray(b.sourceRefs)) {
          for (const ref of b.sourceRefs) {
            if (ref && isValidUuid(ref)) srcRefs.push(ref);
          }
        }
        if (b.children && Array.isArray(b.children)) {
          collectRefs(b.children, evRefs, srcRefs);
        }
      }
    };

    const rawEvidenceRefs: string[] = [];
    const rawSourceRefs: string[] = [];
    collectRefs(content.document?.blocks, rawEvidenceRefs, rawSourceRefs);

    const evidenceRefs = Array.from(new Set(rawEvidenceRefs));
    const sourceRefs = Array.from(new Set(rawSourceRefs));

    for (const ref of evidenceRefs) {
      const claimBrand = InMemoryArticleRepository.knownEvidenceClaims.get(ref);
      if (!claimBrand) throw new Error("Missing, inaccessible, or foreign reference");
      if (claimBrand !== brandId) {
        const err = assertSameBrandReference(brandId, claimBrand, "evidenceRefs");
        if (err) throw new Error(err.message);
      }
    }

    for (const ref of sourceRefs) {
      const chunkBrand = InMemoryArticleRepository.knownKnowledgeChunks.get(ref);
      if (!chunkBrand) throw new Error("Missing, inaccessible, or foreign reference");
      if (chunkBrand !== brandId) {
        const err = assertSameBrandReference(brandId, chunkBrand, "sourceRefs");
        if (err) throw new Error(err.message);
      }
    }
  }

  async createArticle(article: Omit<Article, "id" | "createdAt" | "updatedAt">): Promise<Article> {
    const now = new Date().toISOString();
    const row: Article = { ...article, id: randomUuid(), createdAt: now, updatedAt: now };
    mem.articles.set(row.id, row);
    return row;
  }

  async getArticle(articleId: string, brandId: string): Promise<Article | null> {
    const a = mem.articles.get(articleId);
    return a && a.brandId === brandId ? a : null;
  }

  async listArticles(brandId: string): Promise<Article[]> {
    return [...mem.articles.values()].filter((a) => a.brandId === brandId);
  }

  async updateArticleStatus(articleId: string, brandId: string, status: Article["status"]): Promise<Article> {
    const a = mem.articles.get(articleId);
    if (!a || a.brandId !== brandId) throw new Error("Article not found or unauthorized");
    a.status = status;
    a.updatedAt = new Date().toISOString();
    return a;
  }

  async reviewArticle(articleId: string, versionId: string | null, status: Article["status"]): Promise<void> {
    const a = mem.articles.get(articleId);
    if (!a) throw new Error("Article not found");
    // Simplified mock behavior for testing
    a.status = status;
    a.approvedVersionId = status === "approved" ? (versionId ?? undefined) : undefined;
    a.updatedAt = new Date().toISOString();
  }

  async autosaveWorkingDocument(
    articleId: string, brandId: string, organizationId: string,
    content: ArticleEnvelope, userId: string
  ): Promise<ArticleWorkingDocument> {
    this.validateBrandRefs(content, brandId);
    const existing = mem.workingDocs.get(articleId);
    const now = new Date().toISOString();
    const doc: ArticleWorkingDocument = {
      id: existing?.id ?? randomUuid(),
      articleId, brandId, organizationId, content,
      lastSavedBy: userId,
      savedAt: now,
      autosaveSeq: (existing?.autosaveSeq ?? 0) + 1,
    };
    mem.workingDocs.set(articleId, doc);
    return doc;
  }

  async getWorkingDocument(articleId: string, brandId: string): Promise<ArticleWorkingDocument | null> {
    const d = mem.workingDocs.get(articleId);
    return d && d.brandId === brandId ? d : null;
  }

  async createVersion(
    articleId: string, brandId: string, organizationId: string,
    content: ArticleEnvelope, label: string, userId: string
  ): Promise<ArticleVersion> {
    this.validateBrandRefs(content, brandId);
    const existing = [...mem.versions.values()].filter((v) => v.articleId === articleId);
    const versionNumber = existing.length + 1;
    const v: ArticleVersion = {
      id: randomUuid(),
      articleId, brandId, organizationId,
      versionNumber, label, content,
      schemaVersion: content.schemaVersion,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    mem.versions.set(v.id, v);
    return v;
  }

  async listVersions(articleId: string, brandId: string): Promise<ArticleVersion[]> {
    return [...mem.versions.values()]
      .filter((v) => v.articleId === articleId && v.brandId === brandId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async getVersion(versionId: string, brandId: string, articleId?: string): Promise<ArticleVersion | null> {
    const v = mem.versions.get(versionId);
    if (!v) return null;
    if (v.brandId !== brandId) return null;
    // If articleId provided, verify the version belongs to that same article
    if (articleId !== undefined && v.articleId !== articleId) return null;
    return v;
  }

  async restoreVersion(
    articleId: string, brandId: string, organizationId: string,
    versionId: string, userId: string
  ): Promise<ArticleWorkingDocument> {
    // Must verify version belongs to the SAME article, not only same brand
    const version = await this.getVersion(versionId, brandId, articleId);
    if (!version) throw new Error("Version not found, unauthorized, or does not belong to this article");
    // Restoring creates a new autosave of the version's content
    const doc = await this.autosaveWorkingDocument(
      articleId, brandId, organizationId, version.content, userId
    );
    await this.recordBlockOperation({
      articleId, brandId, organizationId,
      blockId: "00000000-0000-4000-8000-000000000000",
      operationType: "restore",
      blockBefore: undefined,
      blockAfter: undefined,
      aiTaskCode: undefined,
      aiModelHint: undefined,
      aiPromptSummary: `Restored from version ${version.versionNumber}: ${version.label}`,
      performedBy: userId,
    });
    return doc;
  }

  async recordBlockOperation(op: Omit<ContentBlockOperation, "id" | "performedAt">): Promise<ContentBlockOperation> {
    const record: ContentBlockOperation = {
      ...op,
      id: randomUuid(),
      performedAt: new Date().toISOString(),
    };
    mem.blockOps.push(record);
    return record;
  }

  async listBlockOperations(articleId: string, brandId: string): Promise<ContentBlockOperation[]> {
    return mem.blockOps.filter((o) => o.articleId === articleId && o.brandId === brandId);
  }

  async replaceBlock(
    articleId: string, brandId: string, organizationId: string,
    blockId: string, newBlock: ArticleBlock, userId: string,
    aiTaskCode?: string, aiModelHint?: string, aiPromptSummary?: string
  ): Promise<ArticleWorkingDocument> {
    // Enforce: newBlock.id must equal blockId (preserve stable UUID)
    if (newBlock.id !== blockId) {
      throw new Error(`Block replacement id mismatch: newBlock.id '${newBlock.id}' must equal target blockId '${blockId}'`);
    }

    this.validateBrandRefs({ document: { blocks: [newBlock] } } as unknown as ArticleEnvelope, brandId);

    const workingDoc = await this.getWorkingDocument(articleId, brandId);
    if (!workingDoc) throw new Error("Working document not found");

    const blocks = workingDoc.content.document.blocks;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) throw new Error(`Block ${blockId} not found in working document`);

    const blockBefore = blocks[idx];
    const updatedBlocks = [...blocks];
    updatedBlocks[idx] = {
      ...newBlock,
      id: blockId, // double-enforce
      provenance: {
        ...newBlock.provenance,
        lastModifiedBy: userId,
        lastModifiedAt: new Date().toISOString(),
        aiGenerated: Boolean(aiTaskCode),
        aiTaskCode,
        aiModelHint,
      },
    };

    const updatedContent: ArticleEnvelope = {
      ...workingDoc.content,
      document: { blocks: updatedBlocks },
    };

    const updatedDoc = await this.autosaveWorkingDocument(
      articleId, brandId, organizationId, updatedContent, userId
    );

    await this.recordBlockOperation({
      articleId, brandId, organizationId,
      blockId,
      operationType: (aiTaskCode ? "ai_replace" : "update") as BlockOperationType,
      blockBefore,
      blockAfter: updatedBlocks[idx],
      aiTaskCode,
      aiModelHint,
      aiPromptSummary,
      performedBy: userId,
    });

    return updatedDoc;
  }
}

// ============================================================================
// Supabase (Live) Implementation
// ============================================================================

export class SupabaseArticleRepository implements IArticleRepository {
  private client: SupabaseClient;

  constructor(accessToken?: string, injectedClient?: SupabaseClient) {
    if (injectedClient) {
      this.client = injectedClient;
      return;
    }
    if (isLiveSupabaseConfigured() && !accessToken) {
      throw new Error("[Article Repo] Missing user access token for live operation. Access denied.");
    }
    this.client = createScopedUserSupabaseClient(accessToken || "demo-token");
  }

  async createArticle(article: Omit<Article, "id" | "createdAt" | "updatedAt">): Promise<Article> {
    const { data, error } = await this.client
      .from("articles")
      .insert({
        organization_id: article.organizationId,
        brand_id: article.brandId,
        website_id: article.websiteId ?? null,
        schema_version: article.schemaVersion,
        status: article.status,
        title: article.title,
        slug: article.slug,
        locale: article.locale,
        seo: article.seo,
        geo: article.geo,
        metadata: article.metadata,
        sources: article.sources,
        relationships: article.relationships,
        created_by: article.createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(`[Article Repo] createArticle: ${error.message}`);
    return mapArticleRow(data);
  }

  async getArticle(articleId: string, brandId: string): Promise<Article | null> {
    const { data, error } = await this.client
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (error) throw new Error(`[Article Repo] getArticle: ${error.message}`);
    return data ? mapArticleRow(data) : null;
  }

  async listArticles(brandId: string): Promise<Article[]> {
    const { data, error } = await this.client
      .from("articles")
      .select("*")
      .eq("brand_id", brandId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`[Article Repo] listArticles: ${error.message}`);
    return (data ?? []).map(mapArticleRow);
  }

  async updateArticleStatus(articleId: string, brandId: string, status: Article["status"]): Promise<Article> {
    const { data, error } = await this.client
      .from("articles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .eq("brand_id", brandId)
      .select()
      .single();
    if (error) throw new Error(`[Article Repo] updateArticleStatus: ${error.message}`);
    return mapArticleRow(data);
  }

  async reviewArticle(articleId: string, versionId: string | null, status: Article["status"]): Promise<void> {
    const { error } = await this.client.rpc("review_article", {
      p_article_id: articleId,
      p_version_id: versionId,
      p_status: status,
    });
    if (error) throw new Error(`[Article Repo] reviewArticle: ${error.message}`);
  }

  private async validateBrandRefs(content: ArticleEnvelope, brandId: string): Promise<void> {
    const collectRefs = (blocks: ArticleBlock[] | undefined, evRefs: string[], srcRefs: string[]) => {
      for (const b of blocks ?? []) {
        if (Array.isArray(b.evidenceRefs)) {
          for (const ref of b.evidenceRefs) {
            if (ref && isValidUuid(ref)) evRefs.push(ref);
          }
        }
        if (Array.isArray(b.sourceRefs)) {
          for (const ref of b.sourceRefs) {
            if (ref && isValidUuid(ref)) srcRefs.push(ref);
          }
        }
        if (b.children && Array.isArray(b.children)) {
          collectRefs(b.children, evRefs, srcRefs);
        }
      }
    };

    const rawEvidenceRefs: string[] = [];
    const rawSourceRefs: string[] = [];
    collectRefs(content.document?.blocks, rawEvidenceRefs, rawSourceRefs);

    const evidenceRefs = Array.from(new Set(rawEvidenceRefs));
    const sourceRefs = Array.from(new Set(rawSourceRefs));

    if (evidenceRefs.length > 0) {
      const { data: claims, error } = await this.client
        .from("evidence_claims")
        .select("id, brand_id")
        .in("id", evidenceRefs);
      if (error) throw new Error(`DB query error: ${error.message}`);
      if (!claims || claims.length !== evidenceRefs.length) {
        throw new Error("Missing, inaccessible, or foreign reference");
      }
      for (const claim of claims) {
        const err = assertSameBrandReference(brandId, claim.brand_id, "evidenceRefs");
        if (err) throw new Error(err.message);
      }
    }

    if (sourceRefs.length > 0) {
      const { data: chunks, error } = await this.client
        .from("knowledge_chunks")
        .select("id, brand_id")
        .in("id", sourceRefs);
      if (error) throw new Error(`DB query error: ${error.message}`);
      if (!chunks || chunks.length !== sourceRefs.length) {
        throw new Error("Missing, inaccessible, or foreign reference");
      }
      for (const chunk of chunks) {
        const err = assertSameBrandReference(brandId, chunk.brand_id, "sourceRefs");
        if (err) throw new Error(err.message);
      }
    }
  }

  async autosaveWorkingDocument(
    articleId: string, brandId: string, organizationId: string,
    content: ArticleEnvelope, userId: string
  ): Promise<ArticleWorkingDocument> {
    await this.validateBrandRefs(content, brandId);
    const { data: existing } = await this.client
      .from("article_working_documents")
      .select("autosave_seq")
      .eq("article_id", articleId)
      .maybeSingle();

    const nextSeq = ((existing?.autosave_seq as number) ?? 0) + 1;

    const { data, error } = await this.client
      .from("article_working_documents")
      .upsert(
        {
          article_id: articleId,
          organization_id: organizationId,
          brand_id: brandId,
          content: content as unknown as Record<string, unknown>,
          last_saved_by: userId,
          saved_at: new Date().toISOString(),
          autosave_seq: nextSeq,
        },
        { onConflict: "article_id" }
      )
      .select()
      .single();
    if (error) throw new Error(`[Article Repo] autosaveWorkingDocument: ${error.message}`);
    return mapWorkingDocRow(data);
  }

  async getWorkingDocument(articleId: string, brandId: string): Promise<ArticleWorkingDocument | null> {
    const { data, error } = await this.client
      .from("article_working_documents")
      .select("*")
      .eq("article_id", articleId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (error) throw new Error(`[Article Repo] getWorkingDocument: ${error.message}`);
    return data ? mapWorkingDocRow(data) : null;
  }

  async createVersion(
    articleId: string, brandId: string, organizationId: string,
    content: ArticleEnvelope, label: string, userId: string
  ): Promise<ArticleVersion> {
    await this.validateBrandRefs(content, brandId);
    const { data, error } = await this.client
      .from("article_versions")
      .insert({
        article_id: articleId,
        organization_id: organizationId,
        brand_id: brandId,
        label,
        content: content as unknown as Record<string, unknown>,
        schema_version: content.schemaVersion,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(`[Article Repo] createVersion: ${error.message}`);
    return mapVersionRow(data);
  }

  async listVersions(articleId: string, brandId: string): Promise<ArticleVersion[]> {
    const { data, error } = await this.client
      .from("article_versions")
      .select("*")
      .eq("article_id", articleId)
      .eq("brand_id", brandId)
      .order("version_number", { ascending: false });
    if (error) throw new Error(`[Article Repo] listVersions: ${error.message}`);
    return (data ?? []).map(mapVersionRow);
  }

  async getVersion(versionId: string, brandId: string, articleId?: string): Promise<ArticleVersion | null> {
    let query = this.client
      .from("article_versions")
      .select("*")
      .eq("id", versionId)
      .eq("brand_id", brandId);
    if (articleId) query = query.eq("article_id", articleId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`[Article Repo] getVersion: ${error.message}`);
    return data ? mapVersionRow(data) : null;
  }

  async restoreVersion(
    articleId: string, brandId: string, organizationId: string,
    versionId: string, userId: string
  ): Promise<ArticleWorkingDocument> {
    // Must verify version belongs to the SAME article
    const version = await this.getVersion(versionId, brandId, articleId);
    if (!version) throw new Error("Version not found, unauthorized, or does not belong to this article");
    const doc = await this.autosaveWorkingDocument(
      articleId, brandId, organizationId, version.content, userId
    );
    await this.recordBlockOperation({
      articleId, brandId, organizationId,
      blockId: "00000000-0000-4000-8000-000000000000",
      operationType: "restore",
      blockBefore: undefined,
      blockAfter: undefined,
      aiTaskCode: undefined,
      aiModelHint: undefined,
      aiPromptSummary: `Restored from version ${version.versionNumber}: ${version.label}`,
      performedBy: userId,
    });
    return doc;
  }

  async recordBlockOperation(op: Omit<ContentBlockOperation, "id" | "performedAt">): Promise<ContentBlockOperation> {
    const { data, error } = await this.client
      .from("content_block_operations")
      .insert({
        article_id: op.articleId,
        organization_id: op.organizationId,
        brand_id: op.brandId,
        block_id: op.blockId,
        operation_type: op.operationType,
        block_before: op.blockBefore ?? null,
        block_after: op.blockAfter ?? null,
        ai_task_code: op.aiTaskCode ?? null,
        ai_model_hint: op.aiModelHint ?? null,
        ai_prompt_summary: op.aiPromptSummary ?? null,
        performed_by: op.performedBy,
      })
      .select()
      .single();
    if (error) throw new Error(`[Article Repo] recordBlockOperation: ${error.message}`);
    return mapBlockOpRow(data);
  }

  async listBlockOperations(articleId: string, brandId: string): Promise<ContentBlockOperation[]> {
    const { data, error } = await this.client
      .from("content_block_operations")
      .select("*")
      .eq("article_id", articleId)
      .eq("brand_id", brandId)
      .order("performed_at", { ascending: true });
    if (error) throw new Error(`[Article Repo] listBlockOperations: ${error.message}`);
    return (data ?? []).map(mapBlockOpRow);
  }

  async replaceBlock(
    articleId: string, brandId: string, organizationId: string,
    blockId: string, newBlock: ArticleBlock, userId: string,
    aiTaskCode?: string, aiModelHint?: string, aiPromptSummary?: string
  ): Promise<ArticleWorkingDocument> {
    // Enforce: newBlock.id must equal blockId (preserve stable UUID)
    if (newBlock.id !== blockId) {
      throw new Error(`Block replacement id mismatch: newBlock.id '${newBlock.id}' must equal target blockId '${blockId}'`);
    }

    const workingDoc = await this.getWorkingDocument(articleId, brandId);
    if (!workingDoc) throw new Error("Working document not found");

    const blocks = workingDoc.content.document.blocks;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) throw new Error(`Block ${blockId} not found`);

    const blockBefore = blocks[idx];
    const updatedBlocks = [...blocks];
    updatedBlocks[idx] = {
      ...newBlock,
      id: blockId, // double-enforce
      provenance: {
        ...newBlock.provenance,
        lastModifiedBy: userId,
        lastModifiedAt: new Date().toISOString(),
        aiGenerated: Boolean(aiTaskCode),
        aiTaskCode,
        aiModelHint,
      },
    };

    const updatedContent: ArticleEnvelope = {
      ...workingDoc.content,
      document: { blocks: updatedBlocks },
    };


    const updatedDoc = await this.autosaveWorkingDocument(
      articleId, brandId, organizationId, updatedContent, userId
    );

    await this.recordBlockOperation({
      articleId, brandId, organizationId,
      blockId,
      operationType: (aiTaskCode ? "ai_replace" : "update") as BlockOperationType,
      blockBefore,
      blockAfter: updatedBlocks[idx],
      aiTaskCode,
      aiModelHint,
      aiPromptSummary,
      performedBy: userId,
    });

    return updatedDoc;
  }
}

// ============================================================================
// Row mappers
// ============================================================================

function mapArticleRow(row: Record<string, unknown>): Article {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    brandId: row.brand_id as string,
    websiteId: row.website_id as string | undefined,
    schemaVersion: row.schema_version as string,
    status: row.status as Article["status"],
    title: row.title as string,
    slug: row.slug as string,
    locale: row.locale as string,
    seo: (row.seo as Record<string, unknown>) ?? {},
    geo: (row.geo as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    sources: (row.sources as unknown[]) ?? [],
    relationships: (row.relationships as unknown[]) ?? [],
    createdBy: row.created_by as string,
    approvedBy: row.approved_by as string | undefined,
    approvedVersionId: row.approved_version_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapWorkingDocRow(row: Record<string, unknown>): ArticleWorkingDocument {
  return {
    id: row.id as string,
    articleId: row.article_id as string,
    organizationId: row.organization_id as string,
    brandId: row.brand_id as string,
    content: row.content as ArticleEnvelope,
    lastSavedBy: row.last_saved_by as string,
    savedAt: row.saved_at as string,
    autosaveSeq: row.autosave_seq as number,
  };
}

function mapVersionRow(row: Record<string, unknown>): ArticleVersion {
  return {
    id: row.id as string,
    articleId: row.article_id as string,
    organizationId: row.organization_id as string,
    brandId: row.brand_id as string,
    versionNumber: row.version_number as number,
    label: row.label as string,
    content: row.content as ArticleEnvelope,
    schemaVersion: row.schema_version as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

function mapBlockOpRow(row: Record<string, unknown>): ContentBlockOperation {
  return {
    id: row.id as string,
    articleId: row.article_id as string,
    organizationId: row.organization_id as string,
    brandId: row.brand_id as string,
    blockId: row.block_id as string,
    operationType: row.operation_type as BlockOperationType,
    blockBefore: row.block_before as ArticleBlock | undefined,
    blockAfter: row.block_after as ArticleBlock | undefined,
    aiTaskCode: row.ai_task_code as string | undefined,
    aiModelHint: row.ai_model_hint as string | undefined,
    aiPromptSummary: row.ai_prompt_summary as string | undefined,
    performedBy: row.performed_by as string,
    performedAt: row.performed_at as string,
  };
}

// ============================================================================
// Factory
// ============================================================================

let _demoRepo: InMemoryArticleRepository | null = null;

export function getArticleRepository(accessToken?: string): IArticleRepository {
  if (isLiveSupabaseConfigured() && accessToken) {
    return new SupabaseArticleRepository(accessToken);
  }
  if (!_demoRepo) _demoRepo = new InMemoryArticleRepository();
  return _demoRepo;
}
