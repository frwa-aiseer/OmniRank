import { SupabaseClient } from "@supabase/supabase-js";
import {
  KnowledgeSource,
  KnowledgeDocument,
  KnowledgeChunk,
  EvidenceSource,
  EvidenceClaim,
  EvidenceVerificationStatus,
  SourceType
} from "../../types/index.ts";
import { getAdminSupabaseClient, isLiveSupabaseConfigured } from "../supabase/client.ts";

export interface ChunkSimilarityResult {
  chunk: KnowledgeChunk;
  similarity: number;
}

export interface IBrandBrainRepository {
  saveSource(source: KnowledgeSource): Promise<KnowledgeSource>;
  getSource(sourceId: string, brandId: string): Promise<KnowledgeSource | null>;
  findMatchingSource(brandId: string, name: string, type: SourceType): Promise<KnowledgeSource | null>;
  listSources(brandId: string): Promise<KnowledgeSource[]>;

  saveDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument>;
  getDocument(documentId: string, brandId: string): Promise<KnowledgeDocument | null>;
  findDocumentByHash(brandId: string, contentHash: string): Promise<KnowledgeDocument | null>;
  findLatestDocumentBySource(brandId: string, sourceId: string): Promise<KnowledgeDocument | null>;
  listDocuments(brandId: string): Promise<KnowledgeDocument[]>;
  deleteDocument(documentId: string, brandId: string): Promise<boolean>;

  saveChunks(chunks: KnowledgeChunk[]): Promise<void>;
  listChunks(brandId: string, documentId?: string): Promise<KnowledgeChunk[]>;
  querySimilarChunks(
    brandId: string,
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    organizationId?: string
  ): Promise<ChunkSimilarityResult[]>;

  saveEvidenceSource(source: EvidenceSource): Promise<EvidenceSource>;
  listEvidenceSources(brandId: string): Promise<EvidenceSource[]>;

  saveEvidenceClaims(claims: EvidenceClaim[]): Promise<void>;
  listEvidenceClaims(brandId: string): Promise<EvidenceClaim[]>;
  updateClaimVerification(
    claimId: string,
    brandId: string,
    status: EvidenceVerificationStatus,
    verifiedBy?: string
  ): Promise<EvidenceClaim>;
}

/**
 * SupabaseBrandBrainRepository
 * Persistent PostgreSQL & pgvector implementation.
 */
export class SupabaseBrandBrainRepository implements IBrandBrainRepository {
  private client: SupabaseClient;

  constructor(customClient?: SupabaseClient) {
    this.client = customClient || getAdminSupabaseClient();
  }

