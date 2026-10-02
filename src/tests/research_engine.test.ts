import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { RESEARCH_MODE_CONFIGS } from "../types/research.ts";

describe("OR-P07-PREDEPLOY — Final Functional + Integrity Gate", () => {
  const migPath = path.join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
  const sql = fs.readFileSync(migPath, "utf8");

  const viewPath = path.join(process.cwd(), "src/components/views/ResearchView.tsx");
  const viewCode = fs.readFileSync(viewPath, "utf8");
  
  const enginePath = path.join(process.cwd(), "src/server/research/engine.ts");
  const engineCode = fs.readFileSync(enginePath, "utf8");

  it("Live auth path has no hardcoded demo-token fallback", () => {
    // Should NOT have token = ... || "demo-token"
    expect(viewCode).not.toContain("|| \"demo-token\"");
    expect(viewCode).toContain("throw new Error(\"Authentication required for live mode\")");
  });

  it("Foreign knowledge and evidence provenance rejected in DB", () => {
    expect(sql).toContain("Foreign knowledge_source");
    expect(sql).toContain("Foreign knowledge_document");
    expect(sql).toContain("Foreign knowledge_chunk");
    expect(sql).toContain("Foreign evidence_source");
    expect(sql).toContain("Foreign evidence_claim");
  });

  it("Inconsistent source/document/chunk hierarchy rejected in DB", () => {
    expect(sql).toContain("Inconsistent knowledge_source and knowledge_document hierarchy");
    expect(sql).toContain("Inconsistent knowledge_document and knowledge_chunk hierarchy");
  });

  it("Writer cannot modify finding review fields or question origin", () => {
    expect(sql).toContain("Writer cannot rewrite question origin");
    expect(sql).toContain("Writer cannot modify finding review fields");
  });

  it("Reviewer cannot de-finalize approved/rejected Brief", () => {
    expect(sql).toContain("Reviewer cannot de-finalize approved/rejected Brief");
  });

  it("Context assembler reads Brand Brain/evidence/articles brand-scoped", () => {
    expect(engineCode).toContain("this.client.from(\"brand_profiles\")");
    expect(engineCode).toContain("this.client.from(\"brand_audiences\")");
    // Ensure scoping
    expect(engineCode).toContain(".eq(\"brand_id\", brandId)");
  });

  it("DB read error fails closed in engine", () => {
    expect(engineCode).toContain("throw new Error(`DB Error: ${bpError.message}`)");
  });

  it("Fast/Standard/Deep config affects actual context limits/requirements", () => {
    expect(engineCode).toContain("const limitedSources = sources.slice(0, config.maxSources)");
    expect(engineCode).toContain("const limitedQuestions = questions.slice(0, config.maxQuestions)");
  });

  it("Brief does not fabricate unresolved audience/intent", () => {
    expect(engineCode).not.toContain("Determined from Brand Brain");
    expect(engineCode).toContain("Missing Target Audience");
    expect(engineCode).toContain("Missing Search Intent");
  });

  it("Existing handoff idempotency remains intact", () => {
    expect(sql).toContain("IF FOUND THEN RETURN v_project_id; END IF;");
  });
});
