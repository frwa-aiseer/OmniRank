-- ============================================================================
-- Migration: 20260929000007_live_foundation_closure.sql
-- Description: Final Canonical Live Foundation Closure Migration (OR-G04E)
-- Covers:
--   1. Safely remove / revoke legacy public SECURITY DEFINER auth helper functions
--   2. Fix public.rls_auto_enable() security exposure (revoke direct execute from PUBLIC, anon, authenticated)
--   3. Granular evidence role authorization (Writer candidate creation, Reviewer verification, Strategist governance)
--   4. Secure evidence verification RPC (authz.verify_evidence_claim)
--   5. Row-level verification authority trigger (authz.enforce_evidence_verification_authority)
--   6. Verification status check constraints and final function permissions
-- Standard: Non-destructive forward migration applied cleanly after 00001 through 00006
-- ============================================================================

-- ============================================================================
-- 1. REMOVE & RESTRICT LEGACY PUBLIC AUTH FUNCTIONS
-- ============================================================================
-- Earlier migrations created public SECURITY DEFINER functions accepting arbitrary user IDs:
--   public.is_org_member(_org_id, _user_id)
--   public.is_org_admin(_org_id, _user_id)
--   public.is_brand_member(_brand_id, _user_id)
--   public.has_brand_role(_brand_id, _user_id, _allowed_roles)
-- All canonical RLS policies now strictly use authz schema functions bound to auth.uid().
-- These legacy functions are completely obsolete and present an elevation risk if left callable.

-- Revoke all execute privileges first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_org_member' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_org_member(UUID, UUID) FROM PUBLIC, anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_org_admin' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_org_admin(UUID, UUID) FROM PUBLIC, anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_brand_member' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_brand_member(UUID, UUID) FROM PUBLIC, anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_brand_role' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.has_brand_role(UUID, UUID, TEXT[]) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- Drop legacy functions safely with CASCADE
DROP FUNCTION IF EXISTS public.is_org_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_brand_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_brand_role(UUID, UUID, TEXT[]) CASCADE;

-- ============================================================================
-- 2. FIX PUBLIC rls_auto_enable() SECURITY EXPOSURE
-- ============================================================================
-- The ensure_rls event trigger on ddl_command_end uses public.rls_auto_enable().
-- As a SECURITY DEFINER function in the public schema, direct EXECUTE by
-- unprivileged roles (PUBLIC, anon, authenticated) is an unnecessary attack surface.
-- Revoke direct execute while allowing PostgreSQL event triggers to execute internally.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END $$;

-- ============================================================================
-- 3. EVIDENCE ROLE AUTHORIZATION & POLICY CORRECTIONS
-- ============================================================================
-- Drop broad "manage" policies on evidence tables created in earlier migrations
DROP POLICY IF EXISTS "evidence_claims_manage_canonical" ON public.evidence_claims;
DROP POLICY IF EXISTS "evidence_sources_manage_canonical" ON public.evidence_sources;
DROP POLICY IF EXISTS "evidence_claim_sources_manage_canonical" ON public.evidence_claim_sources;

-- Drop any previous granular policies to ensure clean idempotent forward application
DROP POLICY IF EXISTS "evidence_claims_select_canonical" ON public.evidence_claims;
DROP POLICY IF EXISTS "evidence_claims_insert_canonical" ON public.evidence_claims;
DROP POLICY IF EXISTS "evidence_claims_update_canonical" ON public.evidence_claims;
DROP POLICY IF EXISTS "evidence_claims_delete_canonical" ON public.evidence_claims;

DROP POLICY IF EXISTS "evidence_sources_select_canonical" ON public.evidence_sources;
DROP POLICY IF EXISTS "evidence_sources_insert_canonical" ON public.evidence_sources;
DROP POLICY IF EXISTS "evidence_sources_update_canonical" ON public.evidence_sources;
DROP POLICY IF EXISTS "evidence_sources_delete_canonical" ON public.evidence_sources;

DROP POLICY IF EXISTS "evidence_claim_sources_select_canonical" ON public.evidence_claim_sources;
DROP POLICY IF EXISTS "evidence_claim_sources_insert_canonical" ON public.evidence_claim_sources;

-- 3.1 EVIDENCE CLAIMS
-- Select: Any brand viewer, member, or org admin
CREATE POLICY "evidence_claims_select_canonical" ON public.evidence_claims
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

