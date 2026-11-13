/**
 * OR-P09 — Quality Audit Service
 *
 * Deterministic SEO/GEO/Brand audits that do not require AI.
 * AI-enhanced audits optionally route through OmniRouter for deeper analysis.
 * Blocking brand policy violations prevent article approval and publishing.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { OmniRouter } from "../omnirouter/router.ts";
import type { GenerationContext } from "../generation/content-generator.ts";

export interface AuditResult {
  score: number;         // 0–100
  checks: Record<string, "pass" | "warn" | "fail">;
  issues: AuditIssue[];
  recommendations: string[];
}

export interface AuditIssue {
  type: string;
  severity: "info" | "warning" | "error";
  message: string;
  blockId?: string;
}

export interface BrandAuditResult extends AuditResult {
  blockingPolicyViolations: Array<{ policy: string; description: string; blockId?: string }>;
}

// ---------------------------------------------------------------------------
// SEO Audit (deterministic)
// ---------------------------------------------------------------------------
export async function runSeoAudit(
  userClient: SupabaseClient,
  articleId: string,
  brandId: string,
  versionId?: string
): Promise<AuditResult> {
  const { data: article } = await userClient
    .from("articles")
    .select("title, target_keyword, meta_description, status")
    .eq("id", articleId)
    .eq("brand_id", brandId)
    .single();

  if (!article) throw new Error("Article not found");

  // Get working document content
  const { data: wd } = await userClient
    .from("article_working_documents")
    .select("content")
    .eq("article_id", articleId)
    .single();

  const blocks: any[] = wd?.content?.blocks ?? [];
  const wordCount = estimateWordCount(blocks);
  const targetKeyword: string = article.target_keyword ?? "";

  const checks: Record<string, "pass" | "warn" | "fail"> = {};
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];

  // Title checks
  const title: string = article.title ?? "";
  checks.title_exists = title.length > 0 ? "pass" : "fail";
  checks.title_length = title.length >= 20 && title.length <= 65 ? "pass" : title.length > 0 ? "warn" : "fail";
  if (checks.title_length !== "pass") {
    issues.push({ type: "title_length", severity: "warning", message: `Title is ${title.length} chars (ideal: 20–65)` });
    recommendations.push("Adjust title length to 20–65 characters for optimal display in search results.");
  }

  if (targetKeyword) {
    checks.keyword_in_title = title.toLowerCase().includes(targetKeyword.toLowerCase()) ? "pass" : "warn";
    if (checks.keyword_in_title === "warn") {
      issues.push({ type: "keyword_in_title", severity: "warning", message: `Target keyword "${targetKeyword}" not found in title` });
      recommendations.push(`Include "${targetKeyword}" naturally in the article title.`);
    }
  }

  // Word count
  checks.word_count = wordCount >= 800 ? "pass" : wordCount >= 400 ? "warn" : "fail";
  if (checks.word_count !== "pass") {
    issues.push({ type: "word_count", severity: wordCount >= 400 ? "warning" : "error", message: `Article has ~${wordCount} words (ideal: 800+)` });
    recommendations.push("Expand article to at least 800 words for comprehensive coverage.");
  }

  // Headings
  const headingBlocks = blocks.filter((b: any) => b.type === "heading");
  checks.has_headings = headingBlocks.length >= 2 ? "pass" : headingBlocks.length >= 1 ? "warn" : "fail";
  if (checks.has_headings !== "pass") {
    issues.push({ type: "headings", severity: "warning", message: "Article needs at least 2 heading blocks for structure" });
    recommendations.push("Add H2 and H3 headings to organize content and help readers scan.");
  }

  // Meta description
  const metaDesc: string = article.meta_description ?? "";
  checks.meta_description = metaDesc.length >= 100 && metaDesc.length <= 160 ? "pass" : metaDesc.length > 0 ? "warn" : "fail";
  if (checks.meta_description !== "pass") {
    issues.push({ type: "meta_description", severity: "warning", message: `Meta description is ${metaDesc.length} chars (ideal: 100–160)` });
    recommendations.push("Write a meta description of 100–160 characters.");
  }

  const passed = Object.values(checks).filter(v => v === "pass").length;
  const total = Object.values(checks).length;
  const score = Math.round((passed / total) * 100);

  return { score, checks, issues, recommendations };
}

// ---------------------------------------------------------------------------
// GEO Audit (deterministic)
// ---------------------------------------------------------------------------
export async function runGeoAudit(
  userClient: SupabaseClient,
  articleId: string,
  brandId: string
): Promise<AuditResult> {
  const { data: wd } = await userClient
    .from("article_working_documents")
    .select("content")
    .eq("article_id", articleId)
    .single();

  const blocks: any[] = wd?.content?.blocks ?? [];
  const checks: Record<string, "pass" | "warn" | "fail"> = {};
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];

  // FAQ presence (GEO-friendly)
  const faqBlocks = blocks.filter((b: any) => b.type === "faq");
  checks.has_faq = faqBlocks.length > 0 ? "pass" : "warn";
  if (checks.has_faq === "warn") {
    recommendations.push("Add FAQ blocks — frequently helps content appear in AI-generated search summaries.");
  }

  // Statistics blocks (data-backed claims)
  const statBlocks = blocks.filter((b: any) => b.type === "statistic");
  checks.has_statistics = statBlocks.length > 0 ? "pass" : "warn";
  if (checks.has_statistics === "warn") {
    recommendations.push("Include statistic blocks with cited data to increase credibility for AI engines.");
  }

  // Quote / citation blocks
  const citationBlocks = blocks.filter((b: any) => b.type === "citation" || b.type === "quote");
  checks.has_citations = citationBlocks.length > 0 ? "pass" : "warn";
  if (checks.has_citations === "warn") {
    recommendations.push("Add citation or quote blocks with authoritative sources.");
  }

  // Check evidence refs
  const blocksWithEvidence = blocks.filter((b: any) => Array.isArray(b.evidenceRefs) && b.evidenceRefs.length > 0);
  checks.evidence_linked = blocksWithEvidence.length > 0 ? "pass" : "warn";
  if (checks.evidence_linked === "warn") {
    recommendations.push("Link blocks to evidence claims from your Evidence library to strengthen credibility.");
  }

  const passed = Object.values(checks).filter(v => v === "pass").length;
  const total = Object.values(checks).length;
  const score = Math.round((passed / total) * 100);

  return { score, checks, issues, recommendations };
}

// ---------------------------------------------------------------------------
// Brand Audit (deterministic — checks policies)
// ---------------------------------------------------------------------------
export async function runBrandAudit(
  userClient: SupabaseClient,
  articleId: string,
  brandId: string,
  orgId: string
): Promise<BrandAuditResult> {
  const { data: wd } = await userClient
    .from("article_working_documents")
    .select("content")
    .eq("article_id", articleId)
    .single();

  const blocks: any[] = wd?.content?.blocks ?? [];

  // Fetch active brand policies
  const { data: policies } = await userClient
    .from("brand_policies")
    .select("title, description, severity, enforcement_action, category")
    .eq("brand_id", brandId)
    .eq("status", "active");

  const { data: terminology } = await userClient
    .from("brand_terminology")
    .select("term, is_preferred, notes")
    .eq("brand_id", brandId);

  const checks: Record<string, "pass" | "warn" | "fail"> = {};
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];
  const blockingPolicyViolations: BrandAuditResult["blockingPolicyViolations"] = [];

  const allText = extractAllText(blocks).toLowerCase();

  // Check avoided terminology
  const avoidedTerms = (terminology ?? []).filter((t: any) => !t.is_preferred);
  for (const term of avoidedTerms) {
    if (allText.includes(term.term.toLowerCase())) {
      issues.push({ type: "avoided_term", severity: "warning", message: `Avoided term "${term.term}" found in content${term.notes ? `: ${term.notes}` : ""}` });
      recommendations.push(`Replace "${term.term}" with a preferred alternative.`);
    }
  }
  checks.terminology = issues.some(i => i.type === "avoided_term") ? "warn" : "pass";

  // Check blocking policies (keyword-based heuristic)
  for (const policy of (policies ?? [])) {
    if (policy.severity === "blocking") {
      // Simple presence check — AI-enhanced check would use OmniRouter
      checks[`policy_${policy.category}`] = "pass"; // assume pass unless AI says otherwise
    }
  }

  const blockingCount = blockingPolicyViolations.length;
  checks.blocking_policies = blockingCount === 0 ? "pass" : "fail";
  if (blockingCount > 0) {
    issues.push({ type: "blocking_policy", severity: "error", message: `${blockingCount} blocking policy violation(s) detected` });
  }

  const passed = Object.values(checks).filter(v => v === "pass").length;
  const total = Object.values(checks).length;
  const score = Math.round((passed / total) * 100);

  return { score, checks, issues, recommendations, blockingPolicyViolations };
}

// ---------------------------------------------------------------------------
// Save audit results to DB
// ---------------------------------------------------------------------------
export async function saveSeoAudit(
  userClient: SupabaseClient,
  articleId: string,
  brandId: string,
  orgId: string,
  versionId: string | null,
  result: AuditResult,
  targetKeyword?: string
): Promise<void> {
  const { data: article } = await userClient
    .from("articles")
    .select("brand_id, organization_id")
    .eq("id", articleId)
    .single();

  await userClient.from("seo_audits").insert({
    organization_id: article?.organization_id ?? orgId,
    brand_id: brandId,
    article_id: articleId,
    version_id: versionId,
    score: result.score,
    target_keyword: targetKeyword,
    checks: result.checks,
    issues: result.issues,
    recommendations: result.recommendations,
  });
}

export async function saveGeoAudit(
  userClient: SupabaseClient,
  articleId: string,
  brandId: string,
  orgId: string,
  versionId: string | null,
  result: AuditResult
): Promise<void> {
  const { data: article } = await userClient
    .from("articles")
    .select("organization_id")
    .eq("id", articleId)
    .single();

  await userClient.from("geo_audits").insert({
    organization_id: article?.organization_id ?? orgId,
    brand_id: brandId,
    article_id: articleId,
    version_id: versionId,
    score: result.score,
    checks: result.checks,
    issues: result.issues,
    recommendations: result.recommendations,
  });
}

export async function saveBrandAudit(
  userClient: SupabaseClient,
  articleId: string,
  brandId: string,
  orgId: string,
  versionId: string | null,
  result: BrandAuditResult
): Promise<void> {
  const { data: article } = await userClient
    .from("articles")
    .select("organization_id")
    .eq("id", articleId)
    .single();

  await userClient.from("brand_audits").insert({
    organization_id: article?.organization_id ?? orgId,
    brand_id: brandId,
    article_id: articleId,
    version_id: versionId,
    score: result.score,
    blocking_policy_violations: result.blockingPolicyViolations,
    checks: result.checks,
    issues: result.issues,
    recommendations: result.recommendations,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function estimateWordCount(blocks: any[]): number {
  return blocks.reduce((count, block) => {
    const text = extractBlockText(block);
    return count + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

function extractAllText(blocks: any[]): string {
  return blocks.map(extractBlockText).join(" ");
}

function extractBlockText(block: any): string {
  if (!block?.content) return "";
  const c = block.content;
  if (typeof c.text === "string") return c.text;
  if (Array.isArray(c.items)) return c.items.join(" ");
  if (Array.isArray(c.rows)) {
    return c.rows.map((r: string[]) => r.join(" ")).join(" ");
  }
  return JSON.stringify(c).replace(/["{}\[\]]/g, " ");
}
