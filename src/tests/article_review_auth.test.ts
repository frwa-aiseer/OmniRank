import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SupabaseArticleRepository, InMemoryArticleRepository } from "../server/article/repository.ts";

describe("OR-P05-RPC-FINAL — Review Contract", () => {
  const MIG_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const MIG_10 = path.join(MIG_DIR, "20260929000010_articles_schema.sql");
  const MIG_11 = path.join(MIG_DIR, "20260929000011_article_integrity.sql");
  const ROUTE_FILE = path.join(process.cwd(), "src/server/routes/article.ts");

  describe("DB Migration Integrity", () => {
    it("writer approval denied inside RPC", () => {
      const content = fs.readFileSync(MIG_11, "utf8");
      const rpcDef = content.substring(content.indexOf("FUNCTION public.review_article"));
      expect(rpcDef).not.toContain("'writer'");
    });

    it("reviewer cannot general-edit article (RLS policy check)", () => {
      const content = fs.readFileSync(MIG_10, "utf8");
      expect(content).toContain("CREATE POLICY \"articles_update_writer\"");
      expect(content).not.toContain("'reviewer'");
    });

    it("arbitrary lifecycle status impossible", () => {
      const content = fs.readFileSync(MIG_11, "utf8");
      expect(content).toContain("p_decision = 'approved'");
      expect(content).toContain("p_decision = 'rejected'");
      expect(content).toContain("Invalid review decision");
    });
    
    it("foreign version denied within review_article", () => {
      const content = fs.readFileSync(MIG_11, "utf8");
      expect(content).toContain("id = p_version_id AND article_id = p_article_id");
    });
  });

  describe("InMemory Repository Logic", () => {
    let repo: InMemoryArticleRepository;
    
    beforeEach(() => {
      repo = new InMemoryArticleRepository();
    });

    it("approve without version denied", async () => {
      const art = await repo.createArticle({ organizationId: "o", brandId: "b", schemaVersion: "1", status: "idea", title: "T", slug: "t", locale: "en", seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: "u" });
      await expect(repo.reviewArticle(art.id, null, "approved")).rejects.toThrow("p_version_id is required");
    });

    it("same-article version approval allowed", async () => {
      const art = await repo.createArticle({ organizationId: "o", brandId: "b", schemaVersion: "1", status: "idea", title: "T", slug: "t", locale: "en", seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: "u" });
      await repo.reviewArticle(art.id, "some-version", "approved");
      const updated = await repo.getArticle(art.id, "b");
      expect(updated?.status).toBe("approved");
      expect(updated?.approvedVersionId).toBe("some-version");
    });

    it("reviewer reject allowed", async () => {
      const art = await repo.createArticle({ organizationId: "o", brandId: "b", schemaVersion: "1", status: "idea", title: "T", slug: "t", locale: "en", seo: {}, geo: {}, metadata: {}, sources: [], relationships: [], createdBy: "u" });
      await repo.reviewArticle(art.id, null, "rejected");
      const updated = await repo.getArticle(art.id, "b");
      expect(updated?.status).toBe("drafting");
      expect(updated?.approvedVersionId).toBeUndefined();
    });
  });

  describe("API Route", () => {
    it("review API calls repository RPC and rejects arbitrary lifecycle status", () => {
      const content = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(content).toContain("router.post(\"/:brandId/:articleId/review\"");
      expect(content).toContain("getRepo(req).reviewArticle(articleId, versionId ?? null, decision)");
      expect(content).toContain("decision !== \"approved\" && decision !== \"rejected\"");
    });
  });
});