-- Insert: Writers, Reviewers, and Strategists can create candidates.
-- BUT Writers may ONLY insert candidates with status 'unverified'.
-- Strategists and Reviewers may insert candidates with any verification status.
CREATE POLICY "evidence_claims_insert_canonical" ON public.evidence_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer', 'writer'])
    AND (
      verification_status = 'unverified'
      OR authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer'])
    )
  );

-- Update: ONLY Strategists, Reviewers, and inheriting Org Admins/Owners may review, verify, or alter claims
CREATE POLICY "evidence_claims_update_canonical" ON public.evidence_claims
  FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer']));

-- Delete: ONLY Strategists and inheriting Org Admins/Owners may delete claims
CREATE POLICY "evidence_claims_delete_canonical" ON public.evidence_claims
  FOR DELETE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']));

-- 3.2 EVIDENCE SOURCES
CREATE POLICY "evidence_sources_select_canonical" ON public.evidence_sources
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

CREATE POLICY "evidence_sources_insert_canonical" ON public.evidence_sources
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer', 'writer']));

CREATE POLICY "evidence_sources_update_canonical" ON public.evidence_sources
  FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist', 'reviewer']));

CREATE POLICY "evidence_sources_delete_canonical" ON public.evidence_sources
  FOR DELETE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']));

-- 3.3 EVIDENCE CLAIM SOURCES
CREATE POLICY "evidence_claim_sources_select_canonical" ON public.evidence_claim_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND authz.can_view_brand(ec.brand_id)
    )
  );

CREATE POLICY "evidence_claim_sources_insert_canonical" ON public.evidence_claim_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND authz.has_brand_role(ec.brand_id, ARRAY['strategist', 'reviewer', 'writer'])
    )
  );

CREATE POLICY "evidence_claim_sources_manage_canonical" ON public.evidence_claim_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND authz.has_brand_role(ec.brand_id, ARRAY['strategist', 'reviewer'])
    )
  );

-- ============================================================================
-- 4. SECURE EVIDENCE VERIFICATION RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION authz.verify_evidence_claim(
  _claim_id UUID,
  _new_status TEXT
)
RETURNS public.evidence_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _brand_id UUID;
  _can_verify BOOLEAN;
  _updated_claim public.evidence_claims;
BEGIN
  IF _new_status NOT IN ('unverified', 'needs_review', 'verified', 'disputed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification status: %', _new_status USING ERRCODE = '22023';
  END IF;

  SELECT brand_id INTO _brand_id
  FROM public.evidence_claims
  WHERE id = _claim_id;

  IF _brand_id IS NULL THEN
    RAISE EXCEPTION 'Evidence claim not found: %', _claim_id USING ERRCODE = 'P0002';
  END IF;

  -- Ensure caller is Strategist, Reviewer, or inheriting Org Admin/Owner
  SELECT authz.has_brand_role(_brand_id, ARRAY['strategist', 'reviewer']) INTO _can_verify;
  IF NOT _can_verify THEN
    RAISE EXCEPTION 'Insufficient permissions: Only Strategists, Reviewers, and Org Admins may verify claims' USING ERRCODE = '42501';
  END IF;

  UPDATE public.evidence_claims
  SET
    verification_status = _new_status,
    verified_by = auth.uid(),
    verified_at = NOW(),
    updated_at = NOW()
  WHERE id = _claim_id
  RETURNING * INTO _updated_claim;

  RETURN _updated_claim;
END;
$$;

GRANT EXECUTE ON FUNCTION authz.verify_evidence_claim(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION authz.verify_evidence_claim(UUID, TEXT) FROM PUBLIC, anon;

-- ============================================================================
-- 5. ROW-LEVEL TRIGGER GUARD: ENFORCE VERIFICATION AUTHORITY
-- ============================================================================
CREATE OR REPLACE FUNCTION authz.enforce_evidence_verification_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _caller_id UUID;
  _can_verify BOOLEAN;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT authz.has_brand_role(NEW.brand_id, ARRAY['strategist', 'reviewer']) INTO _can_verify;

  IF TG_OP = 'INSERT' THEN
    IF NEW.verification_status <> 'unverified' AND NOT _can_verify THEN
      RAISE EXCEPTION 'Writers may only create unverified evidence candidates' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.verification_status IS DISTINCT FROM NEW.verification_status) AND NOT _can_verify THEN
      RAISE EXCEPTION 'Only Strategists, Reviewers, or Org Admins can verify or alter evidence status' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evidence_verification_auth ON public.evidence_claims;
CREATE TRIGGER trg_evidence_verification_auth
  BEFORE INSERT OR UPDATE ON public.evidence_claims
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_evidence_verification_authority();

-- ============================================================================
-- 6. STATUS CHECK CONSTRAINT & FINAL FUNCTION PRIVILEGES
-- ============================================================================
-- Ensure constraint allows canonical status set
ALTER TABLE public.evidence_claims
  DROP CONSTRAINT IF EXISTS chk_evidence_claims_verification_status;

ALTER TABLE public.evidence_claims
  ADD CONSTRAINT chk_evidence_claims_verification_status
  CHECK (verification_status IN ('unverified', 'needs_review', 'verified', 'disputed', 'rejected'));

-- Ensure authz schema access
GRANT USAGE ON SCHEMA authz TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA authz TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA authz FROM PUBLIC, anon;

-- Ensure vector search function execution
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'match_knowledge_chunks' AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector(768), double precision, int, uuid) TO authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.match_knowledge_chunks(vector(768), double precision, int, uuid) FROM PUBLIC, anon';
  END IF;
