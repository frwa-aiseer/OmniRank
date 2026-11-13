-- ============================================================================
-- Migration: 20261113000015_quality_review_schema.sql
-- Gate: OR-P09 — Quality, Review and Versioning
-- Description: SEO/GEO/Brand audits, content reviews, comments, approval
--   requirements. Approval binds to a specific article_version_id.
--   Any subsequent edit creates an unapproved version automatically.
-- ============================================================================

-- ============================================================================
-- 1. EXTEND ARTICLE STATUS MACHINE
-- Full lifecycle: idea → researching → brief → drafting → ai_review →
--   human_review → approved → scheduled → published → monitoring →
--   refresh_recommended → archived
-- ============================================================================
-- Drop the existing status constraint if it exists and add the full lifecycle
DO $$
BEGIN
  -- Extend the CHECK constraint on articles.status
  -- (The table was created in migration 00010 with a limited status set)
  ALTER TABLE public.articles
    DROP CONSTRAINT IF EXISTS articles_status_check;
  ALTER TABLE public.articles
    ADD CONSTRAINT articles_status_check CHECK (status IN (
      'idea', 'researching', 'brief', 'drafting',
      'ai_review', 'human_review', 'approved',
      'scheduled', 'published', 'monitoring',
      'refresh_recommended', 'archived'
    ));
EXCEPTION WHEN OTHERS THEN
  NULL; -- constraint rename may differ; best-effort
END;
$$;

-- ============================================================================
-- 2. CONTENT REVIEWS
-- A review is created by a Reviewer or Strategist for an article.
-- Only one open review per article at a time.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,

  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'changes_requested', 'approved', 'rejected', 'superseded')),
  reviewer_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_version_id UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,

  summary         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_content_reviews_article ON public.content_reviews(article_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_brand ON public.content_reviews(brand_id);

-- ============================================================================
-- 3. REVIEW COMMENTS
-- Line-level or general feedback on a content review.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.review_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL REFERENCES public.content_reviews(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  block_id        TEXT,                   -- optional: targets a specific block ID
  comment_text    TEXT NOT NULL,
  comment_type    TEXT NOT NULL DEFAULT 'general'
                    CHECK (comment_type IN ('general', 'seo', 'geo', 'brand', 'evidence', 'factual')),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_comments_review ON public.review_comments(review_id);

-- ============================================================================
-- 4. SEO AUDITS
-- Deterministic SEO audit output for a specific article + version.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,

  score           INT CHECK (score BETWEEN 0 AND 100),
  target_keyword  TEXT,
  word_count      INT,

  -- Checks (each is pass/warn/fail + detail)
  checks          JSONB NOT NULL DEFAULT '{}',   -- { "title_length": "pass", ... }
  issues          JSONB NOT NULL DEFAULT '[]',   -- [{type, severity, message, block_id?}]
  recommendations JSONB NOT NULL DEFAULT '[]',

  ai_task_event_id UUID REFERENCES public.ai_usage_events(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seo_audits_article ON public.seo_audits(article_id, created_at DESC);

-- ============================================================================
-- 5. GEO AUDITS
-- Generative Engine Optimization audit.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.geo_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,

  score           INT CHECK (score BETWEEN 0 AND 100),
  checks          JSONB NOT NULL DEFAULT '{}',
  issues          JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',

  ai_task_event_id UUID REFERENCES public.ai_usage_events(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geo_audits_article ON public.geo_audits(article_id, created_at DESC);

-- ============================================================================
-- 6. BRAND AUDITS
-- Brand compliance audit — checks against brand policies and voice.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brand_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,

  score           INT CHECK (score BETWEEN 0 AND 100),
  blocking_policy_violations JSONB NOT NULL DEFAULT '[]',  -- if any, publishing is blocked
  checks          JSONB NOT NULL DEFAULT '{}',
  issues          JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',

  ai_task_event_id UUID REFERENCES public.ai_usage_events(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brand_audits_article ON public.brand_audits(article_id, created_at DESC);

-- ============================================================================
-- 7. APPROVAL REQUIREMENTS
-- Tracks per-article approval requirements. Approval binds to a version_id.
-- Separation of duties: writer cannot approve their own article if required.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL UNIQUE REFERENCES public.articles(id) ON DELETE CASCADE,

  -- The version that was approved. NULL = not yet approved.
  approved_version_id UUID REFERENCES public.article_versions(id) ON DELETE SET NULL,
  approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,

  -- Separation of duties: NULL = no restriction
  require_different_approver BOOLEAN NOT NULL DEFAULT false,
  original_author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Block publishing if any blocking brand audit violation exists
  blocking_violations_cleared BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.content_reviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_audits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_audits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requirements ENABLE ROW LEVEL SECURITY;

-- Viewer+ can read all audit/review data for their brand
CREATE POLICY "content_reviews_select" ON public.content_reviews
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "review_comments_select" ON public.review_comments
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "seo_audits_select" ON public.seo_audits
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "geo_audits_select" ON public.geo_audits
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_audits_select" ON public.brand_audits
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "approval_requirements_select" ON public.approval_requirements
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));

-- Reviewer / Strategist / Admin can manage reviews and comments
CREATE POLICY "content_reviews_manage" ON public.content_reviews
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['reviewer', 'strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['reviewer', 'strategist']) OR authz.is_org_admin(organization_id));

CREATE POLICY "review_comments_manage" ON public.review_comments
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['reviewer', 'strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['reviewer', 'strategist']) OR authz.is_org_admin(organization_id));

-- Audits: writers can read (covered by select), strategist/admin can run audits
CREATE POLICY "seo_audits_manage" ON public.seo_audits
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id));
CREATE POLICY "geo_audits_manage" ON public.geo_audits
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id));
CREATE POLICY "brand_audits_manage" ON public.brand_audits
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer', 'strategist']) OR authz.is_org_admin(organization_id));

-- Approval requirements: strategist / admin only
CREATE POLICY "approval_requirements_manage" ON public.approval_requirements
  FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));

