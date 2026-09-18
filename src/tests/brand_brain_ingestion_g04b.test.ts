import { describe, it, expect, beforeEach } from "vitest";
import { BrandBrainIngestionService } from "../server/brand-brain/ingestion-service.ts";
import { InMemoryBrandBrainRepository } from "../server/brand-brain/repository.ts";
import { DocumentParsers } from "../server/brand-brain/parsers.ts";
import { validateSafeUrl } from "../server/brand-brain/ssrf.ts";
import { DeterministicEmbeddingProvider } from "../server/brand-brain/embeddings.ts";
import { TenancyAuthorizationError } from "../server/auth/tenancy.ts";
import * as XLSX from "xlsx";

describe("OR-G04B — Real Brand Brain Ingestion, Storage & Evidence Gate", () => {
  let repo: InMemoryBrandBrainRepository;
  let service: BrandBrainIngestionService;

  beforeEach(() => {
    repo = new InMemoryBrandBrainRepository();
    service = new BrandBrainIngestionService(new DeterministicEmbeddingProvider(), repo);
  });

  describe("1. Tenancy Resolution & Dynamic Storage Paths", () => {
    it("should dynamically resolve organization ID from brand record and reject cross-tenant spoofing", async () => {
      // brand-001 belongs to org-001 (Acme Cloud)
      const validResult = await service.ingestContent({
        brandId: "brand-001",
        organizationId: "org-001",
        sourceType: "file_upload",
        sourceName: "Architecture Doc",
        fileType: "md",
        fileBufferOrText: "# Valid Doc\nArchitecture overview."
      });

      expect(validResult.document.organizationId).toBe("org-001");
      expect(validResult.document.storageKey).toMatch(/^tenants\/org-001\/brands\/brand-001\/docs\//);

      // Attempting to ingest brand-001 under org-002 must throw TenancyAuthorizationError
      await expect(
        service.ingestContent({
          brandId: "brand-001",
          organizationId: "org-002",
          sourceType: "file_upload",
          sourceName: "Spoofed Ingestion",
          fileType: "md",
          fileBufferOrText: "# Spoofed Doc"
        })
      ).rejects.toThrow(TenancyAuthorizationError);
    });
  });

  describe("2. Binary Document Parsing (PDF, DOCX, XLSX, CSV)", () => {
    it("should parse spreadsheet XLSX binary and extract tabular records without corruption", async () => {
      // Create a real in-memory XLSX workbook binary
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Product", "Q1_Revenue", "Growth_YoY"],
        ["Acme Cloud AI", "$12.4M", "+185%"],
        ["Vector Search Pro", "$4.2M", "+95%"]
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Financials");
      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

      const parsed = await DocumentParsers.parseAsync(xlsxBuffer, "xlsx", "Financials 2026");
      expect(parsed.title).toBe("Financials 2026");
      expect(parsed.extractedText).toContain("Acme Cloud AI,$12.4M,+185%");
      expect(parsed.documentMetadata.totalRows).toBe(3);
    });

    it("should parse complex CSV rows with quoted fields and line breaks", async () => {
      const csv = `Metric,Value,Notes\n"Uptime SLA","99.999%","Multi-region deployment with zero single points of failure"\n"Latency","12ms p99","Global edge caching network"`;
      const parsed = await DocumentParsers.parseAsync(Buffer.from(csv), "csv", "SLA Benchmarks");

      expect(parsed.extractedText).toContain("Row 1: Metric: Uptime SLA | Value: 99.999% | Notes: Multi-region deployment with zero single points of failure");
      expect(parsed.documentMetadata.rowCount).toBe(2);
    });

    it("should reject documents containing malicious command macro formulas", () => {
      const dangerousXlsxPayload = Buffer.from("=cmd|' /C calc'!A0");
      expect(() => {
        DocumentParsers.parse(dangerousXlsxPayload, "xlsx");
      }).toThrow(/forbidden macro or formula command/i);
    });
  });

  describe("3. SSRF-Safe Website Ingestion", () => {
    it("should block loopback, private RFC-1918, link-local, and AWS metadata IPs", async () => {
      // Loopback
      await expect(validateSafeUrl("http://127.0.0.1/admin")).rejects.toThrow(/SSRF protection|blocked|restricted/i);
      await expect(validateSafeUrl("http://localhost:8080/metrics")).rejects.toThrow(/SSRF protection|blocked|localhost/i);

      // Private RFC-1918
      await expect(validateSafeUrl("http://10.0.0.1/secret")).rejects.toThrow(/restricted or private|SSRF/i);
      await expect(validateSafeUrl("http://192.168.1.1/router")).rejects.toThrow(/restricted or private|SSRF/i);

      // Cloud metadata
      await expect(validateSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/SSRF protection|blocked|restricted/i);

      // Non-http protocol
      await expect(validateSafeUrl("file:///etc/passwd")).rejects.toThrow(/Protocol/i);
    });
  });

  describe("4. Deduplication & Revisions", () => {
    it("should deduplicate exact content for same brand and avoid re-embedding", async () => {
      const content = `# Cloud Latency Architecture\np99 latency is strictly guaranteed under 15ms globally.`;

      const result1 = await service.ingestContent({
        brandId: "brand-001",
        sourceType: "file_upload",
        sourceName: "Latency Guide",
        fileType: "md",
        fileBufferOrText: content
      });

      expect(result1.isDuplicate).toBe(false);
      expect(result1.document.revision).toBe(1);

      // Duplicate ingestion
      const result2 = await service.ingestContent({
        brandId: "brand-001",
        sourceType: "file_upload",
        sourceName: "Latency Guide (Re-upload)",
        fileType: "md",
        fileBufferOrText: content
      });

      expect(result2.isDuplicate).toBe(true);
      expect(result2.document.id).toBe(result1.document.id);
      expect(result2.document.contentHash).toBe(result1.document.contentHash);
    });

    it("should increment revision when updating content on an existing source", async () => {
      const v1Content = `# SLA Policy v1\n99.9% uptime SLA across all clusters.`;
      const v2Content = `# SLA Policy v2\n99.999% uptime SLA across all clusters with multi-cloud failover.`;

      const r1 = await service.ingestContent({
        brandId: "brand-001",
        sourceType: "file_upload",
        sourceName: "SLA Policy Document",
        fileType: "md",
        fileBufferOrText: v1Content
      });
      expect(r1.document.revision).toBe(1);

      const r2 = await service.ingestContent({
        brandId: "brand-001",
        sourceType: "file_upload",
        sourceName: "SLA Policy Document",
        fileType: "md",
        fileBufferOrText: v2Content
      });
      expect(r2.document.revision).toBe(2);
      expect(r2.isDuplicate).toBe(false);
    });
  });

  describe("5. Evidence Candidate Lifecycle & Verification Gate", () => {
    it("should ensure all newly extracted claims start with unverified status", async () => {
      const benchmarkText = `# Performance Benchmark\nAcme Cloud delivers 99.999% uptime and reduced customer infrastructure costs by $2.5M. Network latency is under 10ms.`;

      const result = await service.ingestContent({
        brandId: "brand-001",
        sourceType: "file_upload",
        sourceName: "Benchmark Report",
        fileType: "md",
        fileBufferOrText: benchmarkText
      });

      expect(result.evidenceClaims.length).toBeGreaterThanOrEqual(1);

      // All newly extracted claims must be unverified regardless of source trust level
      result.evidenceClaims.forEach((claim) => {
        expect(claim.verificationStatus).toBe("unverified");
        expect(claim.sources.length).toBeGreaterThan(0);
        expect(claim.sources[0].exactQuote).toBeDefined();
      });

      // Verify claim workflow
      const targetClaim = result.evidenceClaims[0];
      const verified = service.verifyClaim("brand-001", targetClaim.id, "verified", "user-marcus");
      expect(verified.verificationStatus).toBe("verified");
      expect(verified.verifiedBy).toBe("user-marcus");
      expect(verified.verifiedAt).toBeDefined();

      const rejected = service.verifyClaim("brand-001", targetClaim.id, "rejected");
      expect(rejected.verificationStatus).toBe("rejected");
    });
  });

  describe("6. Trust Level Taxonomy", () => {
    it("should correctly classify trust levels and never mark arbitrary external gov/edu hosts as brand 1p", () => {
      const brandDomain = "acmecloud.ai";
      const competitors = ["competitor-corp.com"];
      const partners = ["partner-integrations.io"];

      // Brand official domain
      expect(
        service.inferTrustLevel("website", "https://acmecloud.ai/docs", brandDomain, competitors, partners)
      ).toBe("brand_authoritative");

      // Brand subdomain
      expect(
        service.inferTrustLevel("website", "https://api.acmecloud.ai/status", brandDomain, competitors, partners)
      ).toBe("brand_authoritative");

      // External Government / Academic domain — authoritative, but NOT brand 1p
      expect(
        service.inferTrustLevel("website", "https://nist.gov/cybersecurity", brandDomain, competitors, partners)
      ).toBe("external_authoritative");
      expect(
        service.inferTrustLevel("website", "https://cs.stanford.edu/research", brandDomain, competitors, partners)
      ).toBe("external_authoritative");

      // Competitor
      expect(
        service.inferTrustLevel("website", "https://competitor-corp.com/pricing", brandDomain, competitors, partners)
      ).toBe("competitor");

      // Partner
      expect(
        service.inferTrustLevel("website", "https://partner-integrations.io/specs", brandDomain, competitors, partners)
      ).toBe("partner");

      // General 3P web
      expect(
        service.inferTrustLevel("website", "https://random-tech-blog.org/review", brandDomain, competitors, partners)
      ).toBe("unverified_external");
    });
  });

  describe("7. Semantic Retrieval & Cross-Brand Isolation", () => {
    it("should perform vector retrieval isolated strictly to queried brand", async () => {
      await service.ingestContent({
        brandId: "brand-A",
        organizationId: "org-001",
        sourceType: "manual_note",
        sourceName: "Brand A Data",
        fileType: "note",
        fileBufferOrText: "Quantum Cache provides 99.999% availability for Brand A clients."
      });

      await service.ingestContent({
        brandId: "brand-B",
        organizationId: "org-002",
        sourceType: "manual_note",
        sourceName: "Brand B Data",
        fileType: "note",
        fileBufferOrText: "Quantum Cache provides 99.999% availability for Brand B clients."
      });

      const resultsA = await service.searchBrandKnowledge("brand-A", "Quantum Cache availability");
      expect(resultsA.length).toBeGreaterThan(0);
      resultsA.forEach((r) => {
        expect(r.chunk.brandId).toBe("brand-A");
        expect(r.chunk.brandId).not.toBe("brand-B");
      });

      const resultsB = await service.searchBrandKnowledge("brand-B", "Quantum Cache availability");
      expect(resultsB.length).toBeGreaterThan(0);
      resultsB.forEach((r) => {
        expect(r.chunk.brandId).toBe("brand-B");
        expect(r.chunk.brandId).not.toBe("brand-A");
      });
    });
  });
});
