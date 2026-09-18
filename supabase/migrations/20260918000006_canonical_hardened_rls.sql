-- ============================================================================
-- Migration: 20260918000006_canonical_hardened_rls.sql
-- Description: Canonical Hardened RLS, Legacy Policy Cleanup, Owner Invariant & Vector RPC Security
-- Standard: OR-G04C Live Security, Persistence & CI Gate
-- ============================================================================

-- ============================================================================
-- 1. EXPLICITLY DROP ALL OBSOLETE & PERMISSIVE LEGACY POLICIES
-- ============================================================================

-- Profiles legacy policies
DROP POLICY IF EXISTS "profiles_select_own_or_co_members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Organizations legacy policies
DROP POLICY IF EXISTS "organizations_select_members" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_owner" ON public.organizations;

-- Organization Members legacy policies
DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_select_coworkers" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_select_scoped" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert_admin" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert_guarded" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update_admin" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update_guarded" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete_admin" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete_guarded" ON public.organization_members;

-- Brands legacy policies
DROP POLICY IF EXISTS "brands_select" ON public.brands;
DROP POLICY IF EXISTS "brands_select_org" ON public.brands;
DROP POLICY IF EXISTS "brands_select_member" ON public.brands;
DROP POLICY IF EXISTS "brands_select_scoped" ON public.brands;
DROP POLICY IF EXISTS "brands_insert_admin_or_strategist" ON public.brands;
DROP POLICY IF EXISTS "brands_update_admin_or_strategist" ON public.brands;
DROP POLICY IF EXISTS "brands_delete_admin" ON public.brands;

-- Brand Members legacy policies
DROP POLICY IF EXISTS "brand_members_select" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_manage_admin" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_insert" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_insert_org_admin" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_update" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_update_org_admin" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_delete" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_delete_org_admin" ON public.brand_members;

-- Websites legacy policies
DROP POLICY IF EXISTS "websites_select" ON public.websites;
DROP POLICY IF EXISTS "websites_manage" ON public.websites;

-- Brand Brain Core legacy policies
DROP POLICY IF EXISTS "brand_profiles_select" ON public.brand_profiles;
DROP POLICY IF EXISTS "brand_profiles_manage" ON public.brand_profiles;
DROP POLICY IF EXISTS "brand_products_select" ON public.brand_products;
DROP POLICY IF EXISTS "brand_products_manage" ON public.brand_products;
DROP POLICY IF EXISTS "brand_audiences_select" ON public.brand_audiences;
DROP POLICY IF EXISTS "brand_audiences_manage" ON public.brand_audiences;
DROP POLICY IF EXISTS "brand_voice_profiles_select" ON public.brand_voice_profiles;
DROP POLICY IF EXISTS "brand_voice_profiles_manage" ON public.brand_voice_profiles;
DROP POLICY IF EXISTS "brand_voice_examples_select" ON public.brand_voice_examples;
DROP POLICY IF EXISTS "brand_voice_examples_manage" ON public.brand_voice_examples;
DROP POLICY IF EXISTS "brand_terminology_select" ON public.brand_terminology;
DROP POLICY IF EXISTS "brand_terminology_manage" ON public.brand_terminology;
DROP POLICY IF EXISTS "brand_policies_select" ON public.brand_policies;
DROP POLICY IF EXISTS "brand_policies_manage" ON public.brand_policies;
DROP POLICY IF EXISTS "brand_competitors_select" ON public.brand_competitors;
DROP POLICY IF EXISTS "brand_competitors_manage" ON public.brand_competitors;
DROP POLICY IF EXISTS "brand_audit_logs_select" ON public.brand_audit_logs;
DROP POLICY IF EXISTS "brand_audit_logs_insert" ON public.brand_audit_logs;

-- Ingestion & Evidence legacy policies
DROP POLICY IF EXISTS "knowledge_sources_select" ON public.knowledge_sources;
DROP POLICY IF EXISTS "knowledge_sources_manage" ON public.knowledge_sources;
DROP POLICY IF EXISTS "knowledge_documents_select" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_manage" ON public.knowledge_documents;
DROP POLICY IF EXISTS "knowledge_chunks_select" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "knowledge_chunks_manage" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "evidence_sources_select" ON public.evidence_sources;
DROP POLICY IF EXISTS "evidence_sources_manage" ON public.evidence_sources;
DROP POLICY IF EXISTS "evidence_claims_select" ON public.evidence_claims;
DROP POLICY IF EXISTS "evidence_claims_manage" ON public.evidence_claims;
DROP POLICY IF EXISTS "evidence_claim_sources_select" ON public.evidence_claim_sources;
DROP POLICY IF EXISTS "evidence_claim_sources_manage" ON public.evidence_claim_sources;


