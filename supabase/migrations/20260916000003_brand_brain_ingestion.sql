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
