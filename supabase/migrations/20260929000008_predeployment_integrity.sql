-- ============================================================================
-- Migration: 20260929000008_predeployment_integrity.sql
-- Description: Final Pre-Deployment Database Integrity Gate (OR-G04F)
-- Covers:
--   1. Backfill public.profiles from existing auth.users safely
--   2. Force atomic organization creation (remove direct authenticated INSERT on public.organizations)
--   3. Database-authoritative evidence verification provenance (auth.uid(), NOW(), RPC-only status changes)
--   4. Remove generic client audit fabrication (revoke authenticated execute on authz.record_audit_event)
--   5. Remove blanket authz grants (revoke ALL, grant only discrete required functions)
--   6. Clean legacy tenancy validation triggers & function (drop trg_validate_* and validate_tenant_brand_consistency)
--   7. Harden remaining SECURITY DEFINER functions (least privilege, search_path = '')
-- Standard: Non-destructive forward migration applied cleanly after 00001 through 00007
-- ============================================================================

-- ============================================================================
-- 1. BACKFILL EXISTING SUPABASE AUTH USERS INTO public.profiles
-- ============================================================================
-- The deployment target may already contain auth.users records before OmniRank migrations are applied.
-- Safely backfill public.profiles with safe fallbacks and conflict resolution.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    SELECT
      u.id,
      u.email,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1),
        'User'
      ),
      COALESCE(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
      )
    FROM auth.users u
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = CASE
        WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
        ELSE profiles.full_name
      END,
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      updated_at = NOW();
  END IF;
END $$;

-- ============================================================================
-- 2. FORCE ATOMIC ORGANIZATION CREATION
-- ============================================================================
-- Normal authenticated users must NOT directly INSERT into public.organizations.
-- They must atomically create Organization + Owner membership via:
--   public.create_organization_with_owner(_name, _slug)
-- This eliminates orphaned organizations without owner records.

DROP POLICY IF EXISTS "organizations_insert_canonical" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;

-- Ensure create_organization_with_owner is secure, transactional, and accessible
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  _name TEXT,
  _slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _caller_id UUID;
  _org_id UUID;
  _member_id UUID;
  _result JSONB;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create organization' USING ERRCODE = 'P0001';
  END IF;

  IF _name IS NULL OR length(trim(_name)) < 2 THEN
    RAISE EXCEPTION 'Organization name must be at least 2 characters' USING ERRCODE = '22023';
  END IF;

  IF _slug IS NULL OR length(trim(_slug)) < 2 THEN
    RAISE EXCEPTION 'Organization slug must be at least 2 characters' USING ERRCODE = '22023';
  END IF;

  -- 1. Create Organization atomically
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (_name, _slug, _caller_id)
  RETURNING id INTO _org_id;

  -- 2. Create Owner membership atomically
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _caller_id, 'owner')
  RETURNING id INTO _member_id;

  SELECT jsonb_build_object(
    'organization', (SELECT row_to_json(o) FROM public.organizations o WHERE o.id = _org_id),
    'member', (SELECT row_to_json(m) FROM public.organization_members m WHERE m.id = _member_id)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 3. EVIDENCE VERIFICATION PROVENANCE & RPC-ONLY STATUS CHANGES
-- ============================================================================
-- Restrict direct UPDATE on public.evidence_claims to Strategists only.
-- Reviewers must use the narrow secure RPC verify_evidence_claim to change status,
-- guaranteeing verified_by is database-derived from auth.uid() and verified_at from NOW().
-- Reviewers cannot alter claim text, confidence, tenant fields, or provenance.

DROP POLICY IF EXISTS "evidence_claims_update_canonical" ON public.evidence_claims;

CREATE POLICY "evidence_claims_update_canonical" ON public.evidence_claims
  FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']));

-- Canonical public PostgREST-callable wrapper for evidence claim verification
CREATE OR REPLACE FUNCTION public.verify_evidence_claim(
  _claim_id UUID,
  _new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _res public.evidence_claims;
BEGIN
  _res := authz.verify_evidence_claim(_claim_id, _new_status);
  RETURN to_jsonb(_res);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_evidence_claim(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_evidence_claim(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 4. REMOVE GENERIC CLIENT AUDIT FABRICATION
-- ============================================================================
-- Normal authenticated users must not be able to call a generic RPC to fabricate audit logs.
-- Revoke authenticated execute on authz.record_audit_event.
-- Server-side trusted writers use service_role.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'authz' AND p.proname = 'record_audit_event'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION authz.record_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION authz.record_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role';
  END IF;
END $$;

-- ============================================================================
-- 5. REMOVE BLANKET AUTHZ FUNCTION GRANTS & GRANT ONLY EXPLICIT FUNCTIONS
-- ============================================================================
-- Revoke all blanket permissions on authz schema from public, anon, and authenticated
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA authz FROM PUBLIC, anon, authenticated;

-- Explicitly grant only discrete functions that authenticated users require for RLS evaluation & operations
GRANT EXECUTE ON FUNCTION authz.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.is_org_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.is_org_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.get_org_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.can_view_brand(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.has_brand_role(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.get_brand_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.verify_evidence_claim(UUID, TEXT) TO authenticated;

-- Service role retains full administrative execution capability
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA authz TO service_role;

-- ============================================================================
-- 6. CLEAN LEGACY TENANCY VALIDATION TRIGGERS & FUNCTIONS
-- ============================================================================
-- Migration 00005 added public.validate_tenant_brand_consistency() and trg_validate_* triggers.
-- Migration 00007 established the canonical authz.enforce_tenancy_relationship_consistency() triggers.
-- Drop duplicate legacy triggers and obsolete validation function.

DROP TRIGGER IF EXISTS trg_validate_sources_tenant ON public.knowledge_sources;
DROP TRIGGER IF EXISTS trg_validate_docs_tenant ON public.knowledge_documents;
DROP TRIGGER IF EXISTS trg_validate_chunks_tenant ON public.knowledge_chunks;
DROP TRIGGER IF EXISTS trg_validate_ev_sources_tenant ON public.evidence_sources;
DROP TRIGGER IF EXISTS trg_validate_ev_claims_tenant ON public.evidence_claims;

DROP FUNCTION IF EXISTS public.validate_tenant_brand_consistency() CASCADE;

-- ============================================================================
-- 7. HARDEN REMAINING SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- Ensure handle_new_user and public helper functions are strictly hardened
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon';
  END IF;
END $$;
