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
      this.client.from("brand_profiles").select("mission, positioning_statement, target_market, value_proposition, tone_keywords").eq("brand_id", brandId).maybeSingle(),
      this.client.from("brand_products").select("name, category, value_proposition, key_features, target_audience, status").eq("brand_id", brandId),
      this.client.from("brand_audiences").select("name, job_title, pain_points, goals, objections, preferred_channels, status").eq("brand_id", brandId),
      this.client.from("brand_policies").select("title, description, category, severity, enforcement_action, status").eq("brand_id", brandId),
      this.client.from("brand_competitors").select("name, domain, positioning, key_strengths, key_weaknesses, differentiator, notes, status").eq("brand_id", brandId),
      this.client.from("knowledge_sources").select("id, title, url, status").eq("brand_id", brandId),
      this.client.from("knowledge_documents").select("id, title, url, status").eq("brand_id", brandId),
      this.client.from("knowledge_chunks").select("id, content").eq("brand_id", brandId),
      this.client.from("evidence_sources").select("id, title, url, status").eq("brand_id", brandId),
      this.client.from("evidence_claims").select("id, claim_text, verification_status").eq("brand_id", brandId),
      this.client.from("articles").select("id, title, status").eq("brand_id", brandId),
    ];

    const results = await Promise.all(queries);
    for (const res of results) {
      if (res.error) throw new Error(`DB Error fetching context: ${res.error.message}`);
    }

    const brandAudiences = results[2].data as any[];

    // Apply configuration filtering
    let allowedSources = sources;
    if (config.allowExternal === false) {
       allowedSources = sources.filter(s => 
          s.classification !== 'search_result' && 
          s.classification !== 'competitor' && 
          s.classification !== 'weak' && 
          s.classification !== 'authoritative_external'
       );
    }

    // Apply budget limits
    const limitedSources = allowedSources.slice(0, config.maxSources);
    const limitedQuestions = questions.slice(0, config.maxQuestions);
    
    // Extract supported findings for the outline
    const supportedFindings = findings.filter(f => f.supportStatus === 'supported' || f.supportStatus === 'partially_supported');
    const unsupportedFindings = findings.filter(f => f.supportStatus === 'unsupported' || f.supportStatus === 'conflicting');
    
    const unsupportedIssues = unsupportedFindings.map(f => f.findingText);

    // Deep mode: identify supported findings lacking multiple sources
    if (config.requireMultipleSources) {
      for (const f of supportedFindings) {
        if (!f.sourceReferences || f.sourceReferences.length < 2) {
          unsupportedIssues.push(`Insufficient multi-source support for finding: ${f.findingText}`);
        }
      }
    }

    // Standard mode: surface conflicts explicitly
    if (config.checkConflicts) {
       const conflictingFindings = findings.filter(f => f.supportStatus === 'conflicting');
       conflictingFindings.forEach(f => {
          const msg = `Conflicting finding: ${f.findingText}`;
          if (!unsupportedIssues.includes(msg)) {
              unsupportedIssues.push(msg);
          }
       });
    }

    // Ensure limitedQuestions affects output: Unresolved limited questions surface as open issues
    for (const q of limitedQuestions) {
        const isAnswered = supportedFindings.some(f => f.questionId === q.id);
        if (!isAnswered) {
            unsupportedIssues.push(`Unanswered question: ${q.questionText}`);
        }
    }
    
    const outline = supportedFindings.map(f => ({
      heading: f.findingText,
      sources: f.sourceReferences
    }));
    
    let targetAudience = "";
    if (brandAudiences && brandAudiences.length > 0) {
      targetAudience = brandAudiences.map(a => a.name).join(", "); // use brand_audiences.name
    }
    
    let searchIntent = "";
    let targetKeyword = "";
    
    if (project.opportunityContext && project.opportunityContext.target_keyword) {
      targetKeyword = project.opportunityContext.target_keyword;
    }
    
    // Check if finding explicitly declares search intent, else missing.
    const explicitIntentFinding = supportedFindings.find(f => f.findingText.toLowerCase().includes("search intent:"));
    if (explicitIntentFinding) {
       searchIntent = explicitIntentFinding.findingText.split(":")[1]?.trim() || "";
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
