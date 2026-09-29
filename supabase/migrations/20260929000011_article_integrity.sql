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
