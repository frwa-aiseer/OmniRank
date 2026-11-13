-- ============================================================================
-- Migration: 20261113000016_wordpress_publishing_schema.sql
-- Gate: OR-P10 — WordPress Publishing
-- Description: Secure WordPress integration schema with protected credential
--   references, CMS content mappings, sanitized publishing jobs, and idempotency.
--   Credentials are kept strictly server-only and out of client responses.
-- ============================================================================

-- ============================================================================
-- 1. INTEGRATIONS (tenant-scoped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  website_id      UUID REFERENCES public.websites(id) ON DELETE SET NULL,

  type            TEXT NOT NULL CHECK (type IN ('wordpress', 'webflow', 'ghost', 'custom_webhook')),
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  config          JSONB NOT NULL DEFAULT '{}',   -- public non-secret config (site_url, author_id, categories)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integrations_brand ON public.integrations(brand_id);

-- ============================================================================
-- 2. PROTECTED CREDENTIALS (server-only secrets)
-- Stores revocable programmatic Application Passwords.
-- Normal client queries should NEVER select secrets; only masked preview.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.protected_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID NOT NULL UNIQUE REFERENCES public.integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

  endpoint_url    TEXT NOT NULL,
  username        TEXT NOT NULL,
  app_password    TEXT NOT NULL,                 -- revocable programmatic credential
  auth_type       TEXT NOT NULL DEFAULT 'application_password' CHECK (auth_type IN ('application_password', 'bearer_token', 'basic')),

  last_tested_at  TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('success', 'failed')),
  last_test_error TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_protected_credentials_integration ON public.protected_credentials(integration_id);

-- ============================================================================
-- 3. CMS CONTENT MAPPINGS (links OmniRank articles to remote CMS posts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cms_content_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,
  integration_id  UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,

  remote_post_id  TEXT NOT NULL,
  remote_url      TEXT,
  remote_status   TEXT NOT NULL DEFAULT 'draft' CHECK (remote_status IN ('draft', 'publish', 'future', 'pending', 'private')),
  last_published_at TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, integration_id)
);
CREATE INDEX IF NOT EXISTS idx_cms_mappings_article ON public.cms_content_mappings(article_id);

-- ============================================================================
-- 4. PUBLISHING JOBS (idempotent asynchronous or synchronous publish runs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_id      UUID NOT NULL REFERENCES public.article_versions(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,

  action          TEXT NOT NULL CHECK (action IN ('create_draft', 'publish', 'update', 'schedule')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  idempotency_key TEXT NOT NULL UNIQUE,

  attempts        INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  scheduled_for   TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_article ON public.publishing_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_idempotency ON public.publishing_jobs(idempotency_key);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.integrations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_mappings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_jobs        ENABLE ROW LEVEL SECURITY;

-- Integrations: Viewer+ can read, Strategist/Admin can manage
CREATE POLICY "integrations_select" ON public.integrations
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "integrations_manage" ON public.integrations
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));

-- Protected credentials: ONLY Strategist or Admin can read/manage (service role uses direct access)
CREATE POLICY "protected_credentials_manage" ON public.protected_credentials
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));

-- CMS Content Mappings: Viewer+ can read, Writer/Strategist/Admin can manage
CREATE POLICY "cms_content_mappings_select" ON public.cms_content_mappings
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "cms_content_mappings_manage" ON public.cms_content_mappings
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id));

-- Publishing Jobs: Viewer+ can read, Writer/Strategist/Admin can manage
CREATE POLICY "publishing_jobs_select" ON public.publishing_jobs
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "publishing_jobs_manage" ON public.publishing_jobs
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id));
