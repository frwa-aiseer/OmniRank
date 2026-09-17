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