END $$;

-- ============================================================================
-- 7. DATABASE RELATIONSHIP CONSISTENCY ENFORCEMENT
-- ============================================================================
-- Ensure organization_id and brand_id cannot be combined inconsistently across:
--   - websites (organization_id must match brand.organization_id)
--   - knowledge_sources (organization_id must match brand.organization_id)
--   - knowledge_documents (organization_id must match brand.organization_id, source must belong to same brand)
--   - knowledge_chunks (organization_id must match brand.organization_id, doc must belong to same brand & source)
--   - evidence_sources (organization_id must match brand.organization_id)
--   - evidence_claims (organization_id must match brand.organization_id)
--   - evidence_claim_sources (claim & source/doc/chunk must belong to same brand)

-- 7.1 Composite Unique Constraints to enable Composite Foreign Keys
ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS uq_brands_id_organization_id;
ALTER TABLE public.brands
  ADD CONSTRAINT uq_brands_id_organization_id UNIQUE (id, organization_id);

ALTER TABLE public.knowledge_sources
  DROP CONSTRAINT IF EXISTS uq_knowledge_sources_id_brand_id;
ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT uq_knowledge_sources_id_brand_id UNIQUE (id, brand_id);

ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS uq_knowledge_documents_id_brand_source;
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT uq_knowledge_documents_id_brand_source UNIQUE (id, brand_id, source_id);

ALTER TABLE public.evidence_sources
  DROP CONSTRAINT IF EXISTS uq_evidence_sources_id_brand_id;
ALTER TABLE public.evidence_sources
  ADD CONSTRAINT uq_evidence_sources_id_brand_id UNIQUE (id, brand_id);

ALTER TABLE public.evidence_claims
  DROP CONSTRAINT IF EXISTS uq_evidence_claims_id_brand_id;
ALTER TABLE public.evidence_claims
  ADD CONSTRAINT uq_evidence_claims_id_brand_id UNIQUE (id, brand_id);

-- 7.2 Composite Foreign Keys
-- Websites: (brand_id, organization_id) -> brands(id, organization_id)
ALTER TABLE public.websites
  DROP CONSTRAINT IF EXISTS fk_websites_brand_org_consistency;
ALTER TABLE public.websites
  ADD CONSTRAINT fk_websites_brand_org_consistency
  FOREIGN KEY (brand_id, organization_id)
  REFERENCES public.brands (id, organization_id)
  ON DELETE CASCADE;

-- Knowledge Sources: (brand_id, organization_id) -> brands(id, organization_id)
ALTER TABLE public.knowledge_sources
  DROP CONSTRAINT IF EXISTS fk_knowledge_sources_brand_org_consistency;
ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT fk_knowledge_sources_brand_org_consistency
  FOREIGN KEY (brand_id, organization_id)
  REFERENCES public.brands (id, organization_id)
  ON DELETE CASCADE;

-- Knowledge Documents: (brand_id, organization_id) -> brands(id, organization_id)
ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS fk_knowledge_documents_brand_org_consistency;
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT fk_knowledge_documents_brand_org_consistency
  FOREIGN KEY (brand_id, organization_id)
  REFERENCES public.brands (id, organization_id)
  ON DELETE CASCADE;

