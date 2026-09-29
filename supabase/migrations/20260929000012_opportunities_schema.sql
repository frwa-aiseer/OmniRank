-- ============================================================================
-- Migration: 20260929000012_opportunities_schema.sql
-- Gate: OR-P06 — Opportunity Engine V1
-- Description: Tenant-scoped opportunities for content/evidence gaps.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  
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
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opportunities_brand_status ON public.opportunities(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON public.opportunities(brand_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON public.opportunities(brand_id, type);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- SELECT: any brand member can read their brand's opportunities
CREATE POLICY "opportunities_select_brand_member" ON public.opportunities
  FOR SELECT TO authenticated
  USING (authz.can_view_brand(brand_id));

-- INSERT: engine inserts are usually via service role, but if triggered via RPC/user, writers can create
CREATE POLICY "opportunities_insert_writer" ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    authz.has_brand_role(brand_id, ARRAY['strategist','writer'])
    OR authz.is_org_admin(organization_id)
  );

-- UPDATE:
-- Writers can accept/work (move to accepted/in_progress/completed)
-- Strategists/Admins can do everything (including dismiss)
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
    -- Writer cannot dismiss
    IF NEW.status = 'dismissed' THEN
      RAISE EXCEPTION 'Writers cannot dismiss opportunities';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized to update opportunities';
END;
$$;

CREATE TRIGGER trg_opportunities_update_auth
  BEFORE UPDATE ON public.opportunities
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
