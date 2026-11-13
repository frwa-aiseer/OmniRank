/**
 * OR-P08 — OmniRouter Types
 *
 * Applications request task codes + quality/cost constraints.
 * Never reference model names, provider names, or API keys in app code.
 * Provider-specific logic stays inside OmniRouter only.
 */

export type AiTaskCode =
  | 'brand_extraction'
  | 'classification'
  | 'keyword_clustering'
  | 'research_synthesis'
  | 'content_brief'
  | 'article_draft'
  | 'block_rewrite'
  | 'fact_check'
  | 'seo_audit'
  | 'geo_audit'
  | 'brand_audit'
  | 'evidence_check';

export type QualityTier = 'economy' | 'balanced' | 'quality';

export interface RouterRequest {
  /** Task code — the only thing app code specifies */
  taskCode: AiTaskCode;
  /** Cost/quality constraint. Defaults to task default if omitted. */
  quality?: QualityTier;
  /** System prompt. Must NOT contain provider hints or secret keys. */
  systemPrompt: string;
  /** User prompt / request content */
  userPrompt: string;
  /** If true, response is a structured JSON object */
  structuredOutput?: boolean;
  /** JSON schema for structured output validation */
  outputSchema?: Record<string, unknown>;
  /** Override timeout in ms */
  timeoutMs?: number;
  /** Context references for cost tracking */
  context?: {
    organizationId?: string;
    brandId?: string;
    articleId?: string;
    researchProjectId?: string;
    briefId?: string;
    userId?: string;
  };
}

export interface RouterResponse {
  success: boolean;
  text?: string;
  structured?: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  modelUsed: string;   // display name only — not an API key
  taskCode: AiTaskCode;
  error?: string;
}

export interface AiModel {
  id: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'local';
  modelId: string;
  displayName: string;
  qualityTier: QualityTier;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStructuredOutput: boolean;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
}

export interface RoutingPolicy {
  taskCode: AiTaskCode;
  qualityTier: QualityTier;
  primaryModel: AiModel;
  fallbackModel?: AiModel;
  timeoutMs: number;
  maxRetries: number;
}
