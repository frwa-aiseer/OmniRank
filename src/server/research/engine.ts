import { SupabaseClient } from "@supabase/supabase-js";
import { getResearchRepository } from "./repository.ts";
import { ContentBrief } from "../../types/research.ts";

export class ResearchEngine {
  constructor(private client: SupabaseClient) {}

  async prepareBrief(projectId: string, brandId: string, orgId: string): Promise<ContentBrief> {
    const repo = getResearchRepository(this.client);
    
    // 1. Fetch Research Context (No external API calls per prompt)
    const project = await repo.getProject(projectId, brandId);
    if (!project) throw new Error("Project not found");
    
    const findings = await repo.listFindings(projectId, brandId);
    const questions = await repo.listQuestions(projectId, brandId);
    const sources = await repo.listSources(projectId, brandId);
    
    // 2. Deterministic Assembly (No AI)
    // Extract supported findings for the outline
    const supportedFindings = findings.filter(f => f.supportStatus === 'supported' || f.supportStatus === 'partially_supported');
    const unsupportedFindings = findings.filter(f => f.supportStatus === 'unsupported' || f.supportStatus === 'conflicting');
    
    const outline = supportedFindings.map(f => ({
      heading: f.findingText,
      sources: f.sourceReferences
    }));
    
    const unsupportedIssues = unsupportedFindings.map(f => f.findingText);
    const selectedSourceIds = sources.map(s => s.id);
    
    // Derive Target Keyword from Opportunity Context if available
    let targetKeyword = "";
    if (project.opportunityContext && project.opportunityContext.target_keyword) {
      targetKeyword = project.opportunityContext.target_keyword;
    }
    
    // 3. Save as Draft Brief
    const briefData: Partial<ContentBrief> = {
      title: project.title,
      angle: project.objective,
      targetAudience: "Determined from Brand Brain",
      searchIntent: "informational",
      primaryObjective: project.objective,
      targetKeyword,
      outline,
      unsupportedIssues,
      sourceSelections: selectedSourceIds,
      status: 'draft'
    };
    
    return await repo.saveBrief(projectId, brandId, orgId, briefData);
  }
}

export function getResearchEngine(client: SupabaseClient) {
  return new ResearchEngine(client);
}