-- Knowledge Documents: (source_id, brand_id) -> knowledge_sources(id, brand_id)
ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS fk_knowledge_documents_source_brand_consistency;
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT fk_knowledge_documents_source_brand_consistency
  FOREIGN KEY (source_id, brand_id)
  REFERENCES public.knowledge_sources (id, brand_id)
  ON DELETE CASCADE;

-- Knowledge Chunks: (brand_id, organization_id) -> brands(id, organization_id)
ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS fk_knowledge_chunks_brand_org_consistency;
ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT fk_knowledge_chunks_brand_org_consistency
  FOREIGN KEY (brand_id, organization_id)
  REFERENCES public.brands (id, organization_id)
  ON DELETE CASCADE;

-- Knowledge Chunks: (document_id, brand_id, source_id) -> knowledge_documents(id, brand_id, source_id)
ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS fk_knowledge_chunks_doc_brand_source_consistency;
ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT fk_knowledge_chunks_doc_brand_source_consistency
  FOREIGN KEY (document_id, brand_id, source_id)
  REFERENCES public.knowledge_documents (id, brand_id, source_id)
  ON DELETE CASCADE;

-- Evidence Sources: (brand_id, organization_id) -> brands(id, organization_id)
ALTER TABLE public.evidence_sources
  DROP CONSTRAINT IF EXISTS fk_evidence_sources_brand_org_consistency;
ALTER TABLE public.evidence_sources
  ADD CONSTRAINT fk_evidence_sources_brand_org_consistency
  FOREIGN KEY (brand_id, organization_id)
  REFERENCES public.brands (id, organization_id)
  ON DELETE CASCADE;

-- Evidence Claims: (brand_id, organization_id) -> brands(id, organization_id)
ALTER TABLE public.evidence_claims
  DROP CONSTRAINT IF EXISTS fk_evidence_claims_brand_org_consistency;
ALTER TABLE public.evidence_claims
  ADD CONSTRAINT fk_evidence_claims_brand_org_consistency
  FOREIGN KEY (brand_id, organization_id)
  REFERENCES public.brands (id, organization_id)
  ON DELETE CASCADE;

-- 7.3 Multi-layered Trigger Enforcement: Tenancy Relationship Consistency
CREATE OR REPLACE FUNCTION authz.enforce_tenancy_relationship_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _expected_org_id UUID;
  _source_brand_id UUID;
  _doc_brand_id UUID;
  _doc_source_id UUID;
BEGIN
  -- 1. Ensure entity organization_id matches brand.organization_id
  IF NEW.brand_id IS NOT NULL THEN
    SELECT organization_id INTO _expected_org_id
    FROM public.brands
    WHERE id = NEW.brand_id;

    IF _expected_org_id IS NULL THEN
      RAISE EXCEPTION 'Referenced brand does not exist: %', NEW.brand_id USING ERRCODE = '23503';
    END IF;

    IF NEW.organization_id IS NOT NULL AND NEW.organization_id <> _expected_org_id THEN
      RAISE EXCEPTION 'Tenancy relationship violation: organization_id (%) does not match brand organization_id (%)',
        NEW.organization_id, _expected_org_id USING ERRCODE = '23514';
    END IF;

    -- Auto-populate organization_id if omitted
    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := _expected_org_id;
    END IF;
  END IF;

  -- 2. Table-specific tenant hierarchy checks
  IF TG_TABLE_NAME = 'knowledge_documents' THEN
    IF NEW.source_id IS NOT NULL THEN
      SELECT brand_id INTO _source_brand_id
      FROM public.knowledge_sources
      WHERE id = NEW.source_id;

      IF _source_brand_id IS NOT NULL AND _source_brand_id <> NEW.brand_id THEN
        RAISE EXCEPTION 'Tenancy hierarchy violation: knowledge_document brand (%) does not match knowledge_source brand (%)',
          NEW.brand_id, _source_brand_id USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'knowledge_chunks' THEN
    IF NEW.document_id IS NOT NULL THEN
      SELECT brand_id, source_id INTO _doc_brand_id, _doc_source_id
      FROM public.knowledge_documents
      WHERE id = NEW.document_id;

      IF _doc_brand_id IS NOT NULL AND _doc_brand_id <> NEW.brand_id THEN
        RAISE EXCEPTION 'Tenancy hierarchy violation: knowledge_chunk brand (%) does not match document brand (%)',
          NEW.brand_id, _doc_brand_id USING ERRCODE = '23514';
      END IF;

      IF _doc_source_id IS NOT NULL AND NEW.source_id IS NOT NULL AND _doc_source_id <> NEW.source_id THEN
        RAISE EXCEPTION 'Tenancy hierarchy violation: knowledge_chunk source (%) does not match document source (%)',
          NEW.source_id, _doc_source_id USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply triggers
