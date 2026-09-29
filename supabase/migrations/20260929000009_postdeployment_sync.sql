-- ============================================================================
-- Migration: 20260929000009_postdeployment_sync.sql
-- Gate: OR-G04G — Post-Deployment Sync
-- Description: Creates compatibility functions observed during live deployment,
--   hardens existing trigger functions, and adds missing FK indexes.
-- Idempotent: All statements use CREATE OR REPLACE or IF NOT EXISTS.
-- Does NOT modify migrations 00001–00008.
-- ============================================================================

-- ============================================================================
-- 1. authz.get_org_role(UUID) — compatibility function added during live deploy
-- ============================================================================
-- Returns the caller's role in the given organization, or NULL if not a member.
-- Used by client-side tenancy resolution and settings UI.

CREATE OR REPLACE FUNCTION authz.get_org_role(_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT om.role::text
  FROM public.organization_members om
  WHERE om.organization_id = _org_id
    AND om.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION authz.get_org_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION authz.get_org_role(UUID) TO authenticated, service_role;

-- ============================================================================
-- 2. authz.get_brand_role(UUID) — compatibility function added during live deploy
-- ============================================================================
-- Returns the caller's brand-level role, or NULL.
-- Org owner/admin inherits 'strategist' (full operational authority) even
-- without an explicit brand_members row.

CREATE OR REPLACE FUNCTION authz.get_brand_role(_brand_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    -- Explicit brand membership takes priority
    (
      SELECT bm.role::text
      FROM public.brand_members bm
      WHERE bm.brand_id = _brand_id
        AND bm.user_id = auth.uid()
      LIMIT 1
    ),
    -- Org owner/admin inherits strategist authority
    (
      SELECT 'strategist'
      FROM public.brands b
      JOIN public.organization_members om
        ON om.organization_id = b.organization_id
       AND om.user_id = auth.uid()
       AND om.role IN ('owner', 'admin')
      WHERE b.id = _brand_id
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION authz.get_brand_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION authz.get_brand_role(UUID) TO authenticated, service_role;

-- ============================================================================
-- 3. Harden public.handle_new_user() — revoke from authenticated
-- ============================================================================
-- Migration 00008 revoked from PUBLIC and anon but not authenticated.
-- This function is a trigger on auth.users and must never be callable by
-- authenticated users directly.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- ============================================================================
-- 4. Harden authz.prevent_audit_tampering() — add SET search_path = ''
-- ============================================================================
-- Original definition in migration 00004 omitted the search_path pinning.
-- Recreate idempotently with the hardened signature.

CREATE OR REPLACE FUNCTION authz.prevent_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Brand audit logs are strictly append-only and cannot be updated or deleted.';
END;
$$;

-- Trigger already exists from migration 00004; no change needed.

-- ============================================================================
-- 5. Low-risk FK indexes for columns used in JOINs and RLS policy evaluation
-- ============================================================================
-- Only adding indexes on FK columns that are actively queried (via RLS policies,
-- ingestion JOINs, or cascade deletes) but currently lack an index.

-- knowledge_sources.organization_id — used in tenancy validation JOINs
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org ON public.knowledge_sources(organization_id);

-- knowledge_documents.source_id — FK to knowledge_sources, used in cascade/ingestion queries
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source ON public.knowledge_documents(source_id);

-- knowledge_chunks.source_id — FK to knowledge_sources, used in ingestion pipeline
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON public.knowledge_chunks(source_id);

-- evidence_claim_sources.source_id — FK to evidence_sources, used in evidence resolution
CREATE INDEX IF NOT EXISTS idx_evidence_claim_sources_source ON public.evidence_claim_sources(source_id);

-- evidence_claim_sources.document_id — nullable FK, used in provenance JOINs
CREATE INDEX IF NOT EXISTS idx_evidence_claim_sources_doc ON public.evidence_claim_sources(document_id);

-- evidence_claim_sources.chunk_id — nullable FK, used in chunk-level evidence lookup
CREATE INDEX IF NOT EXISTS idx_evidence_claim_sources_chunk ON public.evidence_claim_sources(chunk_id);