-- ============================================================================
-- 2. CANONICAL POLICY SET
-- ============================================================================

-- 2.1 PROFILES
-- User sees own profile, org admins see org members, peers sharing assigned brand see each other.
CREATE POLICY "profiles_select_canonical" ON public.profiles
  FOR SELECT TO authenticated
  USING (authz.can_view_profile(id));

CREATE POLICY "profiles_update_canonical" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2.2 ORGANIZATIONS
-- Members can select orgs they belong to.
CREATE POLICY "organizations_select_canonical" ON public.organizations
  FOR SELECT TO authenticated
  USING (authz.is_org_member(id));

-- Authenticated users can create new organizations.
CREATE POLICY "organizations_insert_canonical" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only Org Owner/Admin can update org details.
CREATE POLICY "organizations_update_canonical" ON public.organizations
  FOR UPDATE TO authenticated
  USING (authz.is_org_admin(id))
  WITH CHECK (authz.is_org_admin(id));

-- Only Org Owner can delete the organization.
CREATE POLICY "organizations_delete_canonical" ON public.organizations
  FOR DELETE TO authenticated
  USING (authz.is_org_owner(id));

-- 2.3 ORGANIZATION MEMBERS
-- Scoped select: org admins see all members; normal members see only peers sharing brands or self.
CREATE POLICY "org_members_select_canonical" ON public.organization_members
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

-- Only Org Owner/Admin can invite/add members. Only Owner can add an Owner.
CREATE POLICY "org_members_insert_canonical" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.is_org_admin(organization_id)
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  );

-- Only Org Owner/Admin can update membership. Admin cannot alter an Owner. Only Owner can grant Owner role.
CREATE POLICY "org_members_update_canonical" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  )
  WITH CHECK (
    authz.is_org_admin(organization_id)
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  );

-- Only Org Owner/Admin can delete members. Admin cannot delete an Owner.
CREATE POLICY "org_members_delete_canonical" ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    AND (role <> 'owner' OR authz.is_org_owner(organization_id))
  );

-- 2.4 BRANDS
-- Scoped select: Org Owner/Admin see all brands; normal members see only explicitly assigned brands.
CREATE POLICY "brands_select_canonical" ON public.brands
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(id));

-- Only Org Owner/Admin can create brands.
CREATE POLICY "brands_insert_canonical" ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (authz.is_org_admin(organization_id));

-- Org Owner/Admin or Brand Strategist can update brand settings.
CREATE POLICY "brands_update_canonical" ON public.brands
  FOR UPDATE TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    OR authz.has_brand_role(id, ARRAY['strategist'])
  )
  WITH CHECK (
    authz.is_org_admin(organization_id)
    OR authz.has_brand_role(id, ARRAY['strategist'])
  );

-- Only Org Owner/Admin can delete brands.
CREATE POLICY "brands_delete_canonical" ON public.brands
  FOR DELETE TO authenticated
  USING (authz.is_org_admin(organization_id));

-- 2.5 BRAND MEMBERS
-- Brand members can see fellow brand members for assigned brands.
CREATE POLICY "brand_members_select_canonical" ON public.brand_members
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

-- Only Org Owner/Admin can manage brand memberships (Strategists cannot).
CREATE POLICY "brand_members_insert_canonical" ON public.brand_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND authz.is_org_admin(b.organization_id)
    )
  );

CREATE POLICY "brand_members_update_canonical" ON public.brand_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND authz.is_org_admin(b.organization_id)
    )
  );

CREATE POLICY "brand_members_delete_canonical" ON public.brand_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND authz.is_org_admin(b.organization_id)
    )
  );

-- 2.6 WEBSITES
CREATE POLICY "websites_select_canonical" ON public.websites
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

CREATE POLICY "websites_manage_canonical" ON public.websites
  FOR ALL TO authenticated
  USING (
    authz.is_org_admin(organization_id)
    OR authz.has_brand_role(brand_id, ARRAY['strategist'])
  );

-- 2.7 BRAND BRAIN CORE (Profiles, Products, Audiences, Voice, Terminology, Policies, Competitors)
-- All views require can_view_brand
CREATE POLICY "brand_profiles_select_canonical" ON public.brand_profiles
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_profiles_manage_canonical" ON public.brand_profiles
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist']));

CREATE POLICY "brand_products_select_canonical" ON public.brand_products
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_products_manage_canonical" ON public.brand_products
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "brand_audiences_select_canonical" ON public.brand_audiences
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_audiences_manage_canonical" ON public.brand_audiences
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "brand_voice_profiles_select_canonical" ON public.brand_voice_profiles
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_voice_profiles_manage_canonical" ON public.brand_voice_profiles
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist']));

