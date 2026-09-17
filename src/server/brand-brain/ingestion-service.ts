import { randomUUID } from "crypto";
import {
  KnowledgeSource,
  KnowledgeDocument,
  KnowledgeChunk,
  EvidenceSource,
  EvidenceClaim,
  EvidenceClaimSourceLink,
  IngestionInput,
  IngestionResult,
  SemanticSearchResult,
  TrustLevel,
  DocumentClassification,
  EvidenceVerificationStatus
} from "../../types/index.ts";
import { r2Storage } from "../storage/r2.ts";
import { ContentSanitizer } from "./sanitizer.ts";
import { DocumentParsers } from "./parsers.ts";
import { SemanticChunker } from "./chunker.ts";
import { EvidenceExtractor } from "./evidence-extractor.ts";
import {
  EmbeddingProvider,
  DeterministicEmbeddingProvider,
  defaultEmbeddingProvider,
  cosineSimilarity
} from "./embeddings.ts";

export class BrandBrainIngestionService {
  private sources: Map<string, KnowledgeSource> = new Map();
  private documents: Map<string, KnowledgeDocument> = new Map();
  private chunks: Map<string, KnowledgeChunk> = new Map();
  private evidenceSources: Map<string, EvidenceSource> = new Map();
  private evidenceClaims: Map<string, EvidenceClaim> = new Map();

  private chunker = new SemanticChunker(400, 50);
  private embeddingProvider: EmbeddingProvider;

  constructor(embeddingProvider: EmbeddingProvider = defaultEmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
    this.seedDefaultKnowledge();
  }

