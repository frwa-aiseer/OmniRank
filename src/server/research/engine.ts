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
    const queries = [
      this.client.from("brand_profiles").select("description, tone_of_voice").eq("brand_id", brandId).maybeSingle(),
      this.client.from("brand_products").select("id").eq("brand_id", brandId),
      this.client.from("brand_audiences").select("title, description").eq("brand_id", brandId),
      this.client.from("brand_policies").select("id").eq("brand_id", brandId),
      this.client.from("brand_competitors").select("id").eq("brand_id", brandId),
      this.client.from("knowledge_sources").select("id").eq("brand_id", brandId),
      this.client.from("knowledge_documents").select("id").eq("brand_id", brandId),
      this.client.from("knowledge_chunks").select("id").eq("brand_id", brandId),
      this.client.from("evidence_sources").select("id").eq("brand_id", brandId),
      this.client.from("evidence_claims").select("id").eq("brand_id", brandId),
      this.client.from("articles").select("id").eq("brand_id", brandId),
    ];

    const results = await Promise.all(queries);
    for (const res of results) {
      if (res.error) throw new Error(`DB Error fetching context: ${res.error.message}`);
    }

    const brandProfiles = results[0].data;
    const brandAudiences = results[2].data as any[];

    // Apply budget limits
    const limitedSources = sources.slice(0, config.maxSources);
    const limitedQuestions = questions.slice(0, config.maxQuestions);
    
    // Extract supported findings for the outline
    const supportedFindings = findings.filter(f => f.supportStatus === 'supported' || f.supportStatus === 'partially_supported');
    let unsupportedFindings = findings.filter(f => f.supportStatus === 'unsupported' || f.supportStatus === 'conflicting');
    
    const unsupportedIssues = unsupportedFindings.map(f => f.findingText);

    // Deep mode: identify supported findings lacking multiple sources
    if (config.requireMultipleSources) {
      for (const f of supportedFindings) {
        if (!f.sourceReferences || f.sourceReferences.length < 2) {
          unsupportedIssues.push(`Insufficient multi-source support for finding: ${f.findingText}`);
        }
      }
    }

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
    
    // Explicitly do not fabricate unresolved elements. Add to unsupported issues instead.
    if (!targetAudience) {
      unsupportedIssues.push("Missing Target Audience");
    }
    if (!searchIntent) {
      unsupportedIssues.push("Missing Search Intent");
    }
    
    const selectedSourceIds = limitedSources.map(s => s.id);
    
    // 3. Save as Draft Brief
    const briefData: Partial<ContentBrief> = {
      title: project.title,
      angle: project.objective,
      targetAudience, // can be empty string
      searchIntent,   // can be empty string
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
