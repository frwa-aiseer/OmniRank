-- ============================================================================
-- Migration: 20261113000014_omnirouter_schema.sql
-- Gate: OR-P08 — OmniRouter and Content Generation
-- Description: Provider-neutral AI task routing tables.
--   Applications request task codes + quality/cost constraints.
--   Provider-specific logic stays inside the routing layer only.
--   RLS enforced: usage events are org-scoped, models/tasks are global config.
-- ============================================================================

-- ============================================================================
-- 1. AI TASK CATALOG
-- Task codes that the application uses. Never contains provider names.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_tasks (
  code          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN (
                  'brand_extraction', 'classification', 'keyword_clustering',
                  'research_synthesis', 'content_brief', 'article_draft',
                  'block_rewrite', 'fact_check', 'seo_audit', 'geo_audit',
                  'brand_audit', 'evidence_check'
                )),
  description   TEXT,
  max_input_tokens INT NOT NULL DEFAULT 4096,
  max_output_tokens INT NOT NULL DEFAULT 2048,
  default_quality TEXT NOT NULL DEFAULT 'balanced' CHECK (default_quality IN ('economy', 'balanced', 'quality')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed canonical task catalog
INSERT INTO public.ai_tasks (code, title, category, description, max_input_tokens, max_output_tokens, default_quality) VALUES
  ('brand_extraction',    'Brand Extraction',           'brand_extraction',   'Extract structured brand information from text',  8192,  2048, 'balanced'),
  ('classification',      'Content Classification',     'classification',     'Classify content type, intent, and audience',     4096,  512,  'economy'),
  ('keyword_clustering',  'Keyword Clustering',         'keyword_clustering', 'Group keywords into semantic topic clusters',     8192,  2048, 'economy'),
  ('research_synthesis',  'Research Synthesis',         'research_synthesis', 'Synthesize findings from multiple research sources', 16384, 4096, 'quality'),
  ('content_brief',       'Content Brief Generation',   'content_brief',      'Generate a structured content brief from research', 16384, 4096, 'balanced'),
  ('article_draft',       'Article Draft Generation',   'article_draft',      'Generate full article blocks from approved brief',  32768, 8192, 'quality'),
  ('block_rewrite',       'Block Rewrite',              'block_rewrite',      'Rewrite a single article block preserving intent',  4096,  2048, 'balanced'),
  ('fact_check',          'Fact Check',                 'fact_check',         'Verify factual claims against evidence corpus',     8192,  2048, 'quality'),
  ('seo_audit',           'SEO Audit',                  'seo_audit',          'Audit article for SEO quality and opportunities',   8192,  2048, 'balanced'),
  ('geo_audit',           'GEO Audit',                  'geo_audit',          'Audit article for Generative Engine Optimization',  8192,  2048, 'balanced'),
  ('brand_audit',         'Brand Compliance Audit',     'brand_audit',        'Check content against brand policies and voice',    8192,  2048, 'balanced'),
  ('evidence_check',      'Evidence Sufficiency Check', 'evidence_check',     'Check if claims are supported by evidence',         8192,  2048, 'balanced')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. AI MODEL REGISTRY
-- Registered models. Never referenced by application-layer code directly.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'anthropic', 'local')),
  model_id      TEXT NOT NULL,                    -- provider's model identifier
  display_name  TEXT NOT NULL,
  quality_tier  TEXT NOT NULL CHECK (quality_tier IN ('economy', 'balanced', 'quality')),
  context_window INT NOT NULL DEFAULT 8192,
  max_output_tokens INT NOT NULL DEFAULT 2048,
  supports_structured_output BOOLEAN NOT NULL DEFAULT true,
  supports_streaming BOOLEAN NOT NULL DEFAULT true,
  cost_per_1k_input_tokens  NUMERIC(10,6) NOT NULL DEFAULT 0,  -- USD; 0 = free tier
  cost_per_1k_output_tokens NUMERIC(10,6) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed free-first Gemini models (Gemini Flash is free-tier eligible)
INSERT INTO public.ai_models (provider, model_id, display_name, quality_tier, context_window, max_output_tokens, cost_per_1k_input_tokens, cost_per_1k_output_tokens) VALUES
  ('gemini', 'gemini-2.0-flash',         'Gemini 2.0 Flash',         'economy',  1048576, 8192,  0.000075, 0.000300),
  ('gemini', 'gemini-2.0-flash-lite',    'Gemini 2.0 Flash-Lite',    'economy',   32768,  2048,  0.000000, 0.000000),
  ('gemini', 'gemini-2.5-flash',         'Gemini 2.5 Flash',         'balanced', 1048576, 16384, 0.000075, 0.000300),
  ('gemini', 'gemini-2.5-pro',           'Gemini 2.5 Pro',           'quality',  2097152, 65536, 0.001250, 0.010000)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. ROUTING POLICIES
-- Maps task codes to preferred models with fallback chain.
-- Quality constraints are honored: application code never selects models.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_routing_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code       TEXT NOT NULL REFERENCES public.ai_tasks(code) ON DELETE CASCADE,
  quality_tier    TEXT NOT NULL CHECK (quality_tier IN ('economy', 'balanced', 'quality')),
  primary_model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE RESTRICT,
  fallback_model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,
  timeout_ms      INT NOT NULL DEFAULT 30000,
  max_retries     INT NOT NULL DEFAULT 2,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_code, quality_tier)
);

-- ============================================================================
-- 4. AI USAGE EVENTS (internal cost ledger — org-scoped)
-- Never exposed to client. Service-role only for inserts from server.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id          UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task_code         TEXT NOT NULL REFERENCES public.ai_tasks(code),
  model_id          UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,

  -- Context references (at most one of these per event)
  article_id        UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  research_project_id UUID REFERENCES public.research_projects(id) ON DELETE SET NULL,
  brief_id          UUID REFERENCES public.content_briefs(id) ON DELETE SET NULL,

  -- Measurements
  input_tokens      INT NOT NULL DEFAULT 0,
  output_tokens     INT NOT NULL DEFAULT 0,
  latency_ms        INT,
  cost_usd          NUMERIC(12,8) NOT NULL DEFAULT 0,
  success           BOOLEAN NOT NULL DEFAULT true,
  error_message     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org ON public.ai_usage_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_brand ON public.ai_usage_events(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON public.ai_usage_events(task_code, created_at DESC);

-- RLS: ai_tasks and ai_models are global config (readable by authenticated users)
ALTER TABLE public.ai_tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routing_policies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events       ENABLE ROW LEVEL SECURITY;

-- Tasks and models: global read for authenticated
CREATE POLICY "ai_tasks_read" ON public.ai_tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_models_read" ON public.ai_models
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_routing_policies_read" ON public.ai_routing_policies
  FOR SELECT TO authenticated USING (true);

-- Usage events: org members can read their own org's usage
CREATE POLICY "ai_usage_events_org_read" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id) OR authz.is_org_admin(organization_id));

-- Usage events: only service role can insert (never direct client inserts)
-- (No INSERT/UPDATE/DELETE policy for authenticated — server uses service role for cost tracking)
