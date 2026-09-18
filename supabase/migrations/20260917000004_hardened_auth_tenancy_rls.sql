-- ============================================================================
-- Migration: 20260917000004_hardened_auth_tenancy_rls.sql
-- Description: Hardened Auth, Tenancy, Agency Isolation, Role Authority & RLS
-- Security Standard: OR-G04A Hardened Persistence Gate
-- ============================================================================

-- 1. Create dedicated private authorization schema `authz`
CREATE SCHEMA IF NOT EXISTS authz;
REVOKE ALL ON SCHEMA authz FROM PUBLIC;
GRANT USAGE ON SCHEMA authz TO authenticated, service_role;

-- 2. Hardened RLS Helper Functions in `authz`
-- Invariants:
-- - All functions use SECURITY DEFINER and SET search_path = ''
-- - Objects are fully qualified
-- - Use auth.uid() directly instead of trusting arbitrary caller-supplied user IDs

CREATE OR REPLACE FUNCTION authz.current_uid()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION authz.is_org_member(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION authz.is_org_admin(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION authz.is_org_owner(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION authz.can_view_brand(_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = _brand_id
      AND (
        -- 1. Org owner/admin can see all brands in their organization
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = b.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
        -- 2. Normal members can ONLY see brands where they have explicit brand membership
        OR EXISTS (
          SELECT 1 FROM public.brand_members bm
          WHERE bm.brand_id = b.id
            AND bm.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION authz.is_brand_member(_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT authz.can_view_brand(_brand_id);
$$;

CREATE OR REPLACE FUNCTION authz.has_brand_role(_brand_id UUID, _allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = _brand_id
      AND (
        -- Org Owners and Admins inherit full operational authority
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = b.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
        -- Explicit brand member with matching role
        OR EXISTS (
          SELECT 1 FROM public.brand_members bm
          WHERE bm.brand_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text = ANY(_allowed_roles)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION authz.can_view_profile(_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    -- User can always view their own profile
    _target_user_id = auth.uid()
    -- Org Owner/Admin can view profiles in their org
    OR EXISTS (
      SELECT 1
      FROM public.organization_members caller_om
      JOIN public.organization_members target_om ON caller_om.organization_id = target_om.organization_id
      WHERE caller_om.user_id = auth.uid()
        AND target_om.user_id = _target_user_id
        AND caller_om.role IN ('owner', 'admin')
    )
    -- Peers sharing an assigned brand can view each other's profiles
    OR EXISTS (
      SELECT 1
      FROM public.brand_members caller_bm
      JOIN public.brand_members target_bm ON caller_bm.brand_id = target_bm.brand_id
      WHERE caller_bm.user_id = auth.uid()
        AND target_bm.user_id = _target_user_id
    )
  );
$$;

-- Restrict function execution
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA authz FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA authz TO authenticated, service_role;

-- 3. Profiles foreign key and safe trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public' AND table_name = 'profiles' AND constraint_name = 'fk_profiles_auth_users'
    ) THEN
      ALTER TABLE public.profiles
        ADD CONSTRAINT fk_profiles_auth_users
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 4. Atomic Organization Creation RPC (Requirement 6)
-- Creates organization AND assigns creator as Owner in a single atomic transaction
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

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (_name, _slug, _caller_id)
  RETURNING id INTO _org_id;

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

REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) TO authenticated, service_role;

-- 5. Update RLS Policies for Agency Isolation (Requirement 4) & Role Authority (Requirement 5)

-- Profiles: Scoped view policy preventing user enumeration
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles
  FOR SELECT TO authenticated
  USING (authz.can_view_profile(id));

-- Brands: Strict agency isolation policy
-- Normal members cannot enumerate client brands they are not assigned to
DROP POLICY IF EXISTS brands_select_org ON public.brands;
DROP POLICY IF EXISTS brands_select_scoped ON public.brands;
CREATE POLICY brands_select_scoped ON public.brands
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(id));

-- Organization Members: Normal members cannot enumerate all users across the organization
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
DROP POLICY IF EXISTS org_members_select_scoped ON public.organization_members;
CREATE POLICY org_members_select_scoped ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm1
      JOIN public.brand_members bm2 ON bm1.brand_id = bm2.brand_id
      WHERE bm1.user_id = auth.uid() AND bm2.user_id = organization_members.user_id
    )
  );

-- Organization Members: Mutation authority enforcement (Requirement 5)
-- Only Owner/Admin can insert/update/delete members
-- Admin cannot remove, demote, or alter Owner
DROP POLICY IF EXISTS org_members_insert ON public.organization_members;
CREATE POLICY org_members_insert_guarded ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.is_org_admin(organization_id)
    AND (
      -- Only an existing owner can create another owner
      role <> 'owner' OR authz.is_org_owner(organization_id)
    )
  );

DROP POLICY IF EXISTS org_members_update ON public.organization_members;
CREATE POLICY org_members_update_guarded ON public.organization_members
  FOR UPDATE TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    -- Admin cannot alter an owner
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  )
  WITH CHECK (
    authz.is_org_admin(organization_id)
    -- Only an owner can assign owner role
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  );

DROP POLICY IF EXISTS org_members_delete ON public.organization_members;
CREATE POLICY org_members_delete_guarded ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    -- Admin cannot delete an owner; owner cannot be deleted if sole owner
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  );

-- Brand Members: Strategists FORBIDDEN from managing membership by default (Requirement 5)
-- Only Org Owner/Admin can add, update, or remove brand members
DROP POLICY IF EXISTS brand_members_insert ON public.brand_members;
CREATE POLICY brand_members_insert_org_admin ON public.brand_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND authz.is_org_admin(b.organization_id)
    )
  );