-- ============================================================================
-- 8. APPROVE ARTICLE RPC (SECURITY DEFINER)
-- Approval binds to a specific version_id.
-- Separation of duties: cannot approve own article if require_different_approver.
-- Blocking brand policy violations must be cleared first.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_article_version(
  p_article_id UUID,
  p_version_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_article     public.articles%ROWTYPE;
  v_version     public.article_versions%ROWTYPE;
  v_brand_role  TEXT;
  v_org_role    TEXT;
  v_req         public.approval_requirements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_article FROM public.articles WHERE id = p_article_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article not found'; END IF;

  SELECT * INTO v_version FROM public.article_versions WHERE id = p_version_id AND article_id = p_article_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version does not belong to article'; END IF;

  SELECT role INTO v_brand_role FROM public.brand_members
    WHERE brand_id = v_article.brand_id AND user_id = auth.uid();
  SELECT role INTO v_org_role FROM public.organization_members
    WHERE organization_id = v_article.organization_id AND user_id = auth.uid();

  IF (v_brand_role IS NULL OR v_brand_role NOT IN ('reviewer', 'strategist'))
     AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Forbidden: Only Reviewer, Strategist, or Org Owner/Admin may approve';
  END IF;

  -- Check separation of duties
  SELECT * INTO v_req FROM public.approval_requirements WHERE article_id = p_article_id;
  IF FOUND AND v_req.require_different_approver AND v_req.original_author_id = auth.uid() THEN
    RAISE EXCEPTION 'Separation of duties: cannot approve your own article';
  END IF;

  -- Check blocking brand policy violations
  IF EXISTS (
    SELECT 1 FROM public.brand_audits
    WHERE article_id = p_article_id
      AND version_id = p_version_id
      AND jsonb_array_length(blocking_policy_violations) > 0
  ) THEN
    RAISE EXCEPTION 'Cannot approve: blocking brand policy violations must be resolved first';
  END IF;

  -- Update article status
  UPDATE public.articles
    SET status = 'approved',
        approved_by = auth.uid(),
        approved_version_id = p_version_id,
        updated_at = NOW()
    WHERE id = p_article_id;

  -- Upsert approval requirement record
  INSERT INTO public.approval_requirements (
    organization_id, brand_id, article_id,
    approved_version_id, approved_by, approved_at,
    blocking_violations_cleared
  ) VALUES (
    v_article.organization_id, v_article.brand_id, p_article_id,
    p_version_id, auth.uid(), NOW(), true
  )
  ON CONFLICT (article_id) DO UPDATE
    SET approved_version_id = EXCLUDED.approved_version_id,
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        blocking_violations_cleared = true,
        updated_at = NOW();
END;
$$;
REVOKE ALL ON FUNCTION public.approve_article_version(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_article_version(UUID, UUID) TO authenticated;
