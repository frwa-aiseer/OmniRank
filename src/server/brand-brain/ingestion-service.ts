import { randomUUID, createHash } from "crypto";
import {
  KnowledgeSource,
  KnowledgeDocument,
  KnowledgeChunk,
  EvidenceSource,
  EvidenceClaim,
  IngestionInput,
  IngestionResult,
  SemanticSearchResult,
  TrustLevel,
  DocumentClassification,
  EvidenceVerificationStatus,
  SourceType,
  DocumentFileType
} from "../../types/index.ts";
import { r2Storage } from "../storage/r2.ts";
import { ContentSanitizer } from "./sanitizer.ts";
import { DocumentParsers } from "./parsers.ts";
import { SemanticChunker } from "./chunker.ts";
import { EvidenceExtractor } from "./evidence-extractor.ts";
import { safeFetchWebsite } from "./ssrf.ts";
import {
  EmbeddingProvider,
  DeterministicEmbeddingProvider,
  defaultEmbeddingProvider
} from "./embeddings.ts";
import {
  IBrandBrainRepository,
  createBrandBrainRepository,
  InMemoryBrandBrainRepository
} from "./repository.ts";
import { tenancyRepo, TenancyAuthorizationError } from "../auth/tenancy.ts";

export class BrandBrainIngestionService {
  private repo: IBrandBrainRepository;
  private chunker = new SemanticChunker(400, 50);
  private embeddingProvider: EmbeddingProvider;

  // Local caching layer for synchronous accessors while keeping repository as primary persistent store
  private localSources: Map<string, KnowledgeSource> = new Map();
  private localDocuments: Map<string, KnowledgeDocument> = new Map();
  private localChunks: Map<string, KnowledgeChunk> = new Map();
  private localEvidenceSources: Map<string, EvidenceSource> = new Map();
  private localEvidenceClaims: Map<string, EvidenceClaim> = new Map();

  constructor(
    embeddingProvider: EmbeddingProvider = defaultEmbeddingProvider,
    repository?: IBrandBrainRepository
  ) {
    this.embeddingProvider = embeddingProvider;
    this.repo = repository || createBrandBrainRepository();
    this.seedDefaultKnowledge();
  }

  /**
   * Resolves and validates the organization ID for a given brand.
   * Throws TenancyAuthorizationError on cross-tenant mismatch.
   */
  private resolveTenantOrganization(brandId: string, requestedOrgId?: string): string {
    const actualOrgId = tenancyRepo.resolveBrandOrganization(brandId);
    if (requestedOrgId && actualOrgId && requestedOrgId !== actualOrgId) {
      throw new TenancyAuthorizationError(
        `Cross-tenant violation: Brand ${brandId} belongs to organization ${actualOrgId}, not ${requestedOrgId}`,
        "FORBIDDEN"
      );
    }
    return actualOrgId || requestedOrgId || "org-001";
  }

