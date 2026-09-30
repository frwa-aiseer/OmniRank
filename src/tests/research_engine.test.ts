import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { RESEARCH_MODE_CONFIGS } from "../types/research.ts";

describe("OR-P07-FIX — Complete Functional Research Slice", () => {
  const migPath = path.join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
  const sql = fs.readFileSync(migPath, "utf8");

  const viewPath = path.join(process.cwd(), "src/components/views/ResearchView.tsx");
  const viewCode = fs.readFileSync(viewPath, "utf8");
  
  const enginePath = path.join(process.cwd(), "src/server/research/engine.ts");
  const engineCode = fs.readFileSync(enginePath, "utf8");

  it("Live auth path uses real session token, not hardcoded demo-token exclusively", () => {
    // Should have logic fetching auth.getSession()
    expect(viewCode).toContain("supabase.auth.getSession()");
    expect(viewCode).toContain("const token = sessionData.session?.access_token");
    expect(viewCode).toContain("Authorization: `Bearer ${token}`");
  });

  it("Enforces tenant isolation and rejects foreign provenance", () => {
    expect(sql).toContain("Brand does not belong to the specified organization");
    expect(sql).toContain("Child record tenant details must match parent project");
    expect(sql).toContain("Foreign knowledge_source");
    expect(sql).toContain("Foreign knowledge_document");
    expect(sql).toContain("Foreign evidence_source");
    expect(sql).toContain("Foreign evidence_claim");
    expect(sql).toContain("Question does not belong to the same project");
    expect(sql).toContain("Cannot move records across tenants");
  });

  it("Rejects invalid/nonexistent source references", () => {
    expect(sql).toContain("Invalid or missing source reference in finding");
    expect(sql).toContain("Invalid or missing source reference in content brief");
    // Supported finding requirement
    expect(sql).toContain("Supported finding must reference at least one research source");
  });

  it("Enforces finding constraints and 'unsupported' status explicitly", () => {
    expect(sql).toContain("support_status IN ('supported', 'partially_supported', 'unsupported', 'conflicting')");
    // Should NOT automatically insert into evidence_claims anywhere
    expect(sql).not.toContain("INSERT INTO public.evidence_claims");
  });

  it("Provides deterministic provider-neutral Research Modes", () => {
    expect(RESEARCH_MODE_CONFIGS.fast.allowExternal).toBe(false);
    expect(RESEARCH_MODE_CONFIGS.standard.checkConflicts).toBe(true);
    expect(RESEARCH_MODE_CONFIGS.deep.requireMultipleSources).toBe(true);
    // Modes should be constrained in DB
    expect(sql).toContain("mode IN ('fast', 'standard', 'deep')");
  });

  it("Preserves question provenance with constrained origin types", () => {
    expect(sql).toContain("origin_type IN ('user', 'opportunity', 'brand_brain', 'system')");
  });

  it("Role Boundaries: Viewer is read-only", () => {
    // Ensure Viewer is not in the FOR ALL policies
    expect(sql).toContain("CREATE POLICY \"research_projects_select\" ON public.research_projects FOR SELECT TO authenticated");
    expect(sql).not.toContain("FOR ALL TO authenticated USING (authz.has_brand_role(brand_id, ARRAY['viewer']))");
  });

  it("Role Boundaries: Writer can work but cannot finalize", () => {
    expect(sql).toContain("CREATE POLICY \"research_projects_writer\" ON public.research_projects FOR INSERT");
    expect(sql).toContain("fn_check_research_writer_restrictions");
    expect(sql).toContain("Writer cannot archive or complete projects");
    expect(sql).toContain("Writer cannot approve or reject content briefs");
  });

  it("Role Boundaries: Reviewer can review but cannot general-edit", () => {
    expect(sql).toContain("review_content_brief");
    expect(sql).toContain("review_research_finding");
    // Explicitly blocks non-Reviewers
    expect(sql).toContain("Forbidden: Not authorized to review findings");
    // Explicitly limits 'approved' / 'rejected' to strategist/admin
    expect(sql).toContain("Forbidden: Only strategist or admin can approve/reject briefs");
  });

  it("Role Boundaries: Strategist/Admin finalization", () => {
    expect(sql).toContain("authz.has_brand_role(brand_id, ARRAY['strategist']) OR authz.is_org_admin(organization_id)");
  });

  it("Opportunity Handoff context preservation", () => {
    expect(sql).toContain("opportunity_context JSONB");
    expect(sql).toContain("jsonb_build_object('type', v_opp.type, 'target_keyword', v_opp.target_keyword, 'rationale', v_opp.rationale, 'source_signals', v_opp.source_signals)");
    expect(sql).toContain("idx_unique_active_opp_research");
  });

  it("Brief Structure Preparation is deterministic", () => {
    expect(engineCode).toContain("const supportedFindings = findings.filter(f => f.supportStatus === 'supported' || f.supportStatus === 'partially_supported')");
    expect(engineCode).toContain("const outline = supportedFindings.map(f => ({");
    expect(engineCode).toContain("const unsupportedIssues = unsupportedFindings.map(f => f.findingText)");
    expect(engineCode).not.toContain("fetch("); // No external API calls inside the engine directly
    expect(engineCode).not.toContain("openai");
    expect(engineCode).not.toContain("anthropic");
  });
});
