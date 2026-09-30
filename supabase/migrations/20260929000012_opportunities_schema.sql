-- ============================================================================
-- Migration: 20260929000012_opportunities_schema.sql
-- Gate: OR-P06-LAST-GATE — RPC AUTH ONLY
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

    -- Client must not control completed_at
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RAISE EXCEPTION 'completed_at is strictly database-controlled';
    END IF;

    -- completed_at logic
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      NEW.completed_at = NOW();
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
         NEW.website_id IS DISTINCT FROM OLD.website_id OR
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
  v_brand_role TEXT;
  v_org_role TEXT;
BEGIN
  -- Check auth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Load roles
  SELECT role INTO v_brand_role FROM public.brand_members
  WHERE brand_id = p_brand_id AND user_id = auth.uid();
  
  SELECT role INTO v_org_role FROM public.organization_members
  WHERE organization_id = (SELECT organization_id FROM public.brands WHERE id = p_brand_id) AND user_id = auth.uid();

  -- Role check
  IF (v_brand_role IS NULL OR v_brand_role NOT IN ('strategist', 'writer')) AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Forbidden: Not authorized for this brand';
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

  -- Status logic
  IF v_opp.status IN ('dismissed', 'completed') THEN
    RAISE EXCEPTION 'Cannot handoff dismissed or completed opportunities';
  END IF;

  IF v_brand_role = 'writer' AND (v_org_role IS NULL OR v_org_role NOT IN ('owner', 'admin')) THEN
    IF v_opp.status NOT IN ('accepted', 'in_progress') THEN
      RAISE EXCEPTION 'Writer can only handoff accepted or in_progress opportunities';
    END IF;
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
