import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SupabaseArticleRepository } from "../server/article/repository.ts";

describe("OR-P05-LAST-GATE — Reviewer Approval Authorization", () => {
  const MIG_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const MIG_10 = path.join(MIG_DIR, "20260929000010_articles_schema.sql");
  const MIG_11 = path.join(MIG_DIR, "20260929000011_article_integrity.sql");

  it("1. reviewer approval allowed via DB-authoritative RPC", () => {
    const content = fs.readFileSync(MIG_11, "utf8");
    expect(content).toContain("CREATE OR REPLACE FUNCTION public.review_article");
    expect(content).toContain("caller_brand_role IN ('strategist', 'reviewer')");
  });

  it("2. writer approval denied inside RPC", () => {
    const content = fs.readFileSync(MIG_11, "utf8");
    const rpcDef = content.substring(content.indexOf("FUNCTION public.review_article"));
    // The role check only allows strategist/reviewer/owner/admin
    expect(rpcDef).not.toContain("'writer'");
  });

  it("3. reviewer cannot general-edit article (RLS policy check)", () => {
    const content = fs.readFileSync(MIG_10, "utf8");
    // Verify articles_update_writer only checks for strategist and writer, NOT reviewer
    // So reviewer has no general UPDATE grant
    expect(content).toContain("CREATE POLICY \"articles_update_writer\"");
    expect(content).not.toContain("'reviewer'");
  });

  it("4. foreign version denied within review_article", () => {
    const content = fs.readFileSync(MIG_11, "utf8");
    // Should verify version belongs to this article
    expect(content).toContain("id = p_version_id AND article_id = p_article_id");
  });

  it("5. RPC uses SECURITY DEFINER and SET search_path=''", () => {
    const content = fs.readFileSync(MIG_11, "utf8");
    const rpcDef = content.substring(content.indexOf("FUNCTION public.review_article"));
    expect(rpcDef).toContain("SECURITY DEFINER");
    expect(rpcDef).toContain("SET search_path = ''");
  });

  it("6. RPC revokes PUBLIC/anon access", () => {
    const content = fs.readFileSync(MIG_11, "utf8");
    expect(content).toContain("REVOKE ALL ON FUNCTION public.review_article(UUID, UUID, TEXT) FROM PUBLIC, anon;");
    expect(content).toContain("GRANT EXECUTE ON FUNCTION public.review_article(UUID, UUID, TEXT) TO authenticated, service_role;");
  });
});