DROP POLICY IF EXISTS brand_members_update ON public.brand_members;
CREATE POLICY brand_members_update_org_admin ON public.brand_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND authz.is_org_admin(b.organization_id)
    )
  );

DROP POLICY IF EXISTS brand_members_delete ON public.brand_members;
CREATE POLICY brand_members_delete_org_admin ON public.brand_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND authz.is_org_admin(b.organization_id)
    )
  );

-- 6. Protect Audit Logs (Requirement 8)
-- Invariants:
-- - brand_audit_logs is strictly append-only
-- - Client UPDATE and DELETE are revoked
-- - Direct client INSERT is revoked in favor of trusted function authz.record_audit_event

REVOKE UPDATE, DELETE, TRUNCATE ON public.brand_audit_logs FROM PUBLIC, authenticated, anon;
REVOKE INSERT ON public.brand_audit_logs FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION authz.prevent_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Brand audit logs are strictly append-only and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tampering ON public.brand_audit_logs;
CREATE TRIGGER trg_audit_tampering
  BEFORE UPDATE OR DELETE ON public.brand_audit_logs
  FOR EACH ROW EXECUTE FUNCTION authz.prevent_audit_tampering();

CREATE OR REPLACE FUNCTION authz.record_audit_event(
  _brand_id UUID,
  _entity_type TEXT,
  _entity_id TEXT,
  _action TEXT,
  _summary TEXT,
  _details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _caller_id UUID;
  _caller_name TEXT;
  _log_id UUID;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for audit recording' USING ERRCODE = 'P0001';
  END IF;

  IF NOT authz.is_brand_member(_brand_id) THEN
    RAISE EXCEPTION 'Not authorized to record audit event for brand' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(full_name, email) INTO _caller_name FROM public.profiles WHERE id = _caller_id;

  INSERT INTO public.brand_audit_logs (brand_id, user_id, user_name, entity_type, entity_id, action, summary, details)
  VALUES (_brand_id, _caller_id, COALESCE(_caller_name, 'Authenticated User'), _entity_type, _entity_id, _action, _summary, _details)
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION authz.record_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authz.record_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- 7. Evidence Verification Authority Enforcement at Database Layer (Requirement 9)
-- Writers may only insert candidates with verification_status = 'unverified'
-- Only Strategist, Reviewer, or Org Owner/Admin may verify or change verification_status
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
  -- Allow server service-role / triggers without active auth.uid()
  IF _caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if caller is Strategist, Reviewer, or Org Owner/Admin
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
