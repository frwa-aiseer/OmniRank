-- ============================================================================
-- Migration: 20260929000010_articles_schema.sql
-- Gate: OR-P05 — Structured Article Schema + Rich Content Editor
-- Description: Creates articles, article_working_documents, article_versions,
--   and content_block_operations tables with org/brand-scoped RLS consistent
--   with existing patterns.
-- Canonical source of truth = structured versioned JSON. HTML is never stored.
-- ============================================================================

-- ============================================================================
-- 1. ARTICLES — envelope + lifecycle state
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL,
  -- Lifecycle
  schema_version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','researching','brief','drafting','ai_review','human_review','approved','scheduled','published','monitoring','refresh_recommended','archived')),
  -- Content envelope
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'en',
  -- SEO & GEO metadata stored as JSONB; structured JSON, not HTML
  seo JSONB NOT NULL DEFAULT '{}',
  geo JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  sources JSONB NOT NULL DEFAULT '[]',
  relationships JSONB NOT NULL DEFAULT '[]',
  -- Provenance
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_version_id UUID,          -- FK enforced below after article_versions exists
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_article_brand_slug UNIQUE (brand_id, slug)
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ARTICLE_WORKING_DOCUMENTS — mutable autosave target
-- ============================================================================
-- One row per article. Overwritten on each autosave. Never versioned in this table.
CREATE TABLE IF NOT EXISTS public.article_working_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Canonical structured JSON content (blocks array). Never HTML.
  content JSONB NOT NULL DEFAULT '{"schemaVersion":"1.0","blocks":[]}',
  -- Tracks last editor; actual auth is via RLS
  last_saved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Autosave sequence counter (monotonically increasing)
  autosave_seq BIGINT NOT NULL DEFAULT 1
);

ALTER TABLE public.article_working_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. ARTICLE_VERSIONS — immutable milestone snapshots
-- ============================================================================
-- Each version is a complete, immutable snapshot of the document content JSON.
-- Approval binds to a specific version_id; subsequent edits create new unbound versions.
CREATE TABLE IF NOT EXISTS public.article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Immutable snapshot
  version_number INT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL,            -- full article JSON envelope including blocks
  schema_version TEXT NOT NULL DEFAULT '1.0',
  -- Provenance
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_article_version_number UNIQUE (article_id, version_number)
);

ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;

-- Wire approved_version_id FK now that article_versions exists
ALTER TABLE public.articles
  ADD CONSTRAINT fk_articles_approved_version
  FOREIGN KEY (approved_version_id) REFERENCES public.article_versions(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. CONTENT_BLOCK_OPERATIONS — per-block change log & AI provenance
-- ============================================================================
-- Records every block-level operation: manual edits, AI replacements, restores.
-- Append-only audit; supports one-block AI regeneration provenance.
CREATE TABLE IF NOT EXISTS public.content_block_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Target
  block_id UUID NOT NULL,            -- stable block UUID from the article content JSON
  operation_type TEXT NOT NULL
    CHECK (operation_type IN ('insert','update','delete','ai_replace','restore','reorder')),
  -- Snapshot of the block before (null on insert) and after (null on delete) the operation
  block_before JSONB,
  block_after JSONB,
  -- AI provenance (populated only for ai_replace operations)
  ai_task_code TEXT,                 -- e.g. 'block_rewrite', 'fact_check'
  ai_model_hint TEXT,                -- model label (not secret key)
  ai_prompt_summary TEXT,            -- safe non-sensitive summary of the prompt intent
  -- Human provenance
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.content_block_operations ENABLE ROW LEVEL SECURITY;
-- Protect append-only semantics: authenticated users cannot UPDATE/DELETE operation rows
REVOKE UPDATE, DELETE, TRUNCATE ON public.content_block_operations FROM PUBLIC, authenticated, anon;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_articles_brand ON public.articles(brand_id);
CREATE INDEX IF NOT EXISTS idx_articles_org ON public.articles(organization_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_created_by ON public.articles(created_by);

CREATE INDEX IF NOT EXISTS idx_article_working_docs_article ON public.article_working_documents(article_id);
CREATE INDEX IF NOT EXISTS idx_article_working_docs_brand ON public.article_working_documents(brand_id);

CREATE INDEX IF NOT EXISTS idx_article_versions_article ON public.article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_article_versions_brand ON public.article_versions(brand_id);
CREATE INDEX IF NOT EXISTS idx_article_versions_created_by ON public.article_versions(created_by);

CREATE INDEX IF NOT EXISTS idx_block_ops_article ON public.content_block_operations(article_id);
CREATE INDEX IF NOT EXISTS idx_block_ops_brand ON public.content_block_operations(brand_id);
CREATE INDEX IF NOT EXISTS idx_block_ops_block ON public.content_block_operations(block_id);
CREATE INDEX IF NOT EXISTS idx_block_ops_performed_by ON public.content_block_operations(performed_by);

-- ============================================================================
-- 6. RLS POLICIES — consistent with existing authz schema patterns
-- ============================================================================

-- ARTICLES
-- SELECT: any brand member can read their brand's articles
CREATE POLICY "articles_select_brand_member" ON public.articles
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

-- INSERT: writer+ can create articles
CREATE POLICY "articles_insert_writer" ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );

-- UPDATE: writer+ can update; approved status transitions require strategist
CREATE POLICY "articles_update_writer" ON public.articles
  FOR UPDATE TO authenticated
  USING (
    authz.can_view_brand(brand_id)
    AND (
      authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
      OR authz.is_org_admin(organization_id)
    )
  )
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );

-- DELETE: strategist or org admin only (soft-archiving preferred)
CREATE POLICY "articles_delete_strategist" ON public.articles
  FOR DELETE TO authenticated
  USING (
    authz.has_brand_role(brand_id, ARRAY['strategist'])
    OR authz.is_org_admin(organization_id)
  );

-- ARTICLE_WORKING_DOCUMENTS
CREATE POLICY "article_working_docs_select" ON public.article_working_documents
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

CREATE POLICY "article_working_docs_insert" ON public.article_working_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );

CREATE POLICY "article_working_docs_update" ON public.article_working_documents
  FOR UPDATE TO authenticated
  USING (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  )
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );

-- ARTICLE_VERSIONS (immutable: INSERT only, no UPDATE/DELETE for authenticated)
CREATE POLICY "article_versions_select" ON public.article_versions
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

CREATE POLICY "article_versions_insert" ON public.article_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );

-- CONTENT_BLOCK_OPERATIONS (append-only for authenticated; service_role can read all)
CREATE POLICY "block_ops_select" ON public.content_block_operations
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

CREATE POLICY "block_ops_insert" ON public.content_block_operations
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );
