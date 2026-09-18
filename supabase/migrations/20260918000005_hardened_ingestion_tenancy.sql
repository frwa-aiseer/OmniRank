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
