-- ============================================================================
-- Migration: 20260929000013_research_engine_schema.sql
-- Gate: OR-P07 — Research and Evidence Engine
-- Description: Tenant-scoped research projects, questions, sources, findings, and briefs.
-- ============================================================================

-- 1. RESEARCH PROJECTS
CREATE TABLE IF NOT EXISTS public.research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  opportunity_context JSONB,
  
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'standard', 'deep')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'researching', 'review', 'completed', 'archived')),
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_unique_active_opp_research ON public.research_projects(opportunity_id) WHERE opportunity_id IS NOT NULL AND status NOT IN ('completed', 'archived');

-- 2. RESEARCH QUESTIONS
CREATE TABLE IF NOT EXISTS public.research_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  
  question_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'needs_more_research', 'not_answerable')),
  origin_type TEXT NOT NULL CHECK (origin_type IN ('user', 'opportunity', 'brand_brain', 'system')),
  origin_reference TEXT,
  order_index INT NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RESEARCH SOURCES
CREATE TABLE IF NOT EXISTS public.research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  
  classification TEXT NOT NULL CHECK (classification IN ('brand', 'primary', 'authoritative_external', 'competitor', 'search_result', 'weak')),
  title TEXT NOT NULL,
  url TEXT,
  publisher TEXT,
  publication_date TEXT,
  trust_classification TEXT NOT NULL,
  extracted_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  
  knowledge_source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
  knowledge_document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  knowledge_chunk_id UUID REFERENCES public.knowledge_chunks(id) ON DELETE SET NULL,
  evidence_source_id UUID REFERENCES public.evidence_sources(id) ON DELETE SET NULL,
  evidence_claim_id UUID REFERENCES public.evidence_claims(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RESEARCH FINDINGS
CREATE TABLE IF NOT EXISTS public.research_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.research_questions(id) ON DELETE SET NULL,
  
  finding_text TEXT NOT NULL,
  support_status TEXT NOT NULL CHECK (support_status IN ('supported', 'partially_supported', 'unsupported', 'conflicting')),
  confidence_score INT NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  source_references JSONB NOT NULL DEFAULT '[]',
  provenance_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CONTENT BRIEFS
CREATE TABLE IF NOT EXISTS public.content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.research_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  search_intent TEXT NOT NULL,
  primary_objective TEXT NOT NULL,
  target_keyword TEXT,
  supporting_keywords JSONB NOT NULL DEFAULT '[]',
  cta TEXT,
  
  outline JSONB NOT NULL DEFAULT '[]',
  proposed_tables JSONB NOT NULL DEFAULT '[]',
  proposed_visuals JSONB NOT NULL DEFAULT '[]',
  faq_ideas JSONB NOT NULL DEFAULT '[]',
  source_selections JSONB NOT NULL DEFAULT '[]',
  unsupported_issues JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected')),
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_projects_brand ON public.research_projects(brand_id);
CREATE INDEX IF NOT EXISTS idx_research_questions_project ON public.research_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_project ON public.research_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_research_findings_project ON public.research_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_content_briefs_brand ON public.content_briefs(brand_id);

-- Enable RLS
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;

-- Viewer+ can read
CREATE POLICY "research_projects_select" ON public.research_projects FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "research_questions_select" ON public.research_questions FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "research_sources_select" ON public.research_sources FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "research_findings_select" ON public.research_findings FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));
CREATE POLICY "content_briefs_select" ON public.content_briefs FOR SELECT TO authenticated USING (authz.can_view_brand(brand_id));

-- Strategist / Admin: Full control
CREATE POLICY "research_projects_manage" ON public.research_projects FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));
CREATE POLICY "research_questions_manage" ON public.research_questions FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));
CREATE POLICY "research_sources_manage" ON public.research_sources FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));
CREATE POLICY "research_findings_manage" ON public.research_findings FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));
CREATE POLICY "content_briefs_manage" ON public.content_briefs FOR ALL TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id));

-- Writer: Create/Edit drafting content
CREATE POLICY "research_projects_writer" ON public.research_projects FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));
CREATE POLICY "research_projects_writer_update" ON public.research_projects FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));

CREATE POLICY "research_questions_writer" ON public.research_questions FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));
CREATE POLICY "research_questions_writer_update" ON public.research_questions FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));

CREATE POLICY "research_sources_writer" ON public.research_sources FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));
CREATE POLICY "research_sources_writer_update" ON public.research_sources FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));

CREATE POLICY "research_findings_writer" ON public.research_findings FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));
CREATE POLICY "research_findings_writer_update" ON public.research_findings FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));

CREATE POLICY "content_briefs_writer" ON public.content_briefs FOR INSERT TO authenticated
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));
CREATE POLICY "content_briefs_writer_update" ON public.content_briefs FOR UPDATE TO authenticated
  USING (authz.has_brand_role(brand_id, ARRAY['writer']))
  WITH CHECK (authz.has_brand_role(brand_id, ARRAY['writer']));


-- ============================================================================
-- Tenant & Project Invariant Checks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_research_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
  v_ref UUID;
BEGIN
  -- Prevent changing tenant
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
       NEW.brand_id IS DISTINCT FROM OLD.brand_id OR
       (TG_TABLE_NAME != 'research_projects' AND NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
      RAISE EXCEPTION 'Cannot move records across tenants or projects';
    END IF;
  END IF;

  -- Brand -> Org invariant
  IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = NEW.brand_id AND organization_id = NEW.organization_id) THEN
     RAISE EXCEPTION 'Brand does not belong to the specified organization';
  END IF;

  IF TG_TABLE_NAME = 'research_projects' THEN
    IF NEW.opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.opportunities WHERE id = NEW.opportunity_id AND brand_id = NEW.brand_id) THEN
      RAISE EXCEPTION 'Opportunity does not belong to the specified brand';
    END IF;
    IF NEW.article_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.articles WHERE id = NEW.article_id AND brand_id = NEW.brand_id) THEN
      RAISE EXCEPTION 'Article does not belong to the specified brand';
    END IF;

  ELSE
    -- Child tables: must match project's brand/org
    IF NOT EXISTS (SELECT 1 FROM public.research_projects WHERE id = NEW.project_id AND brand_id = NEW.brand_id AND organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'Child record tenant details must match parent project';
    END IF;

    IF TG_TABLE_NAME = 'research_questions' THEN
      -- No extra checks
    ELSIF TG_TABLE_NAME = 'research_sources' THEN
      -- Validate foreign provenance
      IF NEW.knowledge_source_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.knowledge_sources WHERE id=NEW.knowledge_source_id AND brand_id=NEW.brand_id) THEN
        RAISE EXCEPTION 'Foreign knowledge_source';
      END IF;
      IF NEW.evidence_source_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.evidence_sources WHERE id=NEW.evidence_source_id AND brand_id=NEW.brand_id) THEN
        RAISE EXCEPTION 'Foreign evidence_source';
      END IF;
      IF NEW.evidence_claim_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.evidence_claims WHERE id=NEW.evidence_claim_id AND brand_id=NEW.brand_id) THEN
        RAISE EXCEPTION 'Foreign evidence_claim';
      END IF;
      IF NEW.knowledge_document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.knowledge_documents WHERE id=NEW.knowledge_document_id AND (source_id=NEW.knowledge_source_id OR NEW.knowledge_source_id IS NULL)) THEN
        RAISE EXCEPTION 'Foreign knowledge_document';
      END IF;

    ELSIF TG_TABLE_NAME = 'research_findings' THEN
      IF NEW.question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.research_questions WHERE id=NEW.question_id AND project_id=NEW.project_id) THEN
        RAISE EXCEPTION 'Question does not belong to the same project';
      END IF;
      
      -- Validate source_references JSONB array contains valid IDs from SAME project
      FOR v_ref IN SELECT jsonb_array_elements_text(NEW.source_references)::UUID
      LOOP
        IF NOT EXISTS (SELECT 1 FROM public.research_sources WHERE id = v_ref AND project_id = NEW.project_id) THEN
          RAISE EXCEPTION 'Invalid or missing source reference in finding';
        END IF;
      END LOOP;

      -- Supported/Partially Supported must have at least 1 source
      IF NEW.support_status IN ('supported', 'partially_supported') AND jsonb_array_length(NEW.source_references) = 0 THEN
        RAISE EXCEPTION 'Supported finding must reference at least one research source';
      END IF;

    ELSIF TG_TABLE_NAME = 'content_briefs' THEN
      -- Validate source_selections JSONB array contains valid IDs from SAME project
      FOR v_ref IN SELECT jsonb_array_elements_text(NEW.source_selections)::UUID
      LOOP
        IF NOT EXISTS (SELECT 1 FROM public.research_sources WHERE id = v_ref AND project_id = NEW.project_id) THEN
          RAISE EXCEPTION 'Invalid or missing source reference in content brief';
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_check_research_invariants() FROM PUBLIC, anon;

CREATE TRIGGER trg_research_projects_invariants BEFORE INSERT OR UPDATE ON public.research_projects FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_invariants();
CREATE TRIGGER trg_research_questions_invariants BEFORE INSERT OR UPDATE ON public.research_questions FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_invariants();
CREATE TRIGGER trg_research_sources_invariants BEFORE INSERT OR UPDATE ON public.research_sources FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_invariants();
CREATE TRIGGER trg_research_findings_invariants BEFORE INSERT OR UPDATE ON public.research_findings FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_invariants();
CREATE TRIGGER trg_content_briefs_invariants BEFORE INSERT OR UPDATE ON public.content_briefs FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_invariants();


-- ============================================================================
-- Writer Restrictions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_research_writer_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_brand_role TEXT;
  v_org_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  
  SELECT role INTO v_brand_role FROM public.brand_members WHERE brand_id = NEW.brand_id AND user_id = auth.uid();
  SELECT role INTO v_org_role FROM public.organization_members WHERE organization_id = NEW.organization_id AND user_id = auth.uid();

  IF v_brand_role = 'writer' AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
    IF TG_TABLE_NAME = 'research_projects' THEN
      IF TG_OP = 'UPDATE' AND (NEW.status IN ('completed', 'archived') OR OLD.status IN ('completed', 'archived')) THEN
        RAISE EXCEPTION 'Writer cannot archive or complete projects';
      END IF;
    ELSIF TG_TABLE_NAME = 'content_briefs' THEN
      IF TG_OP = 'UPDATE' AND (NEW.status IN ('approved', 'rejected') OR OLD.status IN ('approved', 'rejected')) THEN
        RAISE EXCEPTION 'Writer cannot approve or reject content briefs';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_check_research_writer_restrictions() FROM PUBLIC, anon;
CREATE TRIGGER trg_research_projects_writer_restrict BEFORE UPDATE ON public.research_projects FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_writer_restrictions();
CREATE TRIGGER trg_content_briefs_writer_restrict BEFORE UPDATE ON public.content_briefs FOR EACH ROW EXECUTE FUNCTION public.fn_check_research_writer_restrictions();


-- ============================================================================
-- Atomic Opportunity -> Research Handoff RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handoff_opportunity_to_research(
  p_opportunity_id UUID,
  p_brand_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_opp public.opportunities%ROWTYPE;
  v_project_id UUID;
  v_brand_role TEXT;
  v_org_role TEXT;
BEGIN
  -- Check auth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_brand_role FROM public.brand_members WHERE brand_id = p_brand_id AND user_id = auth.uid();
  SELECT role INTO v_org_role FROM public.organization_members WHERE organization_id = (SELECT organization_id FROM public.brands WHERE id = p_brand_id) AND user_id = auth.uid();

  IF (v_brand_role IS NULL OR v_brand_role NOT IN ('strategist', 'writer')) AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Forbidden: Not authorized for this brand';
  END IF;

  -- Lock opportunity
  SELECT * INTO v_opp FROM public.opportunities WHERE id = p_opportunity_id AND brand_id = p_brand_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found or mismatch'; END IF;
  IF v_opp.status IN ('dismissed', 'completed') THEN RAISE EXCEPTION 'Cannot handoff dismissed or completed opportunities'; END IF;

  -- Idempotency check: active project
  SELECT id INTO v_project_id FROM public.research_projects WHERE opportunity_id = p_opportunity_id AND brand_id = p_brand_id AND status NOT IN ('completed', 'archived') LIMIT 1;
  IF FOUND THEN
    RETURN v_project_id;
  END IF;

  -- Insert new project
  INSERT INTO public.research_projects (
    organization_id, brand_id, opportunity_id, title, objective, mode, status, created_by, opportunity_context
  ) VALUES (
    v_opp.organization_id, v_opp.brand_id, v_opp.id, 
    'Research: ' || v_opp.title, 
    COALESCE(v_opp.rationale, 'Gather evidence and construct brief'),
    'standard', 'draft', auth.uid(),
    jsonb_build_object('type', v_opp.type, 'target_keyword', v_opp.target_keyword, 'rationale', v_opp.rationale, 'source_signals', v_opp.source_signals) 
  ) RETURNING id INTO v_project_id;

  -- Optionally generate an initial question based on target_keyword
  IF v_opp.target_keyword IS NOT NULL THEN
    INSERT INTO public.research_questions (
      project_id, organization_id, brand_id, question_text, origin_type, origin_reference
    ) VALUES (
      v_project_id, v_opp.organization_id, v_opp.brand_id,
      'What are the primary search intents and existing authoritative answers for "' || v_opp.target_keyword || '"?',
      'opportunity', v_opp.id::text
    );
  END IF;

  RETURN v_project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.handoff_opportunity_to_research(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handoff_opportunity_to_research(UUID, UUID) TO authenticated;

-- ============================================================================
-- Reviewer RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.review_research_finding(
  p_finding_id UUID,
  p_support_status TEXT,
  p_confidence_score INT,
  p_notes TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_finding public.research_findings%ROWTYPE;
  v_brand_role TEXT;
  v_org_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  
  SELECT * INTO v_finding FROM public.research_findings WHERE id = p_finding_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finding not found'; END IF;

  SELECT role INTO v_brand_role FROM public.brand_members WHERE brand_id = v_finding.brand_id AND user_id = auth.uid();
  SELECT role INTO v_org_role FROM public.organization_members WHERE organization_id = v_finding.organization_id AND user_id = auth.uid();

  IF (v_brand_role IS NULL OR v_brand_role NOT IN ('strategist', 'reviewer')) AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Forbidden: Not authorized to review findings';
  END IF;

  UPDATE public.research_findings
  SET support_status = p_support_status,
      confidence_score = COALESCE(p_confidence_score, confidence_score),
      provenance_notes = COALESCE(p_notes, provenance_notes),
      updated_at = NOW()
  WHERE id = p_finding_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_research_finding(UUID, TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_research_finding(UUID, TEXT, INT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_content_brief(
  p_brief_id UUID,
  p_status TEXT,
  p_notes TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_brief public.content_briefs%ROWTYPE;
  v_brand_role TEXT;
  v_org_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  
  SELECT * INTO v_brief FROM public.content_briefs WHERE id = p_brief_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Brief not found'; END IF;

  SELECT role INTO v_brand_role FROM public.brand_members WHERE brand_id = v_brief.brand_id AND user_id = auth.uid();
  SELECT role INTO v_org_role FROM public.organization_members WHERE organization_id = v_brief.organization_id AND user_id = auth.uid();

  -- Reviewer can only transition review -> review with notes, but Strategist can approve/reject.
  -- Simplified: Reviewers can't set to approved, only Strategists/Admins.
  IF p_status IN ('approved', 'rejected') THEN
    IF (v_brand_role IS NULL OR v_brand_role NOT IN ('strategist')) AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Forbidden: Only strategist or admin can approve/reject briefs';
    END IF;
  ELSE
    IF (v_brand_role IS NULL OR v_brand_role NOT IN ('strategist', 'reviewer')) AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Forbidden: Not authorized to review briefs';
    END IF;
  END IF;

  UPDATE public.content_briefs
  SET status = p_status,
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE id = p_brief_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_content_brief(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_content_brief(UUID, TEXT, TEXT) TO authenticated;