  /**
   * Main Ingestion Pipeline:
   * 1. Hashing & Content Validation
   * 2. Deduplication check (avoids re-embedding unchanged content)
   * 3. Sanitization & Untrusted Directives Detection
   * 4. Multi-format Structured Parsing
   * 5. Document Classification & Metadata
   * 6. Storage in R2
   * 7. Semantic Chunking (with heading path hierarchy)
   * 8. Vector Embeddings Generation (768-dim)
   * 9. Evidence Claims & Provenance Extraction
   */
  async ingestContent(input: IngestionInput, user?: { id: string; name: string }): Promise<IngestionResult> {
    const brandId = input.brandId;
    const rawText =
      typeof input.fileBufferOrText === "string"
        ? input.fileBufferOrText
        : new TextDecoder().decode(input.fileBufferOrText);

    // 1. Content Hashing & Deduplication
    const contentHash = ContentSanitizer.computeContentHash(input.fileBufferOrText);

    // Check if an identical document is already ingested for this brand
    const existingDoc = Array.from(this.documents.values()).find(
      (doc) => doc.brandId === brandId && doc.contentHash === contentHash
    );

    if (existingDoc) {
      const existingSource = this.sources.get(existingDoc.sourceId)!;
      const existingChunks = Array.from(this.chunks.values()).filter(
        (c) => c.documentId === existingDoc.id && c.brandId === brandId
      );
      const existingClaims = Array.from(this.evidenceClaims.values()).filter(
        (ec) => ec.brandId === brandId && ec.sources.some((s) => s.documentId === existingDoc.id)
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

    // 2. Sanitization (Defense against prompt injections & untrusted commands)
    const sanitization = ContentSanitizer.sanitize(rawText);

    // 3. Format Parsing
    const fileType = input.fileType || (input.sourceType === "website" ? "html" : "note");
    const parsed = DocumentParsers.parse(sanitization.cleanText, fileType, input.fileName || input.sourceName);

    // 4. Source Registration
    let sourceId = "";
    const existingMatchingSource = Array.from(this.sources.values()).find(
      (s) => s.brandId === brandId && s.name === input.sourceName && s.type === input.sourceType
    );

    if (existingMatchingSource) {
      sourceId = existingMatchingSource.id;
    } else {
      sourceId = `src-${randomUUID().slice(0, 8)}`;
      const newSource: KnowledgeSource = {
        id: sourceId,
        brandId,
        organizationId: "org-001",
        name: input.sourceName,
        type: input.sourceType,
        sourceUrl: input.sourceUrl,
        trustLevel: input.trustLevel || this.inferTrustLevel(input.sourceType, input.sourceUrl),
        status: "active",
        config: input.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.sources.set(sourceId, newSource);
    }

    const source = this.sources.get(sourceId)!;

    // 5. R2 Storage Upload
    const storageKey = `org-001/${brandId}/docs/${contentHash.slice(0, 16)}.${fileType}`;
    await r2Storage.uploadObject({
      key: storageKey,
      body: input.fileBufferOrText,
      contentType: this.getMimeType(fileType),
      metadata: {
        brandId,
        sourceName: input.sourceName,
        contentHash
      }
    });

    // 6. Classification
    const classification = input.classification || this.autoClassifyDocument(parsed.title, parsed.extractedText);

    // 7. Register Knowledge Document
    const documentId = `doc-${randomUUID().slice(0, 8)}`;
    const newDoc: KnowledgeDocument = {
      id: documentId,
      brandId,
      sourceId,
      title: parsed.title,
      url: input.sourceUrl,
      fileType,
      storageKey,
      fileSizeBytes: typeof input.fileBufferOrText === "string" ? Buffer.byteLength(input.fileBufferOrText) : input.fileBufferOrText.byteLength,
      contentHash,
      extractedText: parsed.extractedText,
      documentMetadata: {
        ...parsed.documentMetadata,
        ...input.metadata,
        sanitizationNotes: sanitization.sanitizationNotes
      },
      parsingStatus: "parsed",
      trustLevel: source.trustLevel,
      classification,
      chunkCount: 0,
      hasUntrustedDirectives: sanitization.hasUntrustedDirectives,
      sanitizationNotes: sanitization.sanitizationNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 8. Semantic Chunking
    const rawChunks = this.chunker.chunkDocument(parsed.extractedText, {
      documentId,
      sourceId,
      title: parsed.title,
      trustLevel: source.trustLevel
    });

    newDoc.chunkCount = rawChunks.length;
    this.documents.set(documentId, newDoc);

    // 9. Embeddings Generation (Batch or Sequential)
    const chunkTexts = rawChunks.map((rc) => `${rc.headingHierarchy.join(" > ")}\n${rc.content}`);
    const embeddings = await this.embeddingProvider.generateBatchEmbeddings(chunkTexts);

    const generatedChunks: KnowledgeChunk[] = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const rc = rawChunks[i];
      const chunkId = `chk-${randomUUID().slice(0, 8)}`;
      const chunk: KnowledgeChunk = {
        id: chunkId,
        brandId,
        documentId,
        sourceId,
        chunkIndex: rc.chunkIndex,
        content: rc.content,
        contentHash: rc.contentHash,
        tokenCount: rc.tokenCount,
        headingHierarchy: rc.headingHierarchy,
        chunkType: rc.chunkType,
        embedding: embeddings[i],
        metadata: rc.metadata,
        trustLevel: source.trustLevel,
        createdAt: new Date().toISOString()
      };
      this.chunks.set(chunkId, chunk);
      generatedChunks.push(chunk);
    }

    // 10. Evidence Candidates Extraction & Source Registration
    const generatedClaims: EvidenceClaim[] = [];
    let evidenceSourceId = `evs-${randomUUID().slice(0, 8)}`;
    const evSource: EvidenceSource = {
      id: evidenceSourceId,
      brandId,
      name: source.name,
      url: source.sourceUrl,
      publisher: source.name,
      trustScore: source.trustLevel === "verified_1p" ? 95 : source.trustLevel === "partner_2p" ? 85 : 70,
      isPrimarySource: source.trustLevel === "verified_1p",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.evidenceSources.set(evidenceSourceId, evSource);

    for (const rc of rawChunks) {
      const candidates = EvidenceExtractor.extractCandidatesFromChunk(
        rc,
        documentId,
        sourceId,
        source.name,
        source.sourceUrl
      );

      for (const cand of candidates) {
        const claimId = `clm-${randomUUID().slice(0, 8)}`;
        const claim: EvidenceClaim = {
          id: claimId,
          brandId,
          claimText: cand.claimText,
          claimType: cand.claimType,
          verificationStatus: source.trustLevel === "verified_1p" ? "verified" : "unverified",
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
        this.evidenceClaims.set(claimId, claim);
        generatedClaims.push(claim);
      }
    }

    return {
      source,
      document: newDoc,
      chunks: generatedChunks,
      evidenceClaims: generatedClaims,
      isDuplicate: false,
      sanitizationApplied: sanitization.hasUntrustedDirectives
    };
  }

  /**
   * Semantic Vector Search over Brand Knowledge:
   * STRICT GUARANTEE: Never returns chunks from other brands (brandId filter is enforced first).
   */
  async searchBrandKnowledge(
    brandId: string,
    query: string,
    topK = 5,
    minSimilarity = 0.15
  ): Promise<SemanticSearchResult[]> {
    const queryVector = await this.embeddingProvider.generateEmbedding(query);

    // Filter strictly by brandId BEFORE similarity computation
    const brandChunks = Array.from(this.chunks.values()).filter((c) => c.brandId === brandId);

    const scored: SemanticSearchResult[] = [];

    for (const chunk of brandChunks) {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      if (score >= minSimilarity) {
        const doc = this.documents.get(chunk.documentId);
        const src = this.sources.get(chunk.sourceId);

        scored.push({
          chunk,
          documentTitle: doc?.title || "Untitled Document",
          documentUrl: doc?.url,
          sourceName: src?.name || "Brand Brain Source",
          similarityScore: Number(score.toFixed(4)),
          trustLevel: chunk.trustLevel
        });
      }
    }

    // Sort descending by similarity score
    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    return scored.slice(0, topK);
  }

  // --- Read Methods ---

  getSources(brandId: string): KnowledgeSource[] {
    return Array.from(this.sources.values()).filter((s) => s.brandId === brandId);
  }

  getDocuments(brandId: string): KnowledgeDocument[] {
    return Array.from(this.documents.values()).filter((d) => d.brandId === brandId);
  }

  getChunks(brandId: string, documentId?: string): KnowledgeChunk[] {
    return Array.from(this.chunks.values()).filter((c) => {
      if (c.brandId !== brandId) return false;
      if (documentId && c.documentId !== documentId) return false;
      return true;
    });
  }

  getEvidenceClaims(brandId: string): EvidenceClaim[] {
    return Array.from(this.evidenceClaims.values()).filter((c) => c.brandId === brandId);
  }

  getEvidenceSources(brandId: string): EvidenceSource[] {
    return Array.from(this.evidenceSources.values()).filter((s) => s.brandId === brandId);
  }

  // --- Mutation & Evidence Verification Methods ---

  verifyClaim(brandId: string, claimId: string, status: EvidenceVerificationStatus): EvidenceClaim {
    const claim = this.evidenceClaims.get(claimId);
    if (!claim || claim.brandId !== brandId) {
      throw new Error(`Claim ${claimId} not found for brand ${brandId}`);
    }
    claim.verificationStatus = status;
    claim.updatedAt = new Date().toISOString();
    return claim;
  }

  deleteDocument(brandId: string, documentId: string): boolean {
    const doc = this.documents.get(documentId);
    if (!doc || doc.brandId !== brandId) return false;

    // Remove associated chunks
    for (const [chkId, chk] of this.chunks.entries()) {
      if (chk.documentId === documentId && chk.brandId === brandId) {
        this.chunks.delete(chkId);
      }
    }

    // Remove document
    this.documents.delete(documentId);
    return true;
  }

  // --- Private Helper Methods ---

  private inferTrustLevel(sourceType: string, url?: string): TrustLevel {
    if (sourceType === "manual_note") return "verified_1p";
    if (sourceType === "file_upload") return "verified_1p";
    if (url && (url.includes("gov") || url.includes("edu") || url.includes("official"))) {
      return "verified_1p";
    }
    return "partner_2p";
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
    // Seed initial high-quality knowledge for default brand-001 (Acme AI Cloud)
    const brandId = "brand-001";
    const srcId1 = "src-001";
    const docId1 = "doc-001";

    const source1: KnowledgeSource = {
      id: srcId1,
      brandId,
      organizationId: "org-001",
      name: "Acme Cloud Whitepaper 2026",
      type: "file_upload",
      sourceUrl: "https://acmecloud.ai/whitepaper-2026.pdf",
      trustLevel: "verified_1p",
      status: "active",
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.sources.set(srcId1, source1);

    const doc1Text = `# Acme Cloud Autonomous Architecture

## High Availability & Resilience
Acme Cloud guarantees 99.999% availability across 35 global multi-cloud regions with sub-millisecond failover.

## Performance Benchmarks
Benchmarked throughput achieves 150,000 req/sec at p99 latency under 12ms. Our distributed vector cache delivers 3.4x faster crawl speed compared to legacy relational models.

## Security & Compliance
Acme Cloud is SOC 2 Type II certified and ISO 27001 audited with end-to-end hardware enclave encryption. Enterprise customers reported $1.4M saved in infrastructure compute annually.`;

    const doc1Hash = ContentSanitizer.computeContentHash(doc1Text);
    const doc1: KnowledgeDocument = {
      id: docId1,
      brandId,
      sourceId: srcId1,
      title: "Acme Cloud Autonomous Architecture Whitepaper",
      url: "https://acmecloud.ai/whitepaper-2026.pdf",
      fileType: "pdf",
      storageKey: `org-001/${brandId}/docs/${doc1Hash.slice(0, 16)}.pdf`,
      fileSizeBytes: 4096,
      contentHash: doc1Hash,
      extractedText: doc1Text,
      documentMetadata: { pages: 18, format: "pdf" },
      parsingStatus: "parsed",
      trustLevel: "verified_1p",
      classification: "technical_spec",
      chunkCount: 3,
      hasUntrustedDirectives: false,
      sanitizationNotes: [],
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.documents.set(docId1, doc1);

    const rawChunks = this.chunker.chunkDocument(doc1Text, { documentId: docId1, sourceId: srcId1 });
    rawChunks.forEach((rc, i) => {
      const chkId = `chk-00${i + 1}`;
      const embedding = this.embeddingProvider instanceof DeterministicEmbeddingProvider
        ? (this.embeddingProvider as any).computeVector(rc.content)
        : new Array(768).fill(0.01);

      this.chunks.set(chkId, {
        id: chkId,
        brandId,
        documentId: docId1,
        sourceId: srcId1,
        chunkIndex: rc.chunkIndex,
        content: rc.content,
        contentHash: rc.contentHash,
        tokenCount: rc.tokenCount,
        headingHierarchy: rc.headingHierarchy,
        chunkType: rc.chunkType,
        embedding,
        metadata: rc.metadata,
        trustLevel: "verified_1p",
        createdAt: new Date("2026-01-15").toISOString()
      });
    });

    // Seed Evidence Claims
    const evSrcId = "evs-001";
    this.evidenceSources.set(evSrcId, {
      id: evSrcId,
      brandId,
      name: "Acme Cloud Whitepaper 2026",
      url: "https://acmecloud.ai/whitepaper-2026.pdf",
      publisher: "Acme Research Labs",
      trustScore: 98,
      isPrimarySource: true,
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    });

    const claim1: EvidenceClaim = {
      id: "clm-001",
      brandId,
      claimText: "Acme Cloud guarantees 99.999% availability across 35 global multi-cloud regions.",
      claimType: "statistic",
      verificationStatus: "verified",
      confidenceScore: 0.98,
      extractedEntities: { metric: "99.999%", regions: 35 },
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
    this.evidenceClaims.set("clm-001", claim1);

    const claim2: EvidenceClaim = {
      id: "clm-002",
      brandId,
      claimText: "Delivers 3.4x faster crawl speed compared to legacy relational models.",
      claimType: "benchmark",
      verificationStatus: "verified",
      confidenceScore: 0.94,
      extractedEntities: { multiplier: "3.4x", p99Latency: "<12ms" },
      sources: [
        {
          id: "cls-002",
          claimId: "clm-002",
          sourceId: evSrcId,
          sourceName: "Acme Cloud Whitepaper 2026",
          documentId: docId1,
          exactQuote: "Our distributed vector cache delivers 3.4x faster crawl speed compared to legacy relational models.",
          pageOrSection: "Performance Benchmarks",
          createdAt: new Date("2026-01-15").toISOString()
        }
      ],
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.evidenceClaims.set("clm-002", claim2);

    const claim3: EvidenceClaim = {
      id: "clm-003",
      brandId,
      claimText: "Enterprise customers reported $1.4M saved in infrastructure compute annually.",
      claimType: "customer_result",
      verificationStatus: "verified",
      confidenceScore: 0.92,
      extractedEntities: { amount: "$1.4M" },
      sources: [
        {
          id: "cls-003",
          claimId: "clm-003",
          sourceId: evSrcId,
          sourceName: "Acme Cloud Whitepaper 2026",
          documentId: docId1,
          exactQuote: "Enterprise customers reported $1.4M saved in infrastructure compute annually.",
          pageOrSection: "Security & Compliance",
          createdAt: new Date("2026-01-15").toISOString()
        }
      ],
      createdAt: new Date("2026-01-15").toISOString(),
      updatedAt: new Date("2026-01-15").toISOString()
    };
    this.evidenceClaims.set("clm-003", claim3);
  }
}

export const brandBrainIngestion = new BrandBrainIngestionService();
