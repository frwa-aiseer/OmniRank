import { SupabaseClient } from "@supabase/supabase-js";
import { 
  ResearchProject, ResearchQuestion, ResearchSource, 
  ResearchFinding, ContentBrief 
} from "../../types/research.ts";

export class ResearchRepository {
  constructor(private client: SupabaseClient) {}

  // Projects
  async getProjects(brandId: string): Promise<ResearchProject[]> {
    const { data, error } = await this.client.from("research_projects").select("*").eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return data.map(this.mapProject);
  }

  async getProject(id: string, brandId: string): Promise<ResearchProject | null> {
    const { data, error } = await this.client.from("research_projects").select("*").eq("id", id).eq("brand_id", brandId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapProject(data) : null;
  }

  async handoffOpportunity(opportunityId: string, brandId: string): Promise<string> {
    const { data, error } = await this.client.rpc("handoff_opportunity_to_research", {
      p_opportunity_id: opportunityId,
      p_brand_id: brandId
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // Brief
  async getBriefForProject(projectId: string, brandId: string): Promise<ContentBrief | null> {
    const { data, error } = await this.client.from("content_briefs").select("*").eq("project_id", projectId).eq("brand_id", brandId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapBrief(data) : null;
  }

  private mapProject(row: any): ResearchProject {
    return {
      id: row.id,
      organizationId: row.organization_id,
      brandId: row.brand_id,
      opportunityId: row.opportunity_id ?? undefined,
      articleId: row.article_id ?? undefined,
      title: row.title,
      objective: row.objective,
      mode: row.mode,
      status: row.status,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapBrief(row: any): ContentBrief {
    return {
      id: row.id,
      projectId: row.project_id,
      organizationId: row.organization_id,
      brandId: row.brand_id,
      title: row.title,
      angle: row.angle,
      targetAudience: row.target_audience,
      searchIntent: row.search_intent,
      primaryObjective: row.primary_objective,
      targetKeyword: row.target_keyword ?? undefined,
      supportingKeywords: row.supporting_keywords ?? [],
      cta: row.cta ?? undefined,
      outline: row.outline ?? [],
      proposedTables: row.proposed_tables ?? [],
      proposedVisuals: row.proposed_visuals ?? [],
      faqIdeas: row.faq_ideas ?? [],
      sourceSelections: row.source_selections ?? [],
      unsupportedIssues: row.unsupported_issues ?? [],
      notes: row.notes ?? undefined,
      status: row.status,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export function getResearchRepository(client: SupabaseClient) {
  return new ResearchRepository(client);
}
