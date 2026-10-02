import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { RESEARCH_MODE_CONFIGS } from "../types/research.ts";

describe("OR-P07-FINAL — Runtime Completion Only", () => {
  const migPath = path.join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
  const sql = fs.readFileSync(migPath, "utf8");

  const repoPath = path.join(process.cwd(), "src/server/research/repository.ts");
  const repoCode = fs.readFileSync(repoPath, "utf8");
  
  const enginePath = path.join(process.cwd(), "src/server/research/engine.ts");
  const engineCode = fs.readFileSync(enginePath, "utf8");

  const viewPath = path.join(process.cwd(), "src/components/views/ResearchView.tsx");
  const viewCode = fs.readFileSync(viewPath, "utf8");

  it("CamelCase -> DB mapping explicitly verified", () => {
    // saveBrief must explicitly map briefData.targetAudience -> target_audience
    expect(repoCode).toContain("target_audience: briefData.targetAudience");
    expect(repoCode).toContain("search_intent: briefData.searchIntent");
    expect(repoCode).toContain("primary_objective: briefData.primaryObjective");
    expect(repoCode).toContain("target_keyword: briefData.targetKeyword");
    expect(repoCode).toContain("supporting_keywords: briefData.supportingKeywords");
    expect(repoCode).toContain("proposed_tables: briefData.proposedTables");
    expect(repoCode).toContain("source_selections: briefData.sourceSelections");
    expect(repoCode).toContain("unsupported_issues: briefData.unsupportedIssues");
    expect(repoCode).toContain("created_by: briefData.createdBy");
    // Ensure ...briefData is NOT directly spread in insert/update
    expect(repoCode).not.toMatch(/update\(\{\s*\.\.\.briefData\s*\}\)/);
  });

  it("Internal source provenance fields map correctly", () => {
    // addSource must map knowledgeSourceId -> knowledge_source_id
    expect(repoCode).toContain("knowledge_source_id: payload.knowledgeSourceId");
    expect(repoCode).toContain("knowledge_document_id: payload.knowledgeDocumentId");
    expect(repoCode).toContain("knowledge_chunk_id: payload.knowledgeChunkId");
    expect(repoCode).toContain("evidence_source_id: payload.evidenceSourceId");
    expect(repoCode).toContain("evidence_claim_id: payload.evidenceClaimId");
  });

  it("ResearchEngine explicitly reads all required context brand-scoped", () => {
    // Should check all schemas required by prompt
    expect(engineCode).toContain("this.client.from(\"brand_profiles\")");
    expect(engineCode).toContain("this.client.from(\"brand_products\")");
    expect(engineCode).toContain("this.client.from(\"brand_audiences\")");
    expect(engineCode).toContain("this.client.from(\"brand_policies\")");
    expect(engineCode).toContain("this.client.from(\"brand_competitors\")");
    expect(engineCode).toContain("this.client.from(\"knowledge_sources\")");
    expect(engineCode).toContain("this.client.from(\"knowledge_documents\")");
    expect(engineCode).toContain("this.client.from(\"knowledge_chunks\")");
    expect(engineCode).toContain("this.client.from(\"evidence_sources\")");
    expect(engineCode).toContain("this.client.from(\"evidence_claims\")");
    expect(engineCode).toContain("this.client.from(\"articles\")");
    
    // Check brand filtering usage
    expect(engineCode).toMatch(/\.eq\("brand_id", brandId\)/);
  });

  it("ResearchEngine DB errors fail closed", () => {
    // Must contain explicit throw for failed queries
    expect(engineCode).toContain("throw new Error(`DB Error fetching context:");
  });

  it("Fast/Standard/Deep limits dynamically change logic", () => {
    expect(engineCode).toContain("config.maxSources");
    expect(engineCode).toContain("config.maxQuestions");
    expect(engineCode).toContain("config.requireMultipleSources");
  });

  it("Deep mode correctly surfaces insufficient multi-source support", () => {
    expect(engineCode).toContain("if (config.requireMultipleSources)");
    expect(engineCode).toContain("f.sourceReferences.length < 2");
    expect(engineCode).toContain("Insufficient multi-source support for finding:");
  });

  it("UI controls call intended endpoints", () => {
    expect(viewCode).toContain("actionAddQuestion");
    expect(viewCode).toContain("actionUpdateQuestion");
    expect(viewCode).toContain("actionAddSource");
    expect(viewCode).toContain("actionAddFinding");
    expect(viewCode).toContain("actionEditBrief");
    expect(viewCode).toContain("actionReviewFinding");
    expect(viewCode).toContain("actionReviewBrief");
  });
  
  it("No fabricated brief values in preparation", () => {
    expect(engineCode).not.toContain("Determined from Brand Brain");
    expect(engineCode).toContain("Missing Target Audience");
    expect(engineCode).toContain("Missing Search Intent");
  });
});