  async saveSource(source: KnowledgeSource): Promise<KnowledgeSource> {
    const { data, error } = await this.client
      .from("knowledge_sources")
      .upsert({
        id: source.id,
        brand_id: source.brandId,
        organization_id: source.organizationId,
        name: source.name,
        type: source.type,
        source_url: source.sourceUrl,
        trust_level: source.trustLevel,
        status: source.status,
        config: source.config || {},
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Repository] saveSource failed: ${error.message}`);
    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      name: data.name,
      type: data.type,
      sourceUrl: data.source_url,
      trustLevel: data.trust_level,
      status: data.status,
      config: data.config,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async getSource(sourceId: string, brandId: string): Promise<KnowledgeSource | null> {
    const { data, error } = await this.client
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .eq("brand_id", brandId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Repository] getSource failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      name: data.name,
      type: data.type,
      sourceUrl: data.source_url,
      trustLevel: data.trust_level,
      status: data.status,
      config: data.config,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async findMatchingSource(brandId: string, name: string, type: SourceType): Promise<KnowledgeSource | null> {
    const { data, error } = await this.client
      .from("knowledge_sources")
      .select("*")
      .eq("brand_id", brandId)
      .eq("name", name)
      .eq("type", type)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Repository] findMatchingSource failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      name: data.name,
      type: data.type,
      sourceUrl: data.source_url,
      trustLevel: data.trust_level,
      status: data.status,
      config: data.config,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async listSources(brandId: string): Promise<KnowledgeSource[]> {
    const { data, error } = await this.client
      .from("knowledge_sources")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`[Supabase Repository] listSources failed: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      organizationId: row.organization_id,
      name: row.name,
      type: row.type,
      sourceUrl: row.source_url,
      trustLevel: row.trust_level,
      status: row.status,
      config: row.config,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async saveDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const { data, error } = await this.client
      .from("knowledge_documents")
      .upsert({
        id: doc.id,
        brand_id: doc.brandId,
        organization_id: doc.organizationId,
        source_id: doc.sourceId,
        title: doc.title,
        url: doc.url,
        file_type: doc.fileType,
        storage_key: doc.storageKey,
        file_size_bytes: doc.fileSizeBytes,
        content_hash: doc.contentHash,
        revision: doc.revision || 1,
        extracted_text: doc.extractedText,
        document_metadata: doc.documentMetadata || {},
        parsing_status: doc.parsingStatus,
        trust_level: doc.trustLevel,
        classification: doc.classification,
        chunk_count: doc.chunkCount,
        has_untrusted_directives: doc.hasUntrustedDirectives,
        sanitization_notes: doc.sanitizationNotes,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Repository] saveDocument failed: ${error.message}`);
    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      sourceId: data.source_id,
      title: data.title,
      url: data.url,
      fileType: data.file_type,
      storageKey: data.storage_key,
      fileSizeBytes: data.file_size_bytes,
      contentHash: data.content_hash,
      revision: data.revision,
      extractedText: data.extracted_text,
      documentMetadata: data.document_metadata,
      parsingStatus: data.parsing_status,
      trustLevel: data.trust_level,
      classification: data.classification,
      chunkCount: data.chunk_count,
      hasUntrustedDirectives: data.has_untrusted_directives,
      sanitizationNotes: data.sanitization_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async getDocument(documentId: string, brandId: string): Promise<KnowledgeDocument | null> {
    const { data, error } = await this.client
      .from("knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .eq("brand_id", brandId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Repository] getDocument failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      sourceId: data.source_id,
      title: data.title,
      url: data.url,
      fileType: data.file_type,
      storageKey: data.storage_key,
      fileSizeBytes: data.file_size_bytes,
      contentHash: data.content_hash,
      revision: data.revision,
      extractedText: data.extracted_text,
      documentMetadata: data.document_metadata,
      parsingStatus: data.parsing_status,
      trustLevel: data.trust_level,
      classification: data.classification,
      chunkCount: data.chunk_count,
      hasUntrustedDirectives: data.has_untrusted_directives,
      sanitizationNotes: data.sanitization_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async findDocumentByHash(brandId: string, contentHash: string): Promise<KnowledgeDocument | null> {
    const { data, error } = await this.client
      .from("knowledge_documents")
      .select("*")
      .eq("brand_id", brandId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Repository] findDocumentByHash failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      sourceId: data.source_id,
      title: data.title,
      url: data.url,
      fileType: data.file_type,
      storageKey: data.storage_key,
      fileSizeBytes: data.file_size_bytes,
      contentHash: data.content_hash,
      revision: data.revision,
      extractedText: data.extracted_text,
      documentMetadata: data.document_metadata,
      parsingStatus: data.parsing_status,
      trustLevel: data.trust_level,
      classification: data.classification,
      chunkCount: data.chunk_count,
      hasUntrustedDirectives: data.has_untrusted_directives,
      sanitizationNotes: data.sanitization_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async findLatestDocumentBySource(brandId: string, sourceId: string): Promise<KnowledgeDocument | null> {
    const { data, error } = await this.client
      .from("knowledge_documents")
      .select("*")
      .eq("brand_id", brandId)
      .eq("source_id", sourceId)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Repository] findLatestDocumentBySource failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      sourceId: data.source_id,
      title: data.title,
      url: data.url,
      fileType: data.file_type,
      storageKey: data.storage_key,
      fileSizeBytes: data.file_size_bytes,
      contentHash: data.content_hash,
      revision: data.revision,
      extractedText: data.extracted_text,
      documentMetadata: data.document_metadata,
      parsingStatus: data.parsing_status,
      trustLevel: data.trust_level,
      classification: data.classification,
      chunkCount: data.chunk_count,
      hasUntrustedDirectives: data.has_untrusted_directives,
      sanitizationNotes: data.sanitization_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async listDocuments(brandId: string): Promise<KnowledgeDocument[]> {
    const { data, error } = await this.client
      .from("knowledge_documents")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`[Supabase Repository] listDocuments failed: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      organizationId: row.organization_id,
      sourceId: row.source_id,
      title: row.title,
      url: row.url,
      fileType: row.file_type,
      storageKey: row.storage_key,
      fileSizeBytes: row.file_size_bytes,
      contentHash: row.content_hash,
      revision: row.revision,
      extractedText: row.extracted_text,
      documentMetadata: row.document_metadata,
      parsingStatus: row.parsing_status,
      trustLevel: row.trust_level,
      classification: row.classification,
      chunkCount: row.chunk_count,
      hasUntrustedDirectives: row.has_untrusted_directives,
      sanitizationNotes: row.sanitization_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async deleteDocument(documentId: string, brandId: string): Promise<boolean> {
    const { error } = await this.client
      .from("knowledge_documents")
      .delete()
      .eq("id", documentId)
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Repository] deleteDocument failed: ${error.message}`);
    return true;
  }

  async saveChunks(chunks: KnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const rows = chunks.map((chk) => ({
      id: chk.id,
      brand_id: chk.brandId,
      organization_id: chk.organizationId,
      document_id: chk.documentId,
      source_id: chk.sourceId,
      chunk_index: chk.chunkIndex,
      content: chk.content,
      content_hash: chk.contentHash,
      token_count: chk.tokenCount,
      heading_hierarchy: chk.headingHierarchy,
      chunk_type: chk.chunkType,
      embedding: chk.embedding,
      metadata: chk.metadata || {},
      trust_level: chk.trustLevel
    }));

    const { error } = await this.client.from("knowledge_chunks").upsert(rows);
    if (error) throw new Error(`[Supabase Repository] saveChunks failed: ${error.message}`);
  }

  async listChunks(brandId: string, documentId?: string): Promise<KnowledgeChunk[]> {
    let query = this.client.from("knowledge_chunks").select("*").eq("brand_id", brandId);
    if (documentId) {
      query = query.eq("document_id", documentId);
    }
    const { data, error } = await query.order("chunk_index", { ascending: true });
    if (error) throw new Error(`[Supabase Repository] listChunks failed: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      organizationId: row.organization_id,
      documentId: row.document_id,
      sourceId: row.source_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      contentHash: row.content_hash,
      tokenCount: row.token_count,
      headingHierarchy: row.heading_hierarchy,
      chunkType: row.chunk_type,
      embedding: typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding,
      metadata: row.metadata,
      trustLevel: row.trust_level,
      createdAt: row.created_at
    }));
  }

  async querySimilarChunks(
    brandId: string,
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    _organizationId?: string
  ): Promise<ChunkSimilarityResult[]> {
    // Call hardened SECURITY DEFINER pgvector match function
    const { data, error } = await this.client.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_brand_id: brandId
    });

    if (error) {
      throw new Error(`[Supabase Repository] querySimilarChunks pgvector error: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      chunk: {
        id: row.id,
        brandId,
        documentId: row.document_id,
        sourceId: row.source_id,
        chunkIndex: 0,
        content: row.content,
        contentHash: "",
        tokenCount: 0,
        headingHierarchy: row.heading_hierarchy || [],
        chunkType: "text",
        embedding: [],
        metadata: {},
        trustLevel: row.trust_level,
        createdAt: new Date().toISOString()
      },
      similarity: row.similarity
    }));
  }

  async saveEvidenceSource(source: EvidenceSource): Promise<EvidenceSource> {
    const { data, error } = await this.client
      .from("evidence_sources")
      .upsert({
        id: source.id,
        brand_id: source.brandId,
        organization_id: source.organizationId,
        name: source.name,
        url: source.url,
        publisher: source.publisher,
        publication_date: source.publicationDate,
        trust_score: source.trustScore,
        is_primary_source: source.isPrimarySource,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Repository] saveEvidenceSource failed: ${error.message}`);
    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      name: data.name,
      url: data.url,
      publisher: data.publisher,
      publicationDate: data.publication_date,
      trustScore: data.trust_score,
      isPrimarySource: data.is_primary_source,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async listEvidenceSources(brandId: string): Promise<EvidenceSource[]> {
    const { data, error } = await this.client
      .from("evidence_sources")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`[Supabase Repository] listEvidenceSources failed: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      organizationId: row.organization_id,
      name: row.name,
      url: row.url,
      publisher: row.publisher,
      publicationDate: row.publication_date,
      trustScore: row.trust_score,
      isPrimarySource: row.is_primary_source,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async saveEvidenceClaims(claims: EvidenceClaim[]): Promise<void> {
    if (claims.length === 0) return;

    for (const claim of claims) {
      const { error: claimErr } = await this.client.from("evidence_claims").upsert({
        id: claim.id,
        brand_id: claim.brandId,
        organization_id: claim.organizationId,
        claim_text: claim.claimText,
        claim_type: claim.claimType,
        verification_status: claim.verificationStatus,
        confidence_score: claim.confidenceScore,
        extracted_entities: claim.extractedEntities || {},
        verified_by: claim.verifiedBy,
        verified_at: claim.verifiedAt,
        valid_from: claim.validFrom,
        valid_until: claim.validUntil,
        updated_at: new Date().toISOString()
      });
      if (claimErr) throw new Error(`[Supabase Repository] saveEvidenceClaims claim error: ${claimErr.message}`);

      if (claim.sources && claim.sources.length > 0) {
        const sourceRows = claim.sources.map((s) => ({
          id: s.id,
          claim_id: claim.id,
          source_id: s.sourceId,
          document_id: s.documentId,
          chunk_id: s.chunkId,
          exact_quote: s.exactQuote,
          page_or_section: s.pageOrSection
        }));
        const { error: srcErr } = await this.client.from("evidence_claim_sources").upsert(sourceRows);
        if (srcErr) throw new Error(`[Supabase Repository] saveEvidenceClaims sources error: ${srcErr.message}`);
      }
    }
  }

  async listEvidenceClaims(brandId: string): Promise<EvidenceClaim[]> {
    const { data: claimsData, error: claimErr } = await this.client
      .from("evidence_claims")
      .select("*, evidence_claim_sources(*)")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (claimErr) throw new Error(`[Supabase Repository] listEvidenceClaims failed: ${claimErr.message}`);

    return (claimsData || []).map((row: any) => ({
      id: row.id,
      brandId: row.brand_id,
      organizationId: row.organization_id,
      claimText: row.claim_text,
      claimType: row.claim_type,
      verificationStatus: row.verification_status,
      confidenceScore: parseFloat(row.confidence_score),
      extractedEntities: row.extracted_entities,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sources: (row.evidence_claim_sources || []).map((s: any) => ({
        id: s.id,
        claimId: s.claim_id,
        sourceId: s.source_id,
        documentId: s.document_id,
        chunkId: s.chunk_id,
        exactQuote: s.exact_quote,
        pageOrSection: s.page_or_section,
        createdAt: s.created_at
      }))
    }));
  }

  async updateClaimVerification(
    claimId: string,
    brandId: string,
    status: EvidenceVerificationStatus,
    verifiedBy?: string
  ): Promise<EvidenceClaim> {
    const verifiedAt = status === "verified" ? new Date().toISOString() : undefined;
    const { data, error } = await this.client
      .from("evidence_claims")
      .update({
        verification_status: status,
        verified_by: verifiedBy,
        verified_at: verifiedAt,
        updated_at: new Date().toISOString()
      })
      .eq("id", claimId)
      .eq("brand_id", brandId)
      .select("*, evidence_claim_sources(*)")
      .single();

    if (error) throw new Error(`[Supabase Repository] updateClaimVerification failed: ${error.message}`);

    return {
      id: data.id,
      brandId: data.brand_id,
      organizationId: data.organization_id,
      claimText: data.claim_text,
      claimType: data.claim_type,
      verificationStatus: data.verification_status,
      confidenceScore: parseFloat(data.confidence_score),
      extractedEntities: data.extracted_entities,
      verifiedBy: data.verified_by,
      verifiedAt: data.verified_at,
      validFrom: data.valid_from,
      validUntil: data.valid_until,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      sources: (data.evidence_claim_sources || []).map((s: any) => ({
        id: s.id,
        claimId: s.claim_id,
        sourceId: s.source_id,
        documentId: s.document_id,
        chunkId: s.chunk_id,
        exactQuote: s.exact_quote,
        pageOrSection: s.page_or_section,
        createdAt: s.created_at
      }))
    };
  }
}

/**
 * InMemoryBrandBrainRepository
 * Clearly labeled test & offline development adapter with strict brand isolation
 * and deterministic cosine-similarity vector retrieval.
 */
export class InMemoryBrandBrainRepository implements IBrandBrainRepository {
  private sources: Map<string, KnowledgeSource> = new Map();
  private documents: Map<string, KnowledgeDocument> = new Map();
  private chunks: Map<string, KnowledgeChunk> = new Map();
  private evidenceSources: Map<string, EvidenceSource> = new Map();
  private evidenceClaims: Map<string, EvidenceClaim> = new Map();

  async saveSource(source: KnowledgeSource): Promise<KnowledgeSource> {
    this.sources.set(source.id, { ...source, updatedAt: new Date().toISOString() });
    return this.sources.get(source.id)!;
  }

  async getSource(sourceId: string, brandId: string): Promise<KnowledgeSource | null> {
    const src = this.sources.get(sourceId);
    return src && src.brandId === brandId ? src : null;
  }

  async findMatchingSource(brandId: string, name: string, type: SourceType): Promise<KnowledgeSource | null> {
    for (const src of this.sources.values()) {
      if (src.brandId === brandId && src.name === name && src.type === type) {
        return src;
      }
    }
    return null;
  }

  async listSources(brandId: string): Promise<KnowledgeSource[]> {
    return Array.from(this.sources.values()).filter((s) => s.brandId === brandId);
  }

  async saveDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.documents.set(doc.id, { ...doc, updatedAt: new Date().toISOString() });
    return this.documents.get(doc.id)!;
  }

  async getDocument(documentId: string, brandId: string): Promise<KnowledgeDocument | null> {
    const doc = this.documents.get(documentId);
    return doc && doc.brandId === brandId ? doc : null;
  }

  async findDocumentByHash(brandId: string, contentHash: string): Promise<KnowledgeDocument | null> {
    for (const doc of this.documents.values()) {
      if (doc.brandId === brandId && doc.contentHash === contentHash) {
        return doc;
      }
    }
    return null;
  }

  async findLatestDocumentBySource(brandId: string, sourceId: string): Promise<KnowledgeDocument | null> {
    let latest: KnowledgeDocument | null = null;
    for (const doc of this.documents.values()) {
      if (doc.brandId === brandId && doc.sourceId === sourceId) {
        if (!latest || (doc.revision || 1) > (latest.revision || 1)) {
          latest = doc;
        }
      }
    }
    return latest;
  }

  async listDocuments(brandId: string): Promise<KnowledgeDocument[]> {
    return Array.from(this.documents.values()).filter((d) => d.brandId === brandId);
  }

  async deleteDocument(documentId: string, brandId: string): Promise<boolean> {
    const doc = this.documents.get(documentId);
    if (!doc || doc.brandId !== brandId) return false;

    for (const [id, chk] of this.chunks.entries()) {
      if (chk.documentId === documentId && chk.brandId === brandId) {
        this.chunks.delete(id);
      }
    }
    this.documents.delete(documentId);
    return true;
  }

  async saveChunks(chunks: KnowledgeChunk[]): Promise<void> {
    for (const chk of chunks) {
      this.chunks.set(chk.id, chk);
    }
  }

  async listChunks(brandId: string, documentId?: string): Promise<KnowledgeChunk[]> {
    return Array.from(this.chunks.values()).filter(
      (c) => c.brandId === brandId && (!documentId || c.documentId === documentId)
    );
  }

  async querySimilarChunks(
    brandId: string,
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    organizationId?: string
  ): Promise<ChunkSimilarityResult[]> {
    const results: ChunkSimilarityResult[] = [];

    // Filter by brand (and organization if specified)
    const brandChunks = Array.from(this.chunks.values()).filter((c) => {
      if (c.brandId !== brandId) return false;
      if (organizationId && c.organizationId && c.organizationId !== organizationId) return false;
      return true;
    });

    for (const chunk of brandChunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;
      const sim = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (sim >= threshold) {
        results.push({ chunk, similarity: sim });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async saveEvidenceSource(source: EvidenceSource): Promise<EvidenceSource> {
    this.evidenceSources.set(source.id, { ...source, updatedAt: new Date().toISOString() });
    return this.evidenceSources.get(source.id)!;
  }

  async listEvidenceSources(brandId: string): Promise<EvidenceSource[]> {
    return Array.from(this.evidenceSources.values()).filter((e) => e.brandId === brandId);
  }

  async saveEvidenceClaims(claims: EvidenceClaim[]): Promise<void> {
    for (const clm of claims) {
      this.evidenceClaims.set(clm.id, { ...clm, updatedAt: new Date().toISOString() });
    }
  }

  async listEvidenceClaims(brandId: string): Promise<EvidenceClaim[]> {
    return Array.from(this.evidenceClaims.values()).filter((c) => c.brandId === brandId);
  }

  async updateClaimVerification(
    claimId: string,
    brandId: string,
    status: EvidenceVerificationStatus,
    verifiedBy?: string
  ): Promise<EvidenceClaim> {
    const claim = this.evidenceClaims.get(claimId);
    if (!claim || claim.brandId !== brandId) {
      throw new Error(`Claim ${claimId} not found for brand ${brandId}`);
    }

    claim.verificationStatus = status;
    if (status === "verified") {
      claim.verifiedBy = verifiedBy || "reviewer";
      claim.verifiedAt = new Date().toISOString();
    }
    claim.updatedAt = new Date().toISOString();
    return claim;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

/**
 * Repository Factory
 */
export function createBrandBrainRepository(): IBrandBrainRepository {
  if (isLiveSupabaseConfigured()) {
    return new SupabaseBrandBrainRepository();
  }
  return new InMemoryBrandBrainRepository();
}
