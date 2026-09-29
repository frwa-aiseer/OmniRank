-- ============================================================================
-- Migration: 20260919000001_role_helper_bootstrap.sql
-- Gate: OR-G04G-FIX — Bootstrap compatibility stub
-- Description: Creates authz.get_org_role and authz.get_brand_role so that
--   migration 00008's GRANT statements succeed during a fresh bootstrap.
--   Migration 00009 re-creates them with CREATE OR REPLACE (idempotent).
-- ============================================================================

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

CREATE OR REPLACE FUNCTION authz.get_brand_role(_brand_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT bm.role::text
      FROM public.brand_members bm
      WHERE bm.brand_id = _brand_id
        AND bm.user_id = auth.uid()
      LIMIT 1
    ),
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
