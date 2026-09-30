-- ============================================================================
-- OmniRank Unified Supabase Database Bootstrap Bundle
-- Generated: 2026-09-30T00:59:46.544Z
-- Contains sequential application of migrations 00001 through 00008
-- Safe to run in Supabase SQL Editor on a clean project
-- ============================================================================


-- ============================================================================
-- MIGRATION: 20260916000001_auth_tenancy_rls.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260916000002_brand_brain_core.sql
-- ============================================================================

-- OmniRank Schema Migration: Brand Brain Core (OR-P03)
-- Tables: brand_profiles, brand_products, brand_audiences, brand_voice_profiles, brand_voice_examples, brand_terminology, brand_policies, brand_competitors, brand_audit_logs

-- 1. Brand Profiles
CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE,
  mission TEXT NOT NULL DEFAULT '',
  positioning_statement TEXT NOT NULL DEFAULT '',
  target_market TEXT NOT NULL DEFAULT '',
  value_proposition TEXT NOT NULL DEFAULT '',
  tone_keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Products & Services
CREATE TABLE IF NOT EXISTS public.brand_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  value_proposition TEXT NOT NULL DEFAULT '',
  key_features TEXT[] NOT NULL DEFAULT '{}',
  target_audience TEXT NOT NULL DEFAULT '',
  pricing_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Audiences (ICPs & Personas)
CREATE TABLE IF NOT EXISTS public.brand_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  goals TEXT[] NOT NULL DEFAULT '{}',
  objections TEXT[] NOT NULL DEFAULT '{}',
  preferred_channels TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Voice Profiles
CREATE TABLE IF NOT EXISTS public.brand_voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE,
  archetype TEXT NOT NULL DEFAULT 'The Pragmatic Expert',
  formality_score INT NOT NULL DEFAULT 3 CHECK (formality_score BETWEEN 1 AND 5),
  enthusiasm_score INT NOT NULL DEFAULT 3 CHECK (formality_score BETWEEN 1 AND 5),
  technical_depth_score INT NOT NULL DEFAULT 4 CHECK (technical_depth_score BETWEEN 1 AND 5),
  humor_score INT NOT NULL DEFAULT 2 CHECK (humor_score BETWEEN 1 AND 5),
  reading_grade_level TEXT NOT NULL DEFAULT 'Professional / Grade 10-12',
  primary_tone_traits TEXT[] NOT NULL DEFAULT '{"authoritative", "clear", "evidence-driven"}',
  style_guidelines TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Voice Examples (Do's & Don'ts)
CREATE TABLE IF NOT EXISTS public.brand_voice_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('do', 'dont')),
  title TEXT NOT NULL,
  snippet TEXT NOT NULL,
  explanation TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Terminology (Preferred & Avoided Terms)
CREATE TABLE IF NOT EXISTS public.brand_terminology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('preferred', 'avoided')),
  term TEXT NOT NULL,
  replacement TEXT,
  reason TEXT NOT NULL DEFAULT '',
  case_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Brand Policies (with severity levels: suggestion, warning, blocking)
CREATE TABLE IF NOT EXISTS public.brand_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('factual_claim', 'competitor_reference', 'compliance_legal', 'editorial_style', 'pricing_mention')),
  severity TEXT NOT NULL CHECK (severity IN ('suggestion', 'warning', 'blocking')),
  enforcement_action TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Competitors
CREATE TABLE IF NOT EXISTS public.brand_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  positioning TEXT NOT NULL DEFAULT '',
  key_strengths TEXT[] NOT NULL DEFAULT '{}',
  key_weaknesses TEXT[] NOT NULL DEFAULT '{}',
  differentiator TEXT NOT NULL DEFAULT '',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Brand Audit Logs (Auditability for changes)
