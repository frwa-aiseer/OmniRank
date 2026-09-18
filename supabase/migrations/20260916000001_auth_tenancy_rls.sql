-- OmniRank Schema Migration: Authentication, Tenancy & Row Level Security (OR-P02)
-- Hierarchy: User -> Organization -> Brand -> Website

-- Enable pgcrypto / uuid-ossp if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Profiles Table (Linked to auth.users)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY, -- references auth.users(id) in Supabase Auth
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. Organizations Table (Tenant Boundary)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. Organization Members (Org Roles)
-- ==========================================
-- Roles: 'owner', 'admin', 'member'
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_organization_member UNIQUE (organization_id, user_id)
);

-- ==========================================
-- 4. Brands Table (Operational Context Boundary)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  primary_domain TEXT NOT NULL DEFAULT '',
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_brand_org_slug UNIQUE (organization_id, slug)
);

-- ==========================================
-- 5. Brand Members (Brand Roles)
-- ==========================================
-- Roles: 'strategist', 'writer', 'reviewer', 'viewer'
CREATE TABLE IF NOT EXISTS public.brand_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('strategist', 'writer', 'reviewer', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_brand_member UNIQUE (brand_id, user_id)
);

-- ==========================================
-- 6. Websites Table (Mapped to Brand & Org)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  sitemap_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'indexing', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_website_brand_domain UNIQUE (brand_id, domain)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_brands_org ON public.brands(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_members_user ON public.brand_members(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_members_brand ON public.brand_members(brand_id);
CREATE INDEX IF NOT EXISTS idx_websites_brand ON public.websites(brand_id);
CREATE INDEX IF NOT EXISTS idx_websites_org ON public.websites(organization_id);

-- ==========================================
-- 7. Security Definer Helper Functions
-- Security Hardening: SET search_path = '' with explicit schema qualification
-- ==========================================
-- Check if a user belongs to an organization
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
  );
$$;

-- Check if a user is an owner or admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND role IN ('owner', 'admin')
  );
$$;

-- Check if a user belongs to a brand
CREATE OR REPLACE FUNCTION public.is_brand_member(_brand_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brand_members
    WHERE brand_id = _brand_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.brands b
    JOIN public.organization_members om ON om.organization_id = b.organization_id
    WHERE b.id = _brand_id AND om.user_id = _user_id AND om.role IN ('owner', 'admin')
  );
$$;

-- Check if a user has a required brand role (or is org owner/admin)
CREATE OR REPLACE FUNCTION public.has_brand_role(_brand_id UUID, _user_id UUID, _allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brand_members
    WHERE brand_id = _brand_id AND user_id = _user_id AND role = ANY(_allowed_roles)
  ) OR EXISTS (
    SELECT 1 FROM public.brands b
    JOIN public.organization_members om ON om.organization_id = b.organization_id
    WHERE b.id = _brand_id AND om.user_id = _user_id AND om.role IN ('owner', 'admin')
  );
$$;

-- ==========================================
-- 8. Row Level Security (RLS) Policies
-- ==========================================

-- Enable RLS on all tenant-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

-- 8.1 PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own_or_co_members" ON public.profiles;
CREATE POLICY "profiles_select_own_or_co_members" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.organization_members om1
      JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 8.2 ORGANIZATIONS POLICIES
DROP POLICY IF EXISTS "organizations_select_members" ON public.organizations;
CREATE POLICY "organizations_select_members" ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(id, auth.uid()));

DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
CREATE POLICY "organizations_insert_authenticated" ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
CREATE POLICY "organizations_update_admin" ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(id, auth.uid()))
  WITH CHECK (public.is_org_admin(id, auth.uid()));

DROP POLICY IF EXISTS "organizations_delete_owner" ON public.organizations;
CREATE POLICY "organizations_delete_owner" ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- 8.3 ORGANIZATION MEMBERS POLICIES
DROP POLICY IF EXISTS "org_members_select_coworkers" ON public.organization_members;
CREATE POLICY "org_members_select_coworkers" ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org_members_insert_admin" ON public.organization_members;
CREATE POLICY "org_members_insert_admin" ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org_members_update_admin" ON public.organization_members;
CREATE POLICY "org_members_update_admin" ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org_members_delete_admin" ON public.organization_members;
CREATE POLICY "org_members_delete_admin" ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- 8.4 BRANDS POLICIES
DROP POLICY IF EXISTS "brands_select_member" ON public.brands;
CREATE POLICY "brands_select_member" ON public.brands
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "brands_insert_admin_or_strategist" ON public.brands;
CREATE POLICY "brands_insert_admin_or_strategist" ON public.brands
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

DROP POLICY IF EXISTS "brands_update_admin_or_strategist" ON public.brands;
CREATE POLICY "brands_update_admin_or_strategist" ON public.brands
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_brand_role(id, auth.uid(), ARRAY['strategist']))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_brand_role(id, auth.uid(), ARRAY['strategist']));

DROP POLICY IF EXISTS "brands_delete_admin" ON public.brands;
CREATE POLICY "brands_delete_admin" ON public.brands
  FOR DELETE
  TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- 8.5 BRAND MEMBERS POLICIES
DROP POLICY IF EXISTS "brand_members_select" ON public.brand_members;
CREATE POLICY "brand_members_select" ON public.brand_members
  FOR SELECT
  TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

DROP POLICY IF EXISTS "brand_members_manage_admin" ON public.brand_members;
CREATE POLICY "brand_members_manage_admin" ON public.brand_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_members.brand_id AND (
        public.is_org_admin(b.organization_id, auth.uid()) OR
        public.has_brand_role(b.id, auth.uid(), ARRAY['strategist'])
      )
    )
  );

-- 8.6 WEBSITES POLICIES
DROP POLICY IF EXISTS "websites_select" ON public.websites;
CREATE POLICY "websites_select" ON public.websites
  FOR SELECT
  TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

DROP POLICY IF EXISTS "websites_manage" ON public.websites;
CREATE POLICY "websites_manage" ON public.websites
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(organization_id, auth.uid()) OR
    public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist'])
  );
