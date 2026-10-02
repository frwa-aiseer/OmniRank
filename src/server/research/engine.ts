import { SupabaseClient } from "@supabase/supabase-js";
import { getResearchRepository } from "./repository.ts";
import { ContentBrief, RESEARCH_MODE_CONFIGS, ResearchMode } from "../../types/research.ts";

export class ResearchEngine {
  constructor(private client: SupabaseClient) {}

  async prepareBrief(projectId: string, brandId: string, orgId: string): Promise<ContentBrief> {
    const repo = getResearchRepository(this.client);
    
    // 1. Fetch Research Context (No external API calls per prompt)
    const project = await repo.getProject(projectId, brandId);
    if (!project) throw new Error("Project not found");
    
    const config = RESEARCH_MODE_CONFIGS[project.mode as ResearchMode] || RESEARCH_MODE_CONFIGS.standard;
    
    const findings = await repo.listFindings(projectId, brandId);
    const questions = await repo.listQuestions(projectId, brandId);
    const sources = await repo.listSources(projectId, brandId);
    
    // 2. Fetch Brand Brain Context with bounds
    const [
      { data: brandProfiles, error: bpError },
      { data: brandAudiences, error: baError }
    ] = await Promise.all([
      this.client.from("brand_profiles").select("description, tone_of_voice").eq("brand_id", brandId).maybeSingle(),
      this.client.from("brand_audiences").select("title, description").eq("brand_id", brandId).limit(5)
    ]);
    
    if (bpError) throw new Error(`DB Error: ${bpError.message}`);
    if (baError) throw new Error(`DB Error: ${baError.message}`);

    // Apply budget limits
    const limitedSources = sources.slice(0, config.maxSources);
    const limitedQuestions = questions.slice(0, config.maxQuestions);
    
    // Extract supported findings for the outline
    const supportedFindings = findings.filter(f => f.supportStatus === 'supported' || f.supportStatus === 'partially_supported');
    let unsupportedFindings = findings.filter(f => f.supportStatus === 'unsupported' || f.supportStatus === 'conflicting');
    
    const outline = supportedFindings.map(f => ({
      heading: f.findingText,
      sources: f.sourceReferences
    }));
    
    let targetAudience = "";
    if (brandAudiences && brandAudiences.length > 0) {
      targetAudience = brandAudiences.map(a => a.title).join(", ");
    }
    
    let searchIntent = "";
    let targetKeyword = "";
    if (project.opportunityContext) {
      if (project.opportunityContext.target_keyword) {
        targetKeyword = project.opportunityContext.target_keyword;
      }
      if (project.opportunityContext.type) {
        if (project.opportunityContext.type === 'content_gap') searchIntent = "informational";
        if (project.opportunityContext.type === 'refresh_content') searchIntent = "navigational or informational";
      }
    }
    
    const unsupportedIssues = unsupportedFindings.map(f => f.findingText);
    
    // Explicitly do not fabricate unresolved elements. Add to unsupported issues instead.
    if (!targetAudience) {
      unsupportedIssues.push("Missing Target Audience");
    }
    if (!searchIntent) {
      unsupportedIssues.push("Missing Search Intent");
    }
    if (config.checkConflicts && unsupportedFindings.length > 0) {
      // Config requires us to surface conflicts explicitly, already added to unsupportedIssues
    }
    
    const selectedSourceIds = limitedSources.map(s => s.id);
    
    // 3. Save as Draft Brief
    const briefData: Partial<ContentBrief> = {
      title: project.title,
      angle: project.objective,
      targetAudience, // can be empty
      searchIntent,   // can be empty
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