CREATE TABLE IF NOT EXISTS public.brand_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL CHECK (entity_type IN ('profile', 'product', 'audience', 'voice', 'terminology', 'policy', 'competitor')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive', 'unarchive', 'delete')),
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_brand_products_brand ON public.brand_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_audiences_brand ON public.brand_audiences(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_examples_brand ON public.brand_voice_examples(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_terminology_brand ON public.brand_terminology(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_policies_brand ON public.brand_policies(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_competitors_brand ON public.brand_competitors(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_audit_logs_brand ON public.brand_audit_logs(brand_id);

-- Enable RLS on all Brand Brain tables
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_voice_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_terminology ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Read Access (Any brand member or org member)
CREATE POLICY "brand_profiles_select" ON public.brand_profiles FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_products_select" ON public.brand_products FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_audiences_select" ON public.brand_audiences FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_voice_profiles_select" ON public.brand_voice_profiles FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_voice_examples_select" ON public.brand_voice_examples FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_terminology_select" ON public.brand_terminology FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_policies_select" ON public.brand_policies FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_competitors_select" ON public.brand_competitors FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "brand_audit_logs_select" ON public.brand_audit_logs FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

-- RLS Policies: Mutation Access (Strategists and Org Admins have full management; Writers can contribute products/examples/terms)
CREATE POLICY "brand_profiles_manage" ON public.brand_profiles FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist']));

CREATE POLICY "brand_products_manage" ON public.brand_products FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "brand_audiences_manage" ON public.brand_audiences FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist']));

CREATE POLICY "brand_voice_profiles_manage" ON public.brand_voice_profiles FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist']));

CREATE POLICY "brand_voice_examples_manage" ON public.brand_voice_examples FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "brand_terminology_manage" ON public.brand_terminology FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "brand_policies_manage" ON public.brand_policies FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist']));

CREATE POLICY "brand_competitors_manage" ON public.brand_competitors FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist']));

CREATE POLICY "brand_audit_logs_insert" ON public.brand_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_brand_member(brand_id, auth.uid()));


-- ============================================================================
-- MIGRATION: 20260916000003_brand_brain_ingestion.sql
-- ============================================================================

-- OmniRank Schema Migration: Brand Brain Ingestion & Semantic Knowledge Base (OR-P04)
-- Tables: knowledge_sources, knowledge_documents, knowledge_chunks, evidence_sources, evidence_claims, evidence_claim_sources
-- Capabilities: pgvector embeddings, deduplication hashes, trust level taxonomy, untrusted instruction sanitization, evidence candidate extraction

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Knowledge Sources Registry
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('website', 'file_upload', 'manual_note', 'sitemap', 'api_sync')),
  source_url TEXT,
  trust_level TEXT NOT NULL DEFAULT 'verified_1p' CHECK (trust_level IN ('verified_1p', 'partner_2p', 'unverified_3p', 'untrusted')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'syncing', 'archived', 'error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Knowledge Documents
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'md', 'csv', 'xlsx', 'html', 'note')),
  storage_key TEXT,
  file_size_bytes INT NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  document_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsing_status TEXT NOT NULL DEFAULT 'parsed' CHECK (parsing_status IN ('pending', 'processing', 'parsed', 'failed')),
  trust_level TEXT NOT NULL DEFAULT 'verified_1p' CHECK (trust_level IN ('verified_1p', 'partner_2p', 'unverified_3p', 'untrusted')),
  classification TEXT NOT NULL DEFAULT 'general' CHECK (classification IN ('product_doc', 'technical_spec', 'customer_story', 'whitepaper', 'blog', 'policy', 'competitor_review', 'general')),
  chunk_count INT NOT NULL DEFAULT 0,
  has_untrusted_directives BOOLEAN NOT NULL DEFAULT false,
  sanitization_notes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Knowledge Chunks with pgvector embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  heading_hierarchy TEXT[] NOT NULL DEFAULT '{}',
  chunk_type TEXT NOT NULL DEFAULT 'text' CHECK (chunk_type IN ('text', 'table', 'list', 'code', 'quote', 'qa')),
  embedding vector(768),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  trust_level TEXT NOT NULL DEFAULT 'verified_1p' CHECK (trust_level IN ('verified_1p', 'partner_2p', 'unverified_3p', 'untrusted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Evidence Sources
CREATE TABLE IF NOT EXISTS public.evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  publisher TEXT NOT NULL DEFAULT '',
  publication_date TEXT,
  trust_score INT NOT NULL DEFAULT 90 CHECK (trust_score BETWEEN 1 AND 100),
  is_primary_source BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Evidence Claims
CREATE TABLE IF NOT EXISTS public.evidence_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'statistic' CHECK (claim_type IN ('statistic', 'benchmark', 'customer_result', 'pricing', 'compliance', 'feature', 'quote')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'disputed', 'rejected')),
  confidence_score NUMERIC(4,3) NOT NULL DEFAULT 0.850,
  extracted_entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Evidence Claim Sources Junction
CREATE TABLE IF NOT EXISTS public.evidence_claim_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.evidence_claims(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.evidence_sources(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  chunk_id UUID REFERENCES public.knowledge_chunks(id) ON DELETE SET NULL,
  exact_quote TEXT NOT NULL,
  page_or_section TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & vector search
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_brand ON public.knowledge_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_brand ON public.knowledge_documents(brand_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_hash ON public.knowledge_documents(brand_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_brand ON public.knowledge_chunks(brand_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON public.knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sources_brand ON public.evidence_sources(brand_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_brand ON public.evidence_claims(brand_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim_sources_claim ON public.evidence_claim_sources(claim_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_claim_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Read Access (Any verified brand member)
CREATE POLICY "knowledge_sources_select" ON public.knowledge_sources FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "knowledge_documents_select" ON public.knowledge_documents FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "knowledge_chunks_select" ON public.knowledge_chunks FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "evidence_sources_select" ON public.evidence_sources FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "evidence_claims_select" ON public.evidence_claims FOR SELECT TO authenticated
  USING (public.is_brand_member(brand_id, auth.uid()));

CREATE POLICY "evidence_claim_sources_select" ON public.evidence_claim_sources FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND public.is_brand_member(ec.brand_id, auth.uid())
    )
  );

-- RLS Policies: Write Access (Strategists and Writers)
CREATE POLICY "knowledge_sources_manage" ON public.knowledge_sources FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "knowledge_documents_manage" ON public.knowledge_documents FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "knowledge_chunks_manage" ON public.knowledge_chunks FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "evidence_sources_manage" ON public.evidence_sources FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "evidence_claims_manage" ON public.evidence_claims FOR ALL TO authenticated
  USING (public.has_brand_role(brand_id, auth.uid(), ARRAY['strategist', 'writer']));

CREATE POLICY "evidence_claim_sources_manage" ON public.evidence_claim_sources FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evidence_claims ec
      WHERE ec.id = claim_id AND public.has_brand_role(ec.brand_id, auth.uid(), ARRAY['strategist', 'writer'])
    )
  );


-- ============================================================================
-- MIGRATION: 20260917000004_hardened_auth_tenancy_rls.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260918000005_hardened_ingestion_tenancy.sql
-- ============================================================================

-- OmniRank Schema Migration: Hardened Ingestion, Tenancy & Vector Search (OR-G04B)
-- 1. Trust Level Taxonomy & Status Updates
-- 2. Organization Consistency Guarantees
-- 3. Document Revisions & Claim Provenance
-- 4. Vector Semantic Similarity Search (pgvector)

-- 1. Add organization_id and revisions to knowledge_documents
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1;

-- 2. Add organization_id to chunks, evidence_sources, evidence_claims
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.evidence_sources
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.evidence_claims
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 3. Update Check Constraints for Taxonomy & Verification Status
ALTER TABLE public.knowledge_sources
  DROP CONSTRAINT IF EXISTS knowledge_sources_trust_level_check;

ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT knowledge_sources_trust_level_check
  CHECK (trust_level IN (
    'brand_authoritative', 'external_authoritative', 'partner', 'competitor',
    'unverified_external', 'untrusted_crawl', 'verified_1p', 'partner_2p',
    'unverified_3p', 'untrusted'
  ));

ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_trust_level_check;

ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT knowledge_documents_trust_level_check
  CHECK (trust_level IN (
    'brand_authoritative', 'external_authoritative', 'partner', 'competitor',
    'unverified_external', 'untrusted_crawl', 'verified_1p', 'partner_2p',
    'unverified_3p', 'untrusted'
  ));

ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS knowledge_chunks_trust_level_check;

ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT knowledge_chunks_trust_level_check
  CHECK (trust_level IN (
    'brand_authoritative', 'external_authoritative', 'partner', 'competitor',
    'unverified_external', 'untrusted_crawl', 'verified_1p', 'partner_2p',
    'unverified_3p', 'untrusted'
  ));

ALTER TABLE public.evidence_claims
  DROP CONSTRAINT IF EXISTS evidence_claims_verification_status_check;

ALTER TABLE public.evidence_claims
  ADD CONSTRAINT evidence_claims_verification_status_check
  CHECK (verification_status IN ('unverified', 'needs_review', 'verified', 'disputed', 'rejected'));

-- 4. Tenant-Brand Consistency Validation Trigger Function
CREATE OR REPLACE FUNCTION public.validate_tenant_brand_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_brand_org UUID;
BEGIN
  IF NEW.brand_id IS NOT NULL AND NEW.organization_id IS NOT NULL THEN
    SELECT organization_id INTO v_brand_org FROM public.brands WHERE id = NEW.brand_id;
    IF v_brand_org IS NULL OR v_brand_org != NEW.organization_id THEN
      RAISE EXCEPTION 'Tenant violation: brand % does not belong to organization %', NEW.brand_id, NEW.organization_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply consistency triggers across tenant-scoped ingestion tables
DROP TRIGGER IF EXISTS trg_validate_sources_tenant ON public.knowledge_sources;
CREATE TRIGGER trg_validate_sources_tenant
  BEFORE INSERT OR UPDATE ON public.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_brand_consistency();

DROP TRIGGER IF EXISTS trg_validate_docs_tenant ON public.knowledge_documents;
CREATE TRIGGER trg_validate_docs_tenant
  BEFORE INSERT OR UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_brand_consistency();

DROP TRIGGER IF EXISTS trg_validate_chunks_tenant ON public.knowledge_chunks;
CREATE TRIGGER trg_validate_chunks_tenant
  BEFORE INSERT OR UPDATE ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_brand_consistency();

DROP TRIGGER IF EXISTS trg_validate_ev_sources_tenant ON public.evidence_sources;
CREATE TRIGGER trg_validate_ev_sources_tenant
  BEFORE INSERT OR UPDATE ON public.evidence_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_brand_consistency();

DROP TRIGGER IF EXISTS trg_validate_ev_claims_tenant ON public.evidence_claims;
CREATE TRIGGER trg_validate_ev_claims_tenant
  BEFORE INSERT OR UPDATE ON public.evidence_claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_brand_consistency();

-- 5. pgvector Semantic Search Function with strict Brand isolation
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


-- ============================================================================
-- MIGRATION: 20260918000006_canonical_hardened_rls.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260919000001_role_helper_bootstrap.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260929000007_live_foundation_closure.sql
-- ============================================================================

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



-- ============================================================================
-- MIGRATION: 20260929000008_predeployment_integrity.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260929000009_postdeployment_sync.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260929000010_articles_schema.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20260929000011_article_integrity.sql
-- ============================================================================

-- ============================================================================
-- Migration: 20260929000011_article_integrity.sql
-- Gate: OR-P05-FIX — Article DB Tenant Consistency + Approval Guard
-- Description: Adds FK-based consistency constraints, triggers for tenant
--   cohesion, and a Writer approval-prevention DB trigger.
--   Does NOT modify migration 00010.
-- ============================================================================

-- ============================================================================
-- 1. ARTICLE TENANT CONSISTENCY
-- Article brand must belong to article's organization.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_article_brand_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  brand_org UUID;
BEGIN
  SELECT organization_id INTO brand_org
  FROM public.brands
  WHERE id = NEW.brand_id;

  IF brand_org IS NULL OR brand_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Article brand % does not belong to organization %',
      NEW.brand_id, NEW.organization_id;
  END IF;

  -- If website_id provided, it must belong to the same brand and org
  IF NEW.website_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.websites
      WHERE id = NEW.website_id
        AND brand_id = NEW.brand_id
        AND organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Website % does not belong to brand % / organization %',
        NEW.website_id, NEW.brand_id, NEW.organization_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_article_brand_org ON public.articles;
CREATE TRIGGER trg_article_brand_org
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_article_brand_org();

-- ============================================================================
-- 2. WORKING DOCUMENT TENANT CONSISTENCY
-- Must match parent article brand/org.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_working_doc_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  art_brand UUID;
  art_org UUID;
BEGIN
  SELECT brand_id, organization_id INTO art_brand, art_org
  FROM public.articles WHERE id = NEW.article_id;

  IF art_brand IS NULL THEN
    RAISE EXCEPTION 'Article % not found for working document', NEW.article_id;
  END IF;

  IF NEW.brand_id <> art_brand OR NEW.organization_id <> art_org THEN
    RAISE EXCEPTION 'Working document brand/org does not match article brand/org';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_working_doc_consistency ON public.article_working_documents;
CREATE TRIGGER trg_working_doc_consistency
  BEFORE INSERT OR UPDATE ON public.article_working_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_working_doc_consistency();

-- ============================================================================
-- 3. ARTICLE VERSION TENANT CONSISTENCY
-- Must match parent article brand/org.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_article_version_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  art_brand UUID;
  art_org UUID;
BEGIN
  SELECT brand_id, organization_id INTO art_brand, art_org
  FROM public.articles WHERE id = NEW.article_id;

  IF art_brand IS NULL THEN
    RAISE EXCEPTION 'Article % not found for version', NEW.article_id;
  END IF;

  IF NEW.brand_id <> art_brand OR NEW.organization_id <> art_org THEN
    RAISE EXCEPTION 'Article version brand/org does not match article brand/org';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_article_version_consistency ON public.article_versions;
CREATE TRIGGER trg_article_version_consistency
  BEFORE INSERT ON public.article_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_article_version_consistency();

-- ============================================================================
-- 4. BLOCK OPERATION TENANT CONSISTENCY
-- Must match parent article brand/org.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_block_op_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  art_brand UUID;
  art_org UUID;
BEGIN
  SELECT brand_id, organization_id INTO art_brand, art_org
  FROM public.articles WHERE id = NEW.article_id;

  IF art_brand IS NULL THEN
    RAISE EXCEPTION 'Article % not found for block operation', NEW.article_id;
  END IF;

  IF NEW.brand_id <> art_brand OR NEW.organization_id <> art_org THEN
    RAISE EXCEPTION 'Block operation brand/org does not match article brand/org';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_op_consistency ON public.content_block_operations;
CREATE TRIGGER trg_block_op_consistency
  BEFORE INSERT ON public.content_block_operations
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_block_op_consistency();

-- ============================================================================
-- 5. APPROVED VERSION CONSISTENCY
-- approved_version_id must belong to the same article.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_approved_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.approved_version_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.article_versions
      WHERE id = NEW.approved_version_id
        AND article_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'approved_version_id % does not belong to article %',
        NEW.approved_version_id, NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approved_version ON public.articles;
CREATE TRIGGER trg_approved_version
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_approved_version();

-- ============================================================================
-- 6. WRITER APPROVAL GUARD — DB enforcement
-- Writers (not strategist/org-admin) may NOT set:
--   status = 'approved'
--   approved_by
--   approved_version_id
-- This is enforced at DB level via RLS + an additional trigger.
--
-- NOTE: Service role bypasses RLS and can approve (used for trusted server
-- workflows). Normal authenticated users are subject to this trigger.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_prevent_writer_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_brand_role TEXT;
  caller_org_role   TEXT;
BEGIN
  -- Only enforce for authenticated users; service role bypass is intentional.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Resolve brand role of current caller
  SELECT role INTO caller_brand_role
  FROM public.brand_members
  WHERE brand_id = NEW.brand_id
    AND user_id = auth.uid();

  -- Resolve org role of current caller
  SELECT role INTO caller_org_role
  FROM public.organization_members
  WHERE organization_id = NEW.organization_id
    AND user_id = auth.uid();

  -- Check if the caller is attempting to approve
  IF (
    NEW.status = 'approved'
    OR NEW.approved_by IS NOT NULL
    OR NEW.approved_version_id IS NOT NULL
  ) THEN
    -- Allow: strategist or reviewer brand role
    IF caller_brand_role IN ('strategist', 'reviewer') THEN
      RETURN NEW;
    END IF;
    -- Allow: org owner or admin
    IF caller_org_role IN ('owner', 'admin') THEN
      RETURN NEW;
    END IF;
    -- Deny: writer, viewer
    RAISE EXCEPTION 'Only a strategist, reviewer, or org admin may approve articles. Current brand role: %',
      COALESCE(caller_brand_role, 'none');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_writer_approval ON public.articles;
CREATE TRIGGER trg_prevent_writer_approval
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_writer_approval();

-- ============================================================================
-- 7. Unique version number sequence (per article) — safe concurrent creation
-- Use a surrogate sequence rather than MAX()+1.
-- We enforce UNIQUE(article_id, version_number) and use a DB-side sequence
-- via a trigger to assign version_number safely.
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_article_version_number
  START WITH 1 INCREMENT BY 1;

-- Per-article version counter via advisory lock + max scan, ensuring
-- the UNIQUE constraint is the real guard. The trigger increments a
-- per-article counter atomically.
CREATE OR REPLACE FUNCTION public.fn_assign_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_ver INT;
BEGIN
  -- Advisory lock scoped to the article row to prevent races
  PERFORM pg_advisory_xact_lock(('x' || substr(md5(NEW.article_id::text), 1, 15))::bit(60)::bigint);

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_ver
  FROM public.article_versions
  WHERE article_id = NEW.article_id;

  NEW.version_number := next_ver;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_version_number ON public.article_versions;
CREATE TRIGGER trg_assign_version_number
  BEFORE INSERT ON public.article_versions
  FOR EACH ROW
  WHEN (NEW.version_number IS NULL OR NEW.version_number = 0)
  EXECUTE FUNCTION public.fn_assign_version_number();

-- Allow the consistency trigger to run before the version number assignment
-- (trigger execution order is alphabetical, so trg_article_version_consistency
-- runs before trg_assign_version_number — both BEFORE INSERT which is correct)

-- Revoke direct execution of helper functions from public
REVOKE ALL ON FUNCTION public.fn_check_article_brand_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_check_working_doc_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_check_article_version_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_check_block_op_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_check_approved_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_prevent_writer_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_assign_version_number() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 8. NARROW REVIEW MECHANISM
-- Allows reviewers to approve/reject without gaining general UPDATE permission.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.review_article(
  p_article_id UUID,
  p_version_id UUID,
  p_decision TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_brand_id UUID;
  v_org_id UUID;
  caller_brand_role TEXT;
  caller_org_role TEXT;
BEGIN
  -- 1. Get article
  SELECT brand_id, organization_id INTO v_brand_id, v_org_id
  FROM public.articles
  WHERE id = p_article_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article not found';
  END IF;

  -- 2. Verify auth
  SELECT role INTO caller_brand_role
  FROM public.brand_members
  WHERE brand_id = v_brand_id AND user_id = auth.uid();

  SELECT role INTO caller_org_role
  FROM public.organization_members
  WHERE organization_id = v_org_id AND user_id = auth.uid();

  IF NOT (
    caller_brand_role IN ('strategist', 'reviewer')
    OR caller_org_role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only strategist, reviewer, or org admin can review articles';
  END IF;

  -- 3. Enforce decision logic
  IF p_decision = 'approved' THEN
    IF p_version_id IS NULL THEN
      RAISE EXCEPTION 'p_version_id is required for approval';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM public.article_versions
      WHERE id = p_version_id AND article_id = p_article_id
    ) THEN
      RAISE EXCEPTION 'Version does not belong to this article';
    END IF;

    UPDATE public.articles
    SET 
      status = 'approved',
      approved_version_id = p_version_id,
      approved_by = auth.uid(),
      updated_at = NOW()
    WHERE id = p_article_id;

  ELSIF p_decision = 'rejected' THEN
    UPDATE public.articles
    SET 
      status = 'drafting',
      approved_version_id = NULL,
      approved_by = NULL,
      updated_at = NOW()
    WHERE id = p_article_id;

  ELSE
    RAISE EXCEPTION 'Invalid review decision. Must be approved or rejected.';
  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.review_article(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_article(UUID, UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- MIGRATION: 20260929000012_opportunities_schema.sql
-- ============================================================================

-- ============================================================================
-- Migration: 20260929000012_opportunities_schema.sql
-- Gate: OR-P06-PREDEPLOY — Final Auth + Handoff Fix
-- Description: Tenant-scoped opportunities for content/evidence gaps.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  
  fingerprint TEXT NOT NULL,
  
  type TEXT NOT NULL 
    CHECK (type IN ('new_content', 'refresh_content', 'content_gap', 'internal_link', 'evidence_gap', 'brand_knowledge_gap')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'accepted', 'in_progress', 'completed', 'dismissed')),
    
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  
  priority_score INT NOT NULL DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
  confidence_score INT NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  effort_score INT NOT NULL DEFAULT 0 CHECK (effort_score >= 0 AND effort_score <= 100),
  impact_score INT NOT NULL DEFAULT 0 CHECK (impact_score >= 0 AND impact_score <= 100),
  
  source_signals JSONB NOT NULL DEFAULT '{}',
  
  target_keyword TEXT,
  target_url TEXT,
  related_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  UNIQUE (brand_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_brand_status ON public.opportunities(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON public.opportunities(brand_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON public.opportunities(brand_id, type);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- SELECT: any brand member can read their brand's opportunities
CREATE POLICY "opportunities_select_brand_member" ON public.opportunities
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

-- INSERT: Strategist or Admin only
CREATE POLICY "opportunities_insert_strategist" ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist'])
    OR authz.is_org_admin(organization_id)
  );

-- UPDATE:
-- Writers can accept/work (move to accepted/in_progress/completed)
-- Strategists/Admins can do everything
CREATE OR REPLACE FUNCTION public.fn_check_opportunity_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_brand_role TEXT;
  caller_org_role TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- 1. Immutable fields for everyone
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'organization_id cannot be modified';
    END IF;
    IF NEW.brand_id IS DISTINCT FROM OLD.brand_id THEN
      RAISE EXCEPTION 'brand_id cannot be modified';
    END IF;
  END IF;

  -- 2. Tenant invariants
  -- Brand -> Org invariant
  IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = NEW.brand_id AND organization_id = NEW.organization_id) THEN
     RAISE EXCEPTION 'Brand does not belong to the specified organization';
  END IF;
  
  -- Website -> Brand/Org invariant
  IF NEW.website_id IS NOT NULL THEN
     IF NOT EXISTS (SELECT 1 FROM public.websites WHERE id = NEW.website_id AND brand_id = NEW.brand_id) THEN
        RAISE EXCEPTION 'Website does not belong to the specified brand';
     END IF;
  END IF;
  
  -- Article -> Brand invariant
  IF NEW.related_article_id IS NOT NULL THEN
     IF NOT EXISTS (SELECT 1 FROM public.articles WHERE id = NEW.related_article_id AND brand_id = NEW.brand_id) THEN
        RAISE EXCEPTION 'Article does not belong to the specified brand';
     END IF;
  END IF;

  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_brand_role FROM public.brand_members
  WHERE brand_id = NEW.brand_id AND user_id = auth.uid();
  
  SELECT role INTO caller_org_role FROM public.organization_members
  WHERE organization_id = NEW.organization_id AND user_id = auth.uid();

  IF caller_brand_role = 'strategist' OR caller_org_role IN ('owner', 'admin') THEN
    RETURN NEW;
  END IF;

  IF caller_brand_role = 'writer' THEN
    IF TG_OP = 'UPDATE' THEN
      -- Cannot revive dismissed or completed
      IF OLD.status IN ('dismissed', 'completed') THEN
        RAISE EXCEPTION 'Writers cannot revive dismissed or completed opportunities';
      END IF;

      -- Valid workflow transitions check
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
          (OLD.status = 'new' AND NEW.status = 'accepted') OR
          (OLD.status = 'accepted' AND NEW.status = 'in_progress') OR
          (OLD.status = 'in_progress' AND NEW.status = 'completed')
        ) THEN
          RAISE EXCEPTION 'Invalid workflow transition for writer';
        END IF;
      END IF;
      
      -- Field mutability check
      IF NEW.fingerprint IS DISTINCT FROM OLD.fingerprint OR
         NEW.type IS DISTINCT FROM OLD.type OR
         NEW.title IS DISTINCT FROM OLD.title OR
         NEW.summary IS DISTINCT FROM OLD.summary OR
         NEW.rationale IS DISTINCT FROM OLD.rationale OR
         NEW.priority_score IS DISTINCT FROM OLD.priority_score OR
         NEW.confidence_score IS DISTINCT FROM OLD.confidence_score OR
         NEW.effort_score IS DISTINCT FROM OLD.effort_score OR
         NEW.impact_score IS DISTINCT FROM OLD.impact_score OR
         NEW.source_signals IS DISTINCT FROM OLD.source_signals OR
         NEW.target_keyword IS DISTINCT FROM OLD.target_keyword OR
         NEW.target_url IS DISTINCT FROM OLD.target_url OR
         NEW.dismissed_at IS DISTINCT FROM OLD.dismissed_at
      THEN
         RAISE EXCEPTION 'Writers can only update workflow status and related article';
      END IF;

      -- completed_at logic
      IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
        IF NEW.status != 'completed' THEN
          RAISE EXCEPTION 'completed_at can only be updated when status is completed';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized to update opportunities';
END;
$$;

REVOKE ALL ON FUNCTION public.fn_check_opportunity_update() FROM PUBLIC, anon;

CREATE TRIGGER trg_opportunities_update_auth
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_opportunity_update();
  
CREATE TRIGGER trg_opportunities_insert_auth
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_opportunity_update();

-- The RLS policy allows update if they are writer+
CREATE POLICY "opportunities_update_writer" ON public.opportunities
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

-- DELETE: only strategist/org admin
CREATE POLICY "opportunities_delete_strategist" ON public.opportunities
  FOR DELETE TO authenticated
  USING (
    authz.has_brand_role(brand_id, ARRAY['strategist'])
    OR authz.is_org_admin(organization_id)
  );

-- ============================================================================
-- Atomic Article Handoff RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handoff_opportunity_to_article(
  p_opportunity_id UUID,
  p_brand_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_opp public.opportunities%ROWTYPE;
  v_article_id UUID;
  v_slug TEXT;
  v_title TEXT;
BEGIN
  -- Check auth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock the row to prevent concurrent handoffs
  SELECT * INTO v_opp
  FROM public.opportunities
  WHERE id = p_opportunity_id AND brand_id = p_brand_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found or mismatch';
  END IF;

  IF v_opp.type NOT IN ('new_content', 'content_gap') THEN
    RAISE EXCEPTION 'Opportunity type does not support creating an article draft';
  END IF;

  -- Idempotency
  IF v_opp.related_article_id IS NOT NULL THEN
    RETURN v_opp.related_article_id;
  END IF;

  -- Use target_keyword or title
  v_title := COALESCE(v_opp.target_keyword, v_opp.title);
  v_slug := regexp_replace(lower(v_title), '[^a-z0-9-]+', '-', 'g');
  
  -- Insert OR-P05 article draft (schemaVersion 1.0)
  INSERT INTO public.articles (
    organization_id, brand_id, schema_version, status, title, slug, locale,
    seo, geo, metadata, sources, relationships, created_by
  ) VALUES (
    v_opp.organization_id, v_opp.brand_id, '1.0', 'drafting', v_title,
    v_slug, 'en', '{}', '{}', jsonb_build_object('generatedFromOpportunity', v_opp.id), '[]', '[]', auth.uid()
  ) RETURNING id INTO v_article_id;

  -- Update opportunity
  UPDATE public.opportunities
  SET related_article_id = v_article_id,
      status = 'in_progress',
      updated_at = NOW()
  WHERE id = p_opportunity_id;

  RETURN v_article_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handoff_opportunity_to_article(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handoff_opportunity_to_article(UUID, UUID) TO authenticated, service_role;

