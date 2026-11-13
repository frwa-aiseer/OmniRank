import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { OmniRouter } from "../server/omnirouter/router.ts";
import * as geminiAdapter from "../server/omnirouter/gemini-adapter.ts";
import { generateArticleFromBrief, rewriteBlock } from "../server/generation/content-generator.ts";
import { ARTICLE_SCHEMA_VERSION, V1_BLOCK_TYPES } from "../types/article.ts";

describe("OR-P08 — OmniRouter and Content Generation", () => {
  const migPath = path.resolve(process.cwd(), "supabase/migrations/20261113000014_omnirouter_schema.sql");
  const migSql = fs.readFileSync(migPath, "utf-8");

  describe("1. Database Schema & Migration 00014 Verification", () => {
    it("should define all required AI routing and usage tables", () => {
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.ai_tasks");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.ai_models");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.ai_routing_policies");
      expect(migSql).toContain("CREATE TABLE IF NOT EXISTS public.ai_usage_events");
    });

    it("should enable RLS on all AI tables", () => {
      expect(migSql).toContain("ALTER TABLE public.ai_tasks              ENABLE ROW LEVEL SECURITY");
      expect(migSql).toContain("ALTER TABLE public.ai_models             ENABLE ROW LEVEL SECURITY");
      expect(migSql).toContain("ALTER TABLE public.ai_routing_policies   ENABLE ROW LEVEL SECURITY");
      expect(migSql).toContain("ALTER TABLE public.ai_usage_events       ENABLE ROW LEVEL SECURITY");
    });

    it("should seed all canonical AI tasks without model names in task codes", () => {
      const canonicalTasks = [
        "brand_extraction",
        "classification",
        "keyword_clustering",
        "research_synthesis",
        "content_brief",
        "article_draft",
        "block_rewrite",
        "fact_check",
        "seo_audit",
        "geo_audit",
        "brand_audit",
        "evidence_check",
      ];
      for (const task of canonicalTasks) {
        expect(migSql).toContain(`'${task}'`);
      }
    });

    it("should seed free-first Gemini models", () => {
      expect(migSql).toContain("'gemini-2.0-flash'");
      expect(migSql).toContain("'gemini-2.0-flash-lite'");
    });
  });

  describe("2. OmniRouter Provider-Neutral Routing & Fallback", () => {
    const mockServiceClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "model-uuid-1" } }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should route by task code and quality without requiring specific model in request", async () => {
      const spyCall = vi.spyOn(geminiAdapter, "callGemini").mockResolvedValue({
        success: true,
        text: "Generated text",
        inputTokens: 100,
        outputTokens: 200,
        latencyMs: 500,
        modelUsed: "gemini-2.0-flash",
        taskCode: "article_draft",
      });

      const router = new OmniRouter(mockServiceClient);
      const res = await router.route({
        taskCode: "article_draft",
        quality: "economy",
        systemPrompt: "System",
        userPrompt: "User prompt",
      });

      expect(res.success).toBe(true);
      expect(spyCall).toHaveBeenCalledTimes(1);
      expect(spyCall).toHaveBeenCalledWith(
        "gemini-2.0-flash",
        expect.objectContaining({ taskCode: "article_draft" }),
        30000
      );
    });

    it("should attempt fallback model when primary model fails", async () => {
      const spyCall = vi
        .spyOn(geminiAdapter, "callGemini")
        .mockResolvedValueOnce({
          success: false,
          error: "Rate limit exceeded",
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 100,
          modelUsed: "gemini-2.5-flash",
          taskCode: "article_draft",
        })
        .mockResolvedValueOnce({
          success: true,
          text: "Fallback generated text",
          inputTokens: 100,
          outputTokens: 150,
          latencyMs: 300,
          modelUsed: "gemini-2.0-flash-lite",
          taskCode: "article_draft",
        });

      const router = new OmniRouter(mockServiceClient);
      const res = await router.route({
        taskCode: "article_draft",
        quality: "balanced",
        systemPrompt: "System",
        userPrompt: "User prompt",
      });

      expect(res.success).toBe(true);
      expect(spyCall).toHaveBeenCalledTimes(2);
      expect(res.modelUsed).toContain("fallback");
    });
  });

  describe("3. Content Generation from Brief", () => {
    it("should reject brief that is not approved", async () => {
      const mockUserClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "brief-1", status: "draft" },
            error: null,
          }),
        }),
      } as any;

      const router = new OmniRouter({} as any);

      await expect(
        generateArticleFromBrief(mockUserClient, router, {
          briefId: "brief-1",
          brandId: "brand-1",
          context: { organizationId: "org-1", brandId: "brand-1", userId: "usr-1" },
        })
      ).rejects.toThrow("Content brief must be approved before generation");
    });

    it("should generate valid structured blocks from approved brief", async () => {
      const mockUserClient = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "content_briefs") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "brief-1",
                  status: "approved",
                  title: "Scaling SaaS Architecture",
                  angle: "Deep dive into multi-tenancy",
                  target_audience: "CTOs and Lead Architects",
                  search_intent: "Informational",
                  primary_objective: "Establish technical authority",
                  outline: [{ heading: "Introduction" }, { heading: "Database Isolation" }],
                  source_selections: [],
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          };
        }),
      } as any;

      const router = new OmniRouter({} as any);
      vi.spyOn(router, "route").mockResolvedValue({
        success: true,
        structured: {
          blocks: [
            {
              id: "b1",
              type: "heading",
              content: { level: 1, text: "Scaling SaaS Architecture" },
            },
            {
              id: "b2",
              type: "paragraph",
              content: { text: "Multi-tenancy requires strict RLS isolation." },
            },
          ],
        },
        inputTokens: 200,
        outputTokens: 300,
        latencyMs: 1200,
        modelUsed: "gemini-2.5-flash",
        taskCode: "article_draft",
      });

      const result = await generateArticleFromBrief(mockUserClient, router, {
        briefId: "brief-1",
        brandId: "brand-1",
        context: { organizationId: "org-1", brandId: "brand-1", userId: "usr-1" },
      });

      expect(result.blocks.length).toBe(2);
      expect(result.blocks[0].type).toBe("heading");
      expect(result.blocks[0].schemaVersion).toBe(ARTICLE_SCHEMA_VERSION);
      expect(result.blocks[0].provenance.aiGenerated).toBe(true);
      expect(result.blocks[0].provenance.aiTaskCode).toBe("article_draft");
    });
  });

  describe("4. Single Block Rewrite", () => {
    it("should rewrite a single block with updated AI provenance", async () => {
      const mockUserClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { tone_keywords: ["clear", "bold"] } }),
        }),
      } as any;

      const router = new OmniRouter({} as any);
      vi.spyOn(router, "route").mockResolvedValue({
        success: true,
        structured: {
          content: { text: "Rewritten clear and punchy paragraph." },
          attributes: {},
        },
        inputTokens: 50,
        outputTokens: 60,
        latencyMs: 400,
        modelUsed: "gemini-2.0-flash",
        taskCode: "block_rewrite",
      });

      const result = await rewriteBlock(mockUserClient, router, {
        blockId: "blk-123",
        blockType: "paragraph",
        currentContent: { text: "Original wordy text." },
        instruction: "Make it punchy",
        brandId: "brand-1",
        context: { organizationId: "org-1", brandId: "brand-1", userId: "usr-1" },
      });

      expect(result.block.id).toBe("blk-123");
      expect((result.block.content as any).text).toBe("Rewritten clear and punchy paragraph.");
      expect(result.block.provenance?.aiGenerated).toBe(true);
      expect(result.block.provenance?.aiTaskCode).toBe("block_rewrite");
    });
  });
});