CREATE POLICY "brand_voice_examples_select_canonical" ON public.brand_voice_examples
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_voice_examples_manage_canonical" ON public.brand_voice_examples
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "brand_terminology_select_canonical" ON public.brand_terminology
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_terminology_manage_canonical" ON public.brand_terminology
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "brand_policies_select_canonical" ON public.brand_policies
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_policies_manage_canonical" ON public.brand_policies
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist']));

CREATE POLICY "brand_competitors_select_canonical" ON public.brand_competitors
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "brand_competitors_manage_canonical" ON public.brand_competitors
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist']));

CREATE POLICY "brand_audit_logs_select_canonical" ON public.brand_audit_logs
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));

-- 2.8 INGESTION & EVIDENCE (Knowledge Sources, Documents, Chunks, Evidence Sources, Claims)
CREATE POLICY "knowledge_sources_select_canonical" ON public.knowledge_sources
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "knowledge_sources_manage_canonical" ON public.knowledge_sources
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "knowledge_documents_select_canonical" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "knowledge_documents_manage_canonical" ON public.knowledge_documents
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "knowledge_chunks_select_canonical" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "knowledge_chunks_manage_canonical" ON public.knowledge_chunks
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "evidence_sources_select_canonical" ON public.evidence_sources
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "evidence_sources_manage_canonical" ON public.evidence_sources
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "evidence_claims_select_canonical" ON public.evidence_claims
  FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "evidence_claims_manage_canonical" ON public.evidence_claims
  FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['strategist', 'writer']));

CREATE POLICY "evidence_claim_sources_select_canonical" ON public.evidence_claim_sources
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND authz.can_view_brand(ec.brand_id)
    )
  );
CREATE POLICY "evidence_claim_sources_manage_canonical" ON public.evidence_claim_sources
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND authz.has_brand_role(ec.brand_id, ARRAY['strategist', 'writer'])
    )
  );


-- ============================================================================
-- 3. OWNER INVARIANT: PREVENT ACCIDENTAL DELETION OR DEMOTION OF SOLE OWNER
-- ============================================================================

CREATE OR REPLACE FUNCTION authz.enforce_owner_invariant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_count INT;
  _org_id UUID;
BEGIN
  _org_id := OLD.organization_id;

  -- Only check when an existing owner is being removed or downgraded
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner') THEN
    SELECT COUNT(*) INTO _owner_count
    FROM public.organization_members
    WHERE organization_id = _org_id
      AND role = 'owner'
      AND id <> OLD.id;

    IF _owner_count < 1 THEN
      RAISE EXCEPTION 'Cannot remove or demote the sole Owner of organization %. Transfer ownership first.', _org_id
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_invariant ON public.organization_members;
CREATE TRIGGER trg_owner_invariant
  BEFORE UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION authz.enforce_owner_invariant();


-- Explicit Owner-Authorized Ownership Transfer RPC
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  p_org_id UUID,
  p_new_owner_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _caller_id UUID;
  _current_member_id UUID;
  _target_member_id UUID;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for ownership transfer' USING ERRCODE = 'P0001';
  END IF;

  -- Verify caller is currently an owner of the organization
  IF NOT authz.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Only an active Organization Owner can transfer ownership' USING ERRCODE = '42501';
  END IF;

  -- Ensure the target user is already a member of the organization or add them
  SELECT id INTO _target_member_id
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_new_owner_user_id;

  IF _target_member_id IS NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (p_org_id, p_new_owner_user_id, 'owner')
    RETURNING id INTO _target_member_id;
  ELSE
    UPDATE public.organization_members
    SET role = 'owner', updated_at = NOW()
    WHERE id = _target_member_id;
  END IF;

  -- Demote current owner to admin
  UPDATE public.organization_members
  SET role = 'admin', updated_at = NOW()
  WHERE organization_id = p_org_id AND user_id = _caller_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'organizationId', p_org_id,
    'previousOwnerId', _caller_id,
    'newOwnerId', p_new_owner_user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_organization_ownership(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_organization_ownership(UUID, UUID) TO authenticated, service_role;


-- ============================================================================
-- 4. SECURE PGVECTOR RPC: MATCH_KNOWLEDGE_CHUNKS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(768),
  match_threshold double precision,
  match_count int,
  p_brand_id uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  source_id uuid,
  content text,
  heading_hierarchy text[],
  trust_level text,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Strict multi-tenant verification: Caller must have view authorization on the brand
  IF NOT authz.can_view_brand(p_brand_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized for brand %', p_brand_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.source_id,
    kc.content,
    kc.heading_hierarchy,
    kc.trust_level,
    (1 - (kc.embedding <=> query_embedding))::double precision AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.brand_id = p_brand_id
    AND (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Revoke execute from PUBLIC and anon, grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.match_knowledge_chunks(vector(768), double precision, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector(768), double precision, int, uuid) TO authenticated, service_role;
