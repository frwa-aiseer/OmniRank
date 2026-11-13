import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { runSeoAudit, runGeoAudit, runBrandAudit } from "../server/quality/audits.ts";

describe("OR-P09 — Quality, Review and Versioning", () => {
  const migPath = path.resolve(process.cwd(), "supabase/migrations/20261113000015_quality_review_schema.sql");
  const migSql = fs.readFileSync(migPath, "utf-8");

  describe("1. Database Schema & Migration 00015 Verification", () => {
    it("should extend article status machine to full 12-state lifecycle", () => {
      const states = [
        "idea",
        "researching",
        "brief",
        "drafting",
        "ai_review",
        "human_review",
        "approved",
        "scheduled",
        "published",
        "monitoring",
        "refresh_recommended",
        "archived",
      ];
      for (const st of states) {
        expect(migSql).toContain(`'${st}'`);
      }
    });

    it("should create content_reviews, review_comments, and audit tables", () => {
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.content_reviews");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.review_comments");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.seo_audits");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.geo_audits");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.brand_audits");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.approval_requirements");
    });

    it("should implement approve_article_version SECURITY DEFINER RPC with RBAC & separation of duties", () => {
      expect(migSql).toContain("CREATE OR REPLACE FUNCTION public.approve_article_version");
      expect(migSql).toContain("SECURITY DEFINER");
      expect(migSql).toContain("SET search_path = ''");
      expect(migSql).toContain("Separation of duties: cannot approve your own article");
      expect(migSql).toContain("Cannot approve: blocking brand policy violations must be resolved first");
      expect(migSql).toContain("approved_version_id = p_version_id");
    });
  });

  describe("2. SEO Audit (Deterministic)", () => {
    it("should compute SEO audit score and flag short title / missing keyword", async () => {
      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "articles") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  title: "Short",
                  target_keyword: "Kubernetes",
                  meta_description: "Short description.",
                  status: "drafting",
                },
              }),
            };
          }
          if (table === "article_working_documents") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  content: {
                    blocks: [
                      { type: "paragraph", content: { text: "Some small content." } },
                    ],
                  },
                },
              }),
            };
          }
          return {};
        }),
      } as any;

      const result = await runSeoAudit(mockClient, "art-1", "brand-1");
      expect(result.checks.title_length).toBe("warn");
      expect(result.checks.keyword_in_title).toBe("warn");
      expect(result.checks.word_count).toBe("fail");
      expect(result.score).toBeLessThan(50);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it("should pass checks when title, keyword, headings, and word count are optimal", async () => {
      const words = Array(900).fill("content").join(" ");
      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "articles") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  title: "Mastering Kubernetes Architecture: Complete 2026 Guide",
                  target_keyword: "Kubernetes",
                  meta_description: "A comprehensive guide to modern production Kubernetes cluster architecture and deployment best practices for enterprise systems.",
                  status: "drafting",
                },
              }),
            };
          }
          if (table === "article_working_documents") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  content: {
                    blocks: [
                      { type: "heading", content: { level: 1, text: "Introduction to Kubernetes" } },
                      { type: "paragraph", content: { text: words } },
                      { type: "heading", content: { level: 2, text: "Cluster Components" } },
                    ],
                  },
                },
              }),
            };
          }
          return {};
        }),
      } as any;

      const result = await runSeoAudit(mockClient, "art-1", "brand-1");
      expect(result.checks.title_length).toBe("pass");
      expect(result.checks.keyword_in_title).toBe("pass");
      expect(result.checks.has_headings).toBe("pass");
      expect(result.checks.word_count).toBe("pass");
      expect(result.score).toBe(100);
    });
  });

  describe("3. GEO Audit (Generative Engine Optimization)", () => {
    it("should evaluate FAQ, statistics, and citations presence", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              content: {
                blocks: [
                  { type: "faq", content: { question: "Why RLS?", answer: "Isolation." } },
                  { type: "statistic", content: { stat: "99.9%" }, evidenceRefs: ["claim-1"] },
                  { type: "citation", content: { source: "RFC 7519" } },
                ],
              },
            },
          }),
        }),
      } as any;

      const result = await runGeoAudit(mockClient, "art-1", "brand-1");
      expect(result.checks.has_faq).toBe("pass");
      expect(result.checks.has_statistics).toBe("pass");
      expect(result.checks.has_citations).toBe("pass");
      expect(result.checks.evidence_linked).toBe("pass");
      expect(result.score).toBe(100);
    });
  });

  describe("4. Brand Compliance Audit & Policy Violation Detection", () => {
    it("should detect avoided terminology", async () => {
      const mockClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "article_working_documents") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  content: {
                    blocks: [
                      { type: "paragraph", content: { text: "We offer the cheapest solutions on the market." } },
                    ],
                  },
                },
              }),
            };
          }
          if (table === "brand_policies") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              data: [],
            };
          }
          if (table === "brand_terminology") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{ term: "cheapest", is_preferred: false, notes: "Use 'most cost-effective'" }],
              }),
            };
          }
          return {};
        }),
      } as any;

      const result = await runBrandAudit(mockClient, "art-1", "brand-1", "org-1");
      expect(result.checks.terminology).toBe("warn");
      expect(result.issues.some((i) => i.message.includes("cheapest"))).toBe(true);
      expect(result.recommendations.some((r) => r.includes("cheapest"))).toBe(true);
    });
  });
});