  /**
   * Main Ingestion Pipeline:
   * 1. Dynamic Tenancy Resolution & Validation
   * 2. Content Hashing (SHA-256) & Brand-Scoped Deduplication
   * 3. SSRF-Safe URL Ingestion or Multi-Format Binary Parsing (PDF, DOCX, XLSX, CSV, MD, HTML, TXT)
   * 4. Content Sanitization (Prompt injection defense & command neutralization)
   * 5. Document Revision Management (if source changed)
   * 6. Storage in Cloudflare R2 / LocalDevStorage with dynamic tenant path
   * 7. Trust Level Taxonomy Resolution
   * 8. Semantic Chunking & Vector Embeddings Generation (768-dim)
   * 9. Evidence Candidate Extraction (all claims start unverified)
   * 10. PostgreSQL / Supabase & pgvector Persistence
   */
  async ingestContent(
    input: IngestionInput,
    user?: { id: string; name: string }
  ): Promise<IngestionResult> {
    const brandId = input.brandId;
    const organizationId = this.resolveTenantOrganization(brandId, input.organizationId);

    // 1. Resolve source text and binary buffer
    let rawBuffer: Buffer;
    let rawText: string;
    let fileType: DocumentFileType = input.fileType || (input.sourceType === "website" ? "html" : "note");

    // Handle live website ingestion with SSRF protection
    if (input.sourceType === "website" && input.sourceUrl && (!input.fileBufferOrText || input.fileBufferOrText.length === 0)) {
      const webResult = await safeFetchWebsite(input.sourceUrl);
      rawText = webResult.cleanText;
      rawBuffer = Buffer.from(webResult.bodyText, "utf-8");
      fileType = "html";
    } else {
      rawBuffer = Buffer.isBuffer(input.fileBufferOrText)
        ? input.fileBufferOrText
        : typeof input.fileBufferOrText === "string"
        ? Buffer.from(input.fileBufferOrText, "utf-8")
        : Buffer.from(input.fileBufferOrText);
      rawText = rawBuffer.toString("utf-8");
    }

    // 2. Content Hashing & Brand-Scoped Deduplication
    const contentHash = createHash("sha256").update(rawBuffer).digest("hex");

    const existingDoc = await this.repo.findDocumentByHash(brandId, contentHash);
    if (existingDoc) {
      const existingSource = (await this.repo.getSource(existingDoc.sourceId, brandId)) || {
        id: existingDoc.sourceId,
        brandId,
        organizationId,
        name: input.sourceName,
        type: input.sourceType,
        sourceUrl: input.sourceUrl,
        trustLevel: existingDoc.trustLevel,
        status: "active",
        createdAt: existingDoc.createdAt,
        updatedAt: existingDoc.updatedAt
      };
      const existingChunks = await this.repo.listChunks(brandId, existingDoc.id);
      const allClaims = await this.repo.listEvidenceClaims(brandId);
      const existingClaims = allClaims.filter((c) =>
        c.sources.some((s) => s.documentId === existingDoc.id)
      );

      return {
        source: existingSource,
        document: existingDoc,
        chunks: existingChunks,
        evidenceClaims: existingClaims,
        isDuplicate: true,
        sanitizationApplied: existingDoc.hasUntrustedDirectives
      };
    }

    // 3. Multi-Format Structured Parsing (PDF, DOCX, XLSX, CSV, MD, HTML, TXT)
    const parsed = await DocumentParsers.parseAsync(rawBuffer, fileType, input.fileName || input.sourceName);

    // 4. Sanitization & Untrusted Directives Defense
    const sanitization = ContentSanitizer.sanitize(parsed.extractedText);

    // 5. Trust Level Taxonomy Inference
    const brandRecord = tenancyRepo.getBrandRaw(brandId);
    const trustLevel =
      input.trustLevel ||
      this.inferTrustLevel(
        input.sourceType,
        input.sourceUrl,
        brandRecord?.primaryDomain
      );

    // 6. Source Registration / Lookup
    let source = await this.repo.findMatchingSource(brandId, input.sourceName, input.sourceType);
    if (!source) {
      const sourceId = `src-${randomUUID().slice(0, 8)}`;
      source = {
        id: sourceId,
        brandId,
        organizationId,
        name: input.sourceName,
        type: input.sourceType,
        sourceUrl: input.sourceUrl,
        trustLevel,
        status: "active",
        config: input.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      source = await this.repo.saveSource(source);
      this.localSources.set(source.id, source);
    }

    // 7. Check for source revision update (same source, updated content)
    const prevDoc = await this.repo.findLatestDocumentBySource(brandId, source.id);
    const revision = prevDoc ? (prevDoc.revision || 1) + 1 : 1;

    // 8. R2 Object Storage with Strict Tenant Path
    const storageKey = `tenants/${organizationId}/brands/${brandId}/docs/${contentHash.slice(0, 16)}.${fileType}`;
    await r2Storage.uploadObject({
      key: storageKey,
      body: rawBuffer,
      contentType: this.getMimeType(fileType),
      metadata: {
        organizationId,
        brandId,
        sourceName: input.sourceName,
        contentHash,
        revision: String(revision)
      }
    });

    // 9. Classification
    const classification =
      input.classification || this.autoClassifyDocument(parsed.title, sanitization.cleanText);

    // 10. Knowledge Document Registration
    const documentId = `doc-${randomUUID().slice(0, 8)}`;
    const newDoc: KnowledgeDocument = {
      id: documentId,
      brandId,
      organizationId,
      sourceId: source.id,
      title: parsed.title,
      url: input.sourceUrl,
      fileType,
      storageKey,
      fileSizeBytes: rawBuffer.byteLength,
      contentHash,
      revision,
      extractedText: sanitization.cleanText,
      documentMetadata: {
        ...parsed.documentMetadata,
        ...input.metadata,
        sanitizationNotes: sanitization.sanitizationNotes
      },
      parsingStatus: "parsed",
      trustLevel,
      classification,
      chunkCount: 0,
      hasUntrustedDirectives: sanitization.hasUntrustedDirectives,
      sanitizationNotes: sanitization.sanitizationNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 11. Semantic Chunking with Hierarchy
    const rawChunks = this.chunker.chunkDocument(sanitization.cleanText, {
      documentId,
      sourceId: source.id,
      title: parsed.title,
      trustLevel
    });
    newDoc.chunkCount = rawChunks.length;

    // Save Document in repository
    const savedDoc = await this.repo.saveDocument(newDoc);
    this.localDocuments.set(savedDoc.id, savedDoc);

    // 12. Vector Embeddings Generation (768-dim)
    // Check if any chunks can reuse embeddings from previous revisions with identical contentHash
    const prevChunks = prevDoc ? await this.repo.listChunks(brandId, prevDoc.id) : [];
    const prevChunkMap = new Map(prevChunks.map((c) => [c.contentHash, c.embedding]));

    const chunkTextsToEmbed: string[] = [];
    const chunkTextIndicesToEmbed: number[] = [];

    const generatedChunks: KnowledgeChunk[] = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const rc = rawChunks[i];
      const chunkId = `chk-${randomUUID().slice(0, 8)}`;

      const cachedEmbedding = prevChunkMap.get(rc.contentHash);
      const chunk: KnowledgeChunk = {
        id: chunkId,
        brandId,
        organizationId,
        documentId,
        sourceId: source.id,
        chunkIndex: rc.chunkIndex,
        content: rc.content,
        contentHash: rc.contentHash,
        tokenCount: rc.tokenCount,
        headingHierarchy: rc.headingHierarchy,
        chunkType: rc.chunkType,
        embedding: cachedEmbedding || [],
        metadata: rc.metadata,
        trustLevel,
        createdAt: new Date().toISOString()
      };
      generatedChunks.push(chunk);

      if (!cachedEmbedding || cachedEmbedding.length === 0) {
        chunkTextsToEmbed.push(`${rc.headingHierarchy.join(" > ")}\n${rc.content}`);
        chunkTextIndicesToEmbed.push(i);
      }
    }

    if (chunkTextsToEmbed.length > 0) {
      const newEmbeddings = await this.embeddingProvider.generateBatchEmbeddings(chunkTextsToEmbed);
      for (let j = 0; j < chunkTextsToEmbed.length; j++) {
        const chunkIndex = chunkTextIndicesToEmbed[j];
        generatedChunks[chunkIndex].embedding = newEmbeddings[j];
      }
    }

    // Save Chunks in repository
    await this.repo.saveChunks(generatedChunks);
    for (const chk of generatedChunks) {
      this.localChunks.set(chk.id, chk);
    }

    // 13. Evidence Candidates Extraction
    // Requirement 7: EVERY automatically extracted claim starts as "unverified".
    // 1P source may increase confidence/trust score, but does NOT make it verified.
    const generatedClaims: EvidenceClaim[] = [];
    const evidenceSourceId = `evs-${randomUUID().slice(0, 8)}`;
    const evSource: EvidenceSource = {
      id: evidenceSourceId,
      brandId,
      organizationId,
      name: source.name,
      url: source.sourceUrl,
      publisher: source.name,
      trustScore: trustLevel === "brand_authoritative" || trustLevel === "verified_1p" ? 95 : 75,
      isPrimarySource: trustLevel === "brand_authoritative" || trustLevel === "verified_1p",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.repo.saveEvidenceSource(evSource);
    this.localEvidenceSources.set(evSource.id, evSource);

    for (const rc of rawChunks) {
      const candidates = EvidenceExtractor.extractCandidatesFromChunk(
        rc,
        documentId,
        source.id,
        source.name,
        source.sourceUrl
      );

      for (const cand of candidates) {
        const claimId = `clm-${randomUUID().slice(0, 8)}`;
        const claim: EvidenceClaim = {
          id: claimId,
          brandId,
          organizationId,
          claimText: cand.claimText,
          claimType: cand.claimType,
          // CRITICAL: Always unverified until explicit human or policy approval
          verificationStatus: "unverified",
          confidenceScore: cand.confidenceScore,
          extractedEntities: cand.extractedEntities,
          sources: [
            {
              id: `cls-${randomUUID().slice(0, 8)}`,
              claimId,
              sourceId: evidenceSourceId,
              sourceName: source.name,
              sourceUrl: source.sourceUrl,
              documentId,
              exactQuote: cand.exactQuote,
              pageOrSection: cand.pageOrSection,
              createdAt: new Date().toISOString()
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        generatedClaims.push(claim);
      }
    }

    if (generatedClaims.length > 0) {
      await this.repo.saveEvidenceClaims(generatedClaims);
      for (const c of generatedClaims) {
        this.localEvidenceClaims.set(c.id, c);
      }
    }

    return {
      source,
      document: savedDoc,
      chunks: generatedChunks,
      evidenceClaims: generatedClaims,
      isDuplicate: false,
      sanitizationApplied: sanitization.hasUntrustedDirectives
    };
  }

  /**
   * Semantic Vector Search for Brand Knowledge with strict tenant/brand boundary.
   */
  async searchBrandKnowledge(
    brandId: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.3,
    organizationId?: string
  ): Promise<SemanticSearchResult[]> {
    if (!query || !query.trim()) return [];

    const queryEmbeddings = await this.embeddingProvider.generateBatchEmbeddings([query]);
    const queryEmbedding = queryEmbeddings[0];
    if (!queryEmbedding) return [];

    const similar = await this.repo.querySimilarChunks(
      brandId,
      queryEmbedding,
      threshold,
      limit,
      organizationId
    );

    return similar.map((item) => ({
      chunk: item.chunk,
      similarityScore: item.similarity,
      matchedQuery: query,
      documentTitle: String(item.chunk.metadata?.title || "Knowledge Document"),
      sourceName: String(item.chunk.metadata?.sourceName || "Knowledge Source"),
      trustLevel: item.chunk.trustLevel
    }));
  }

  /**
   * Correct Evidence Verification Workflow with Provenance (Requirement 7).
   */
  async verifyClaimAsync(
    brandId: string,
    claimId: string,
    status: EvidenceVerificationStatus,
    verifiedBy?: string
  ): Promise<EvidenceClaim> {
    const updated = await this.repo.updateClaimVerification(claimId, brandId, status, verifiedBy);
    this.localEvidenceClaims.set(updated.id, updated);
    return updated;
  }

  verifyClaim(
    brandId: string,
    claimId: string,
    status: EvidenceVerificationStatus,
    verifiedBy?: string
  ): EvidenceClaim {
    const claim = this.localEvidenceClaims.get(claimId);
    if (!claim || claim.brandId !== brandId) {
      throw new Error(`Claim ${claimId} not found for brand ${brandId}`);
    }
    claim.verificationStatus = status;
    if (status === "verified") {
      claim.verifiedBy = verifiedBy || "reviewer-system";
      claim.verifiedAt = new Date().toISOString();
    }
    claim.updatedAt = new Date().toISOString();
    // Persist asynchronously in background
    this.repo.updateClaimVerification(claimId, brandId, status, verifiedBy).catch(() => {});
    return claim;
  }

  async deleteDocument(brandId: string, documentId: string): Promise<boolean> {
    const ok = await this.repo.deleteDocument(documentId, brandId);
    this.localDocuments.delete(documentId);
    for (const [id, chk] of this.localChunks.entries()) {
      if (chk.documentId === documentId && chk.brandId === brandId) {
        this.localChunks.delete(id);
      }
    }
    return ok;
  }

  // --- Read-Only Query Accessors ---

  getSources(brandId: string): KnowledgeSource[] {
    return Array.from(this.localSources.values()).filter((s) => s.brandId === brandId);
  }

  async getSourcesAsync(brandId: string): Promise<KnowledgeSource[]> {
    return await this.repo.listSources(brandId);
  }

  getDocuments(brandId: string): KnowledgeDocument[] {
    return Array.from(this.localDocuments.values()).filter((d) => d.brandId === brandId);
  }

  async getDocumentsAsync(brandId: string): Promise<KnowledgeDocument[]> {
    return await this.repo.listDocuments(brandId);
  }

  getChunks(brandId: string, documentId?: string): KnowledgeChunk[] {
    return Array.from(this.localChunks.values()).filter(
      (c) => c.brandId === brandId && (!documentId || c.documentId === documentId)
    );
  }

  async getChunksAsync(brandId: string, documentId?: string): Promise<KnowledgeChunk[]> {
    return await this.repo.listChunks(brandId, documentId);
  }

  getEvidenceSources(brandId: string): EvidenceSource[] {
    return Array.from(this.localEvidenceSources.values()).filter((s) => s.brandId === brandId);
  }

  async getEvidenceSourcesAsync(brandId: string): Promise<EvidenceSource[]> {
    return await this.repo.listEvidenceSources(brandId);
  }

  getEvidenceClaims(brandId: string): EvidenceClaim[] {
    return Array.from(this.localEvidenceClaims.values()).filter((c) => c.brandId === brandId);
  }

  async getEvidenceClaimsAsync(brandId: string): Promise<EvidenceClaim[]> {
    return await this.repo.listEvidenceClaims(brandId);
  }

  // --- Trust Taxonomy & Helper Logic (Requirement 8) ---

  /**
   * Infers trust level without blindly assigning brand 1P to arbitrary external gov/edu hosts.
   */
  public inferTrustLevel(
    sourceType: SourceType,
    url?: string,
    brandPrimaryDomain?: string,
    competitorDomains: string[] = [],
    partnerDomains: string[] = []
  ): TrustLevel {
    if (sourceType === "manual_note") {
      return "brand_authoritative";
    }
    if (sourceType === "file_upload") {
      return "brand_authoritative";
    }

    if (url) {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        // 1. Matches Brand's own domain
        if (brandPrimaryDomain) {
          const cleanBrandDomain = brandPrimaryDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "");
          if (host === cleanBrandDomain || host.endsWith(`.${cleanBrandDomain}`)) {
            return "brand_authoritative";
          }
        }

        // 2. Matches Competitor
        if (competitorDomains.some((cd) => host === cd || host.endsWith(`.${cd}`))) {
          return "competitor";
        }

        // 3. Matches Partner
        if (partnerDomains.some((pd) => host === pd || host.endsWith(`.${pd}`))) {
          return "partner";
        }

        // 4. Institutional/Government/Academic domain (external authoritative, NOT brand 1p)
        if (host.endsWith(".gov") || host.endsWith(".mil") || host.endsWith(".edu")) {
          return "external_authoritative";
        }

        // 5. Crawled / external web sources
        if (sourceType === "website" || sourceType === "sitemap") {
          return "unverified_external";
        }
      } catch {
        return "untrusted_crawl";
      }
    }

    return "unverified_external";
  }

  private autoClassifyDocument(title: string, text: string): DocumentClassification {
    const lower = `${title} ${text.slice(0, 500)}`.toLowerCase();
    if (lower.includes("product") || lower.includes("features") || lower.includes("solution")) {
      return "product_doc";
    }
    if (lower.includes("architecture") || lower.includes("specification") || lower.includes("api") || lower.includes("latency")) {
      return "technical_spec";
    }
    if (lower.includes("case study") || lower.includes("customer") || lower.includes("saved") || lower.includes("increased revenue")) {
      return "customer_story";
    }
    if (lower.includes("policy") || lower.includes("compliance") || lower.includes("guidelines")) {
      return "policy";
    }
    if (lower.includes("competitor") || lower.includes("comparison") || lower.includes("vs")) {
      return "competitor_review";
    }
    if (lower.includes("whitepaper") || lower.includes("research") || lower.includes("report")) {
      return "whitepaper";
    }
    return "general";
  }

  private getMimeType(fileType: string): string {
    switch (fileType) {
      case "pdf":
        return "application/pdf";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "csv":
        return "text/csv";
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "md":
        return "text/markdown";
      case "html":
        return "text/html";
      case "txt":
      case "note":
      default:
        return "text/plain";
    }
  }

  private seedDefaultKnowledge() {
    const brandId = "brand-001";
    const organizationId = "org-001";
    const srcId1 = "src-001";
    const docId1 = "doc-001";

    const source1: KnowledgeSource = {
      id: srcId1,
      brandId,
      organizationId,
      name: "Acme Cloud Architecture Overview 2026",
      type: "file_upload",
      sourceUrl: "https://acmecloud.ai/docs/architecture",
      trustLevel: "brand_authoritative",
      status: "active",
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.localSources.set(srcId1, source1);
    this.repo.saveSource(source1).catch(() => {});

    const doc1: KnowledgeDocument = {
      id: docId1,
      brandId,
      organizationId,
      sourceId: srcId1,
      title: "Acme Cloud Architecture Overview 2026",
      fileType: "md",
      fileSizeBytes: 2450,
      contentHash: "hash-seed-001",
      revision: 1,
      extractedText: "Acme Cloud is an enterprise-grade AI content and vector search platform.",
      documentMetadata: { seeded: true },
      parsingStatus: "parsed",
      trustLevel: "brand_authoritative",
      classification: "technical_spec",
      chunkCount: 2,
      hasUntrustedDirectives: false,
      sanitizationNotes: [],
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.localDocuments.set(docId1, doc1);
    this.repo.saveDocument(doc1).catch(() => {});

    const evSrcId = "evs-001";
    const evSource: EvidenceSource = {
      id: evSrcId,
      brandId,
      organizationId,
      name: "Acme Cloud Whitepaper 2026",
      url: "https://acmecloud.ai/whitepaper-2026.pdf",
      publisher: "Acme Research Labs",
      trustScore: 98,
      isPrimarySource: true,
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.localEvidenceSources.set(evSrcId, evSource);
    this.repo.saveEvidenceSource(evSource).catch(() => {});

    const claim1: EvidenceClaim = {
      id: "clm-001",
      brandId,
      organizationId,
      claimText: "Acme Cloud guarantees 99.999% availability across 35 global multi-cloud regions.",
      claimType: "statistic",
      verificationStatus: "verified",
      confidenceScore: 0.98,
      extractedEntities: { metric: "99.999%", regions: 35 },
      verifiedBy: "user-marcus",
      verifiedAt: new Date("2026-01-15").toISOString(),
      sources: [
        {
          id: "cls-001",
          claimId: "clm-001",
          sourceId: evSrcId,
          sourceName: "Acme Cloud Whitepaper 2026",
          documentId: docId1,
          exactQuote: "Acme Cloud guarantees 99.999% availability across 35 global multi-cloud regions with sub-millisecond failover.",
          pageOrSection: "High Availability & Resilience",
          createdAt: new Date("2026-01-15").toISOString()
        }
      ],
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.localEvidenceClaims.set("clm-001", claim1);
    this.repo.saveEvidenceClaims([claim1]).catch(() => {});
  }
}

export const brandBrainIngestion = new BrandBrainIngestionService();
