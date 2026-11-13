import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { serializeDocumentToWordPressHtml, renderBlockToWordPressHtml } from "../server/publishing/html-serializer.ts";
import { PublishingService } from "../server/publishing/service.ts";
import { WordPressClient } from "../server/publishing/wordpress-client.ts";
import { ArticleBlock } from "../types/article.ts";

describe("OR-P10 — WordPress Publishing", () => {
  const migPath = path.resolve(process.cwd(), "supabase/migrations/20261113000016_wordpress_publishing_schema.sql");
  const migSql = fs.readFileSync(migPath, "utf-8");

  describe("1. Database Schema & Migration 00016 Verification", () => {
    it("should create integrations, protected_credentials, cms_content_mappings, and publishing_jobs", () => {
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.integrations");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.protected_credentials");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.cms_content_mappings");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.publishing_jobs");
    });

    it("should enable RLS on all publishing tables", () => {
      expect(migSql).toContain("ALTER TABLE public.integrations           ENABLE ROW LEVEL SECURITY");
      expect(migSql).toContain("ALTER TABLE public.protected_credentials  ENABLE ROW LEVEL SECURITY");
      expect(migSql).toContain("ALTER TABLE public.cms_content_mappings   ENABLE ROW LEVEL SECURITY");
      expect(migSql).toContain("ALTER TABLE public.publishing_jobs        ENABLE ROW LEVEL SECURITY");
    });

    it("should enforce idempotency_key uniqueness on publishing_jobs", () => {
      expect(migSql).toContain("idempotency_key TEXT NOT NULL UNIQUE");
    });

    it("should restrict protected_credentials to strategist/admin only", () => {
      expect(migSql).toContain('CREATE POLICY "protected_credentials_manage" ON public.protected_credentials');
      expect(migSql).toContain("authz.has_brand_role(brand_id, ARRAY['strategist'])");
    });
  });

  describe("2. WordPress HTML Serializer", () => {
    it("should render heading block to Gutenberg comment format", () => {
      const block: ArticleBlock = {
        id: "b1",
        type: "heading",
        schemaVersion: "1.0",
        content: { level: 2, text: "Section Title" },
        attributes: {},
        sourceRefs: [],
        evidenceRefs: [],
        provenance: { createdBy: "user", createdAt: new Date().toISOString() },
      };
      const html = renderBlockToWordPressHtml(block);
      expect(html).toContain('<!-- wp:heading {"level":2} -->');
      expect(html).toContain('<h2 class="wp-block-heading">Section Title</h2>');
    });

    it("should sanitize dangerous javascript: URIs in links and CTAs", () => {
      const block: ArticleBlock = {
        id: "b2",
        type: "cta",
        schemaVersion: "1.0",
        content: { buttonText: "Click Me", url: "javascript:alert(1)" },
        attributes: {},
        sourceRefs: [],
        evidenceRefs: [],
        provenance: { createdBy: "user", createdAt: new Date().toISOString() },
      };
      const html = renderBlockToWordPressHtml(block);
      expect(html).not.toContain("javascript:");
      expect(html).toContain('href="#"');
    });

    it("should render comparison tables, FAQs, statistics, and citations correctly", () => {
      const blocks: ArticleBlock[] = [
        {
          id: "b3",
          type: "comparisonTable",
          schemaVersion: "1.0",
          content: {
            headers: ["Feature", "OmniRank", "Legacy"],
            rows: [["AI Routing", "Provider-Neutral", "Locked"]],
          },
          attributes: {},
          sourceRefs: [],
          evidenceRefs: [],
          provenance: { createdBy: "user", createdAt: new Date().toISOString() },
        },
        {
          id: "b4",
          type: "faq",
          schemaVersion: "1.0",
          content: { question: "What is OmniRank?", answer: "An AI Content Growth OS." },
          attributes: {},
          sourceRefs: [],
          evidenceRefs: [],
          provenance: { createdBy: "user", createdAt: new Date().toISOString() },
        },
        {
          id: "b5",
          type: "statistic",
          schemaVersion: "1.0",
          content: { stat: "10x", label: "Faster Research Synthesis" },
          attributes: {},
          sourceRefs: [],
          evidenceRefs: [],
          provenance: { createdBy: "user", createdAt: new Date().toISOString() },
        },
      ];

      const html = serializeDocumentToWordPressHtml(blocks);
      expect(html).toContain("Provider-Neutral");
      expect(html).toContain("What is OmniRank?");
      expect(html).toContain("10x");
    });
  });

  describe("3. WordPress Client & Connection Test", () => {
    it("should simulate successful connection test for mock endpoint", async () => {
      const client = new WordPressClient({
        endpointUrl: "https://mock.local",
        username: "editor",
        appPassword: "xxxx-yyyy-zzzz",
      });

      const res = await client.testConnection();
      expect(res.success).toBe(true);
      expect(res.user?.name).toBe("editor");
    });

    it("should create mock post for mock endpoint", async () => {
      const client = new WordPressClient({
        endpointUrl: "https://mock.local",
        username: "editor",
        appPassword: "xxxx-yyyy-zzzz",
      });

      const res = await client.createPost({
        title: "Test Article",
        content: "<p>Content</p>",
        status: "draft",
        slug: "test-article",
      });

      expect(res.id).toBeGreaterThan(0);
      expect(res.status).toBe("draft");
      expect(res.link).toContain("mock.local/test-article");
    });
  });

  describe("4. Idempotent Publishing Service", () => {
    it("should return existing mapping when idempotency key is already completed", async () => {
      const mockUserClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "publishing_jobs") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "job-1",
                  idempotency_key: "art-1:ver-1:int-1",
                  status: "completed",
                },
              }),
            };
          }
          if (table === "cms_content_mappings") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  remote_post_id: "456",
                  remote_url: "https://example.com/art-1",
                  remote_status: "publish",
                },
              }),
            };
          }
          return {};
        }),
      } as any;

      const mockAdminClient = {} as any;
      const service = new PublishingService(mockUserClient, mockAdminClient);

      const result = await service.publishArticle({
        articleId: "art-1",
        versionId: "ver-1",
        brandId: "brand-1",
        organizationId: "org-1",
        integrationId: "int-1",
      });

      expect(result.idempotent).toBe(true);
      expect(result.remotePostId).toBe("456");
      expect(result.status).toBe("publish");
    });
  });
});
