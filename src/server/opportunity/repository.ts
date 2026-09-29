import { SupabaseClient } from "@supabase/supabase-js";
import { Opportunity, OpportunityStatus } from "../../types/opportunity.ts";
import { getAdminSupabaseClient, createScopedUserSupabaseClient } from "../supabase/client.ts";

function mapRow(row: any): Opportunity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    websiteId: row.website_id ?? undefined,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: row.summary,
    rationale: row.rationale,
    priorityScore: row.priority_score,
    confidenceScore: row.confidence_score,
    effortScore: row.effort_score,
    impactScore: row.impact_score,
    sourceSignals: row.source_signals,
    targetKeyword: row.target_keyword ?? undefined,
    targetUrl: row.target_url ?? undefined,
    relatedArticleId: row.related_article_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dismissedAt: row.dismissed_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export class OpportunityRepository {
  constructor(private client: SupabaseClient) {}

  async listOpportunities(brandId: string, status?: OpportunityStatus): Promise<Opportunity[]> {
    let q = this.client.from("opportunities").select("*").eq("brand_id", brandId).order("priority_score", { ascending: false });
    if (status && status !== "all" as any) {
      q = q.eq("status", status);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  }

  async getOpportunity(id: string, brandId: string): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(data) : null;
  }

  async createOpportunity(opp: Omit<Opportunity, "id" | "createdAt" | "updatedAt">): Promise<Opportunity> {
    const { data, error } = await this.client.from("opportunities").insert({
      organization_id: opp.organizationId,
      brand_id: opp.brandId,
      website_id: opp.websiteId,
      type: opp.type,
      status: opp.status,
      title: opp.title,
      summary: opp.summary,
      rationale: opp.rationale,
      priority_score: opp.priorityScore,
      confidence_score: opp.confidenceScore,
      effort_score: opp.effortScore,
      impact_score: opp.impactScore,
      source_signals: opp.sourceSignals,
      target_keyword: opp.targetKeyword,
      target_url: opp.targetUrl,
      related_article_id: opp.relatedArticleId,
    }).select().single();
    
    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async updateStatus(id: string, brandId: string, status: OpportunityStatus, articleId?: string): Promise<Opportunity> {
    const updatePayload: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    if (status === 'dismissed') updatePayload.dismissed_at = new Date().toISOString();
    if (status === 'completed') updatePayload.completed_at = new Date().toISOString();
    if (articleId) updatePayload.related_article_id = articleId;

    const { data, error } = await this.client
      .from("opportunities")
      .update(updatePayload)
      .eq("id", id)
      .eq("brand_id", brandId)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    return mapRow(data);
  }
}

export function getOpportunityRepository(userToken?: string) {
  const client = userToken ? createScopedUserSupabaseClient(userToken) : getAdminSupabaseClient();
  return new OpportunityRepository(client);
}
