/**
 * OR-P08 — Content Generation Service
 *
 * Uses OmniRouter to generate article content from an approved Content Brief.
 * Never references model names or provider keys.
 * Context is retrieved from Brand Brain + Research via Supabase (user-scoped).
 * Structured output is validated before returning to caller.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { RouterRequest } from "../../types/omnirouter.ts";
import { OmniRouter } from "../omnirouter/router.ts";
import { ArticleBlock, V1_BLOCK_TYPES, ARTICLE_SCHEMA_VERSION } from "../../types/article.ts";

export interface GenerationContext {
  organizationId: string;
  brandId: string;
  userId: string;
  articleId?: string;
  researchProjectId?: string;
  briefId?: string;
}

export interface GenerateArticleRequest {
  briefId: string;
  brandId: string;
  context: GenerationContext;
  quality?: "economy" | "balanced" | "quality";
}

export interface GenerateBlockRequest {
  blockId: string;
  blockType: string;
  currentContent: Record<string, unknown>;
  instruction: string;
  brandId: string;
  context: GenerationContext;
  quality?: "economy" | "balanced" | "quality";
}

// ---------------------------------------------------------------------------
// Brief-to-Article Generation
// ---------------------------------------------------------------------------
export async function generateArticleFromBrief(
  userClient: SupabaseClient,
  router: OmniRouter,
  req: GenerateArticleRequest
): Promise<{ blocks: ArticleBlock[]; modelUsed: string }> {
  // 1. Fetch the approved brief
  const { data: brief, error: briefErr } = await userClient
    .from("content_briefs")
    .select("*")
    .eq("id", req.briefId)
    .eq("brand_id", req.brandId)
    .single();

  if (briefErr || !brief) throw new Error(`Brief not found: ${briefErr?.message ?? "not found"}`);
  if (brief.status !== "approved") throw new Error("Content brief must be approved before generation");

  // 2. Fetch brand context (Brand Brain — user-scoped)
  const { data: brandProfile } = await userClient
    .from("brand_profiles")
    .select("mission, positioning_statement, target_market, value_proposition, tone_keywords")
    .eq("brand_id", req.brandId)
    .maybeSingle();

  const { data: audiences } = await userClient
    .from("brand_audiences")
    .select("name, pain_points, goals")
    .eq("brand_id", req.brandId);

  const { data: policies } = await userClient
    .from("brand_policies")
    .select("title, description, severity, enforcement_action")
    .eq("brand_id", req.brandId)
    .eq("status", "active");

  // 3. Fetch selected research sources for context
  const sourceIds: string[] = Array.isArray(brief.source_selections) ? brief.source_selections : [];
  let sourceContext = "";
  if (sourceIds.length > 0) {
    const { data: sources } = await userClient
      .from("research_sources")
      .select("title, classification, extracted_text")
      .in("id", sourceIds.slice(0, 10));
    if (sources) {
      sourceContext = sources
        .map((s: any) => `[${s.classification}] ${s.title}: ${(s.extracted_text ?? "").slice(0, 500)}`)
        .join("\n\n");
    }
  }

  // 4. Build system + user prompt
  const systemPrompt = buildArticleSystemPrompt({
    brandProfile,
    audiences: audiences ?? [],
    policies: policies ?? [],
  });

  const userPrompt = buildArticleUserPrompt(brief, sourceContext);

  // 5. Route to OmniRouter
  const routerReq: RouterRequest = {
    taskCode: "article_draft",
    quality: req.quality ?? "balanced",
    systemPrompt,
    userPrompt,
    structuredOutput: true,
    context: req.context,
  };

  const response = await router.route(routerReq);
  if (!response.success) throw new Error(`Generation failed: ${response.error}`);

  // 6. Parse and validate blocks
  const rawBlocks = extractBlocksFromResponse(response);

  return { blocks: rawBlocks, modelUsed: response.modelUsed };
}

// ---------------------------------------------------------------------------
// Single Block Rewrite
// ---------------------------------------------------------------------------
export async function rewriteBlock(
  userClient: SupabaseClient,
  router: OmniRouter,
  req: GenerateBlockRequest
): Promise<{ block: Partial<ArticleBlock>; modelUsed: string }> {
  const { data: brandProfile } = await userClient
    .from("brand_profiles")
    .select("tone_keywords, value_proposition")
    .eq("brand_id", req.brandId)
    .maybeSingle();

  const systemPrompt = `You are a content rewriting assistant for a brand content platform.
Brand tone keywords: ${(brandProfile?.tone_keywords ?? []).join(", ") || "professional, clear"}.
Rewrite only the requested block. Return valid JSON matching the OmniRank block schema.
Never introduce facts not present in the original. Never add unsafe HTML or JavaScript.`;

  const userPrompt = `Rewrite the following ${req.blockType} block.
Instruction: ${req.instruction}

Current block content:
${JSON.stringify(req.currentContent, null, 2)}

Return JSON with shape: { "content": {...}, "attributes": {...} }`;

  const routerReq: RouterRequest = {
    taskCode: "block_rewrite",
    quality: req.quality ?? "balanced",
    systemPrompt,
    userPrompt,
    structuredOutput: true,
    context: req.context,
  };

  const response = await router.route(routerReq);
  if (!response.success) throw new Error(`Block rewrite failed: ${response.error}`);

  const updated = response.structured as { content?: Record<string, unknown>; attributes?: Record<string, unknown> } | undefined;

  return {
    block: {
      id: req.blockId,
      type: req.blockType as ArticleBlock["type"],
      content: updated?.content ?? req.currentContent,
      attributes: updated?.attributes ?? {},
      provenance: {
        createdBy: req.context.userId,
        createdAt: new Date().toISOString(),
        lastModifiedBy: req.context.userId,
        lastModifiedAt: new Date().toISOString(),
        aiGenerated: true,
        aiTaskCode: "block_rewrite",
        aiModelHint: response.modelUsed,
      },
    },
    modelUsed: response.modelUsed,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildArticleSystemPrompt(ctx: {
  brandProfile: any;
  audiences: any[];
  policies: any[];
}): string {
  const toneKeywords = (ctx.brandProfile?.tone_keywords ?? []).join(", ") || "professional, helpful";
  const audienceNames = ctx.audiences.map((a: any) => a.name).join(", ") || "general audience";
  const blockingPolicies = ctx.policies
    .filter((p: any) => p.severity === "blocking")
    .map((p: any) => `- ${p.title}: ${p.description}`)
    .join("\n");

  return `You are an expert content writer for a brand content platform.

Brand mission: ${ctx.brandProfile?.mission ?? ""}
Value proposition: ${ctx.brandProfile?.value_proposition ?? ""}
Target audiences: ${audienceNames}
Tone: ${toneKeywords}

BLOCKING POLICIES (must never be violated):
${blockingPolicies || "None specified"}

Generate structured article content as a JSON array of blocks.
Each block must follow this schema:
{
  "id": "<stable-uuid>",
  "type": "<one of: ${V1_BLOCK_TYPES.join(", ")}>",
  "schemaVersion": "${ARTICLE_SCHEMA_VERSION}",
  "content": {},
  "attributes": {},
  "sourceRefs": [],
  "evidenceRefs": [],
  "provenance": { "createdBy": "ai", "createdAt": "<ISO8601>", "aiGenerated": true }
}

Return: { "blocks": [...] }

NEVER:
- Include HTML tags in content fields
- Reference model names or API keys
- Add JavaScript
- Fabricate statistics or citations not in the brief/sources`;
}

function buildArticleUserPrompt(brief: any, sourceContext: string): string {
  const outline = Array.isArray(brief.outline)
    ? brief.outline.map((o: any, i: number) => `${i + 1}. ${o.heading ?? JSON.stringify(o)}`).join("\n")
    : "";

  return `Generate a full article based on this approved content brief.

TITLE: ${brief.title}
ANGLE: ${brief.angle}
TARGET AUDIENCE: ${brief.target_audience}
SEARCH INTENT: ${brief.search_intent}
PRIMARY OBJECTIVE: ${brief.primary_objective}
TARGET KEYWORD: ${brief.target_keyword ?? ""}
SUPPORTING KEYWORDS: ${(brief.supporting_keywords ?? []).join(", ")}
CTA: ${brief.cta ?? ""}

OUTLINE:
${outline}

RESEARCH SOURCES (use as reference — do not fabricate beyond this):
${sourceContext || "No external sources provided — use brand knowledge only."}

FAQ IDEAS: ${(brief.faq_ideas ?? []).join("; ")}

Generate the full article as structured blocks. Include all outline sections.
Return: { "blocks": [...array of block objects...] }`;
}

function extractBlocksFromResponse(response: {
  structured?: Record<string, unknown>;
  text?: string;
}): ArticleBlock[] {
  let raw: unknown[] = [];

  if (response.structured && Array.isArray((response.structured as any).blocks)) {
    raw = (response.structured as any).blocks;
  } else if (response.text) {
    try {
      const cleaned = response.text
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      raw = Array.isArray(parsed.blocks) ? parsed.blocks : [];
    } catch {
      raw = [];
    }
  }

  // Sanitize and validate each block
  return raw
    .filter((b: any) => b && typeof b === "object" && V1_BLOCK_TYPES.includes(b.type))
    .map((b: any): ArticleBlock => ({
      id: (typeof b.id === "string" && b.id) ? b.id : crypto.randomUUID(),
      type: b.type,
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      content: (b.content && typeof b.content === "object") ? b.content : {},
      attributes: (b.attributes && typeof b.attributes === "object") ? b.attributes : {},
      sourceRefs: Array.isArray(b.sourceRefs) ? b.sourceRefs.filter((s: any) => typeof s === "string") : [],
      evidenceRefs: Array.isArray(b.evidenceRefs) ? b.evidenceRefs.filter((s: any) => typeof s === "string") : [],
      provenance: {
        createdBy: (b.provenance?.createdBy) ?? "ai",
        createdAt: (b.provenance?.createdAt) ?? new Date().toISOString(),
        aiGenerated: true,
        aiTaskCode: "article_draft",
        aiModelHint: "OmniRouter",
      },
    }));
}
