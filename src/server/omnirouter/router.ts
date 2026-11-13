/**
 * OR-P08 — OmniRouter
 *
 * Provider-neutral AI abstraction layer. Applications request task codes
 * and quality/cost constraints; OmniRouter selects the model, calls the
 * provider, records usage, and returns structured or text output.
 *
 * RULES:
 * - App code never imports provider adapters directly.
 * - App code never references model IDs, provider names, or API keys.
 * - Cost tracking uses service-role Supabase client (never user-scoped).
 * - All provider-specific logic stays inside adapters.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { RouterRequest, RouterResponse, AiModel, RoutingPolicy, QualityTier } from "../../types/omnirouter.ts";
import { callGemini } from "./gemini-adapter.ts";
import { getServerEnv } from "../env.ts";

// ---------------------------------------------------------------------------
// Static fallback routing table (used when DB is not available / cold start)
// Maps (taskCode, quality) → preferred Gemini model ID
// ---------------------------------------------------------------------------
const STATIC_ROUTING: Record<string, Record<QualityTier, string>> = {
  brand_extraction:   { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash", quality: "gemini-2.5-flash" },
  classification:     { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash-lite", quality: "gemini-2.0-flash" },
  keyword_clustering: { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash", quality: "gemini-2.0-flash" },
  research_synthesis: { economy: "gemini-2.0-flash",      balanced: "gemini-2.5-flash", quality: "gemini-2.5-pro" },
  content_brief:      { economy: "gemini-2.0-flash",      balanced: "gemini-2.5-flash", quality: "gemini-2.5-pro" },
  article_draft:      { economy: "gemini-2.0-flash",      balanced: "gemini-2.5-flash", quality: "gemini-2.5-pro" },
  block_rewrite:      { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash", quality: "gemini-2.5-flash" },
  fact_check:         { economy: "gemini-2.0-flash",      balanced: "gemini-2.5-flash", quality: "gemini-2.5-pro" },
  seo_audit:          { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash", quality: "gemini-2.5-flash" },
  geo_audit:          { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash", quality: "gemini-2.5-flash" },
  brand_audit:        { economy: "gemini-2.0-flash-lite", balanced: "gemini-2.0-flash", quality: "gemini-2.5-flash" },
  evidence_check:     { economy: "gemini-2.0-flash",      balanced: "gemini-2.5-flash", quality: "gemini-2.5-pro" },
};

// ---------------------------------------------------------------------------
// OmniRouter class
// ---------------------------------------------------------------------------
export class OmniRouter {
  constructor(
    /** Service-role client for cost event inserts. Never used for user data. */
    private serviceClient: SupabaseClient
  ) {}

  async route(request: RouterRequest): Promise<RouterResponse> {
    const quality: QualityTier = request.quality ?? "balanced";
    const modelId = STATIC_ROUTING[request.taskCode]?.[quality] ?? "gemini-2.0-flash";
    const timeoutMs = request.timeoutMs ?? 30000;

    // Try primary model
    let response = await callGemini(modelId, request, timeoutMs);

    // Try fallback if primary failed (use economy model as fallback)
    if (!response.success && quality !== "economy") {
      const fallbackId = STATIC_ROUTING[request.taskCode]?.economy ?? "gemini-2.0-flash-lite";
      if (fallbackId !== modelId) {
        response = await callGemini(fallbackId, request, timeoutMs);
        if (response.success) {
          response.modelUsed = `${fallbackId} (fallback)`;
        }
      }
    }

    // Record usage event (best-effort; never block the response)
    this.recordUsage(request, response, modelId).catch(() => {/* silent */});

    return response;
  }

  private async recordUsage(
    request: RouterRequest,
    response: RouterResponse,
    modelId: string
  ): Promise<void> {
    if (!request.context?.organizationId) return;

    // Look up model UUID from registry
    const { data: model } = await this.serviceClient
      .from("ai_models")
      .select("id")
      .eq("model_id", modelId)
      .single();

    await this.serviceClient.from("ai_usage_events").insert({
      organization_id: request.context.organizationId,
      brand_id: request.context.brandId ?? null,
      user_id: request.context.userId ?? null,
      task_code: request.taskCode,
      model_id: model?.id ?? null,
      article_id: request.context.articleId ?? null,
      research_project_id: request.context.researchProjectId ?? null,
      brief_id: request.context.briefId ?? null,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      latency_ms: response.latencyMs,
      cost_usd: this.estimateCost(modelId, response.inputTokens, response.outputTokens),
      success: response.success,
      error_message: response.error ?? null,
    });
  }

  private estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    // Approximate pricing per 1k tokens (USD)
    const pricing: Record<string, { in: number; out: number }> = {
      "gemini-2.0-flash-lite": { in: 0, out: 0 },
      "gemini-2.0-flash":      { in: 0.000075, out: 0.0003 },
      "gemini-2.5-flash":      { in: 0.000075, out: 0.0003 },
      "gemini-2.5-pro":        { in: 0.00125,  out: 0.01 },
    };
    const p = pricing[modelId] ?? { in: 0, out: 0 };
    return (inputTokens / 1000) * p.in + (outputTokens / 1000) * p.out;
  }
}

// ---------------------------------------------------------------------------
// Singleton factory (cached per process)
// ---------------------------------------------------------------------------
let _router: OmniRouter | null = null;

export function getOmniRouter(serviceClient: SupabaseClient): OmniRouter {
  if (!_router) {
    _router = new OmniRouter(serviceClient);
  }
  return _router;
}