DROP TRIGGER IF EXISTS trg_websites_tenancy_consistency ON public.websites;
CREATE TRIGGER trg_websites_tenancy_consistency
  BEFORE INSERT OR UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_tenancy_relationship_consistency();

DROP TRIGGER IF EXISTS trg_knowledge_sources_tenancy_consistency ON public.knowledge_sources;
CREATE TRIGGER trg_knowledge_sources_tenancy_consistency
  BEFORE INSERT OR UPDATE ON public.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_tenancy_relationship_consistency();

DROP TRIGGER IF EXISTS trg_knowledge_documents_tenancy_consistency ON public.knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_tenancy_consistency
  BEFORE INSERT OR UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_tenancy_relationship_consistency();

DROP TRIGGER IF EXISTS trg_knowledge_chunks_tenancy_consistency ON public.knowledge_chunks;
CREATE TRIGGER trg_knowledge_chunks_tenancy_consistency
  BEFORE INSERT OR UPDATE ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_tenancy_relationship_consistency();

DROP TRIGGER IF EXISTS trg_evidence_sources_tenancy_consistency ON public.evidence_sources;
CREATE TRIGGER trg_evidence_sources_tenancy_consistency
  BEFORE INSERT OR UPDATE ON public.evidence_sources
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_tenancy_relationship_consistency();

DROP TRIGGER IF EXISTS trg_evidence_claims_tenancy_consistency ON public.evidence_claims;
CREATE TRIGGER trg_evidence_claims_tenancy_consistency
  BEFORE INSERT OR UPDATE ON public.evidence_claims
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_tenancy_relationship_consistency();

-- 7.4 Cross-contamination prevention for evidence_claim_sources
CREATE OR REPLACE FUNCTION authz.enforce_evidence_claim_source_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _claim_brand_id UUID;
  _source_brand_id UUID;
  _doc_brand_id UUID;
  _chunk_brand_id UUID;
BEGIN
  SELECT brand_id INTO _claim_brand_id
  FROM public.evidence_claims
  WHERE id = NEW.claim_id;

  IF NEW.source_id IS NOT NULL THEN
    SELECT brand_id INTO _source_brand_id
    FROM public.evidence_sources
    WHERE id = NEW.source_id;

    IF _source_brand_id IS NOT NULL AND _claim_brand_id IS NOT NULL AND _source_brand_id <> _claim_brand_id THEN
      RAISE EXCEPTION 'Tenancy cross-contamination violation: evidence_claim brand (%) does not match evidence_source brand (%)',
        _claim_brand_id, _source_brand_id USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.document_id IS NOT NULL THEN
    SELECT brand_id INTO _doc_brand_id
    FROM public.knowledge_documents
    WHERE id = NEW.document_id;

    IF _doc_brand_id IS NOT NULL AND _claim_brand_id IS NOT NULL AND _doc_brand_id <> _claim_brand_id THEN
      RAISE EXCEPTION 'Tenancy cross-contamination violation: evidence_claim brand (%) does not match knowledge_document brand (%)',
        _claim_brand_id, _doc_brand_id USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.chunk_id IS NOT NULL THEN
    SELECT brand_id INTO _chunk_brand_id
    FROM public.knowledge_chunks
    WHERE id = NEW.chunk_id;

    IF _chunk_brand_id IS NOT NULL AND _claim_brand_id IS NOT NULL AND _chunk_brand_id <> _claim_brand_id THEN
      RAISE EXCEPTION 'Tenancy cross-contamination violation: evidence_claim brand (%) does not match knowledge_chunk brand (%)',
        _claim_brand_id, _chunk_brand_id USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evidence_claim_sources_consistency ON public.evidence_claim_sources;
CREATE TRIGGER trg_evidence_claim_sources_consistency
  BEFORE INSERT OR UPDATE ON public.evidence_claim_sources
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_evidence_claim_source_consistency();

