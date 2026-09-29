import { SupabaseClient } from "@supabase/supabase-js";
import { Opportunity, OpportunityType } from "../../types/opportunity.ts";
import { OpportunityRepository } from "./repository.ts";
import * as crypto from "crypto";

export class OpportunityEngine {
  constructor(private client: SupabaseClient, private repo: OpportunityRepository) {}

  public async generateOpportunities(brandId: string, organizationId: string): Promise<Opportunity[]> {
    const opportunities: Omit<Opportunity, "id" | "createdAt" | "updatedAt">[] = [];

    // Fetch Brand Data
    const { data: brand } = await this.client.from("brands").select("*").eq("id", brandId).single();
    const { data: claims } = await this.client.from("evidence_claims").select("*").eq("brand_id", brandId).eq("status", "needs_evidence");
    const { data: articles } = await this.client.from("articles").select("*").eq("brand_id", brandId);
    
    // 1. Evidence Gaps
    if (claims && claims.length > 0) {
      for (const claim of claims) {
        // Calculate deterministic score
        const impact = 80;
        const confidence = 90;
        const effort = 30; // easy to add evidence
        const priority = Math.round((impact * 0.5) + (confidence * 0.3) + ((100 - effort) * 0.2));

        opportunities.push({
          organizationId,
          brandId,
          type: "evidence_gap",
          status: "new",
          title: `Provide evidence for: ${claim.claim_text.substring(0, 50)}...`,
          summary: `Your brand claims "${claim.claim_text}" but lacks verified evidence.`,
          rationale: "Backing up claims with evidence builds trust and authority.",
          priorityScore: priority,
          confidenceScore: confidence,
          effortScore: effort,
          impactScore: impact,
          sourceSignals: {
            claimId: claim.id,
            claimText: claim.claim_text,
            scoringBreakdown: { impact, confidence, effort, calculation: "(I*0.5)+(C*0.3)+((100-E)*0.2)" }
          },
        });
      }
    }

    // 2. New Content from Brand Products/Audiences
    const { data: audiences } = await this.client.from("brand_audiences").select("*").eq("brand_id", brandId);
    if (audiences && audiences.length > 0) {
      for (const aud of audiences) {
        const keyword = `${aud.name} solutions`;
        // Check if an article already exists for this keyword
        const exists = articles?.some(a => a.title.toLowerCase().includes(aud.name.toLowerCase()));
        if (!exists) {
          const impact = 70;
          const confidence = 75;
          const effort = 60;
          const priority = Math.round((impact * 0.5) + (confidence * 0.3) + ((100 - effort) * 0.2));

          opportunities.push({
            organizationId,
            brandId,
            type: "new_content",
            status: "new",
            title: `Create content for audience: ${aud.name}`,
            summary: `Targeting your ${aud.name} audience segment.`,
            rationale: "You have identified this audience but have no dedicated content for them.",
            priorityScore: priority,
            confidenceScore: confidence,
            effortScore: effort,
            impactScore: impact,
            sourceSignals: {
              audienceId: aud.id,
              audienceName: aud.name,
              scoringBreakdown: { impact, confidence, effort, calculation: "(I*0.5)+(C*0.3)+((100-E)*0.2)" }
            },
            targetKeyword: keyword
          });
        }
      }
    }

    // 3. Content Refresh
    if (articles && articles.length > 0) {
      for (const art of articles) {
        if (art.status === 'refresh_recommended' || art.status === 'published') {
          // If published > 6 months ago (mocking with a deterministic check)
          const updated = new Date(art.updated_at);
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          
          if (art.status === 'refresh_recommended' || updated < sixMonthsAgo) {
            const impact = 60;
            const confidence = 85;
            const effort = 40;
            const priority = Math.round((impact * 0.5) + (confidence * 0.3) + ((100 - effort) * 0.2));

            opportunities.push({
              organizationId,
              brandId,
              type: "refresh_content",
              status: "new",
              title: `Refresh article: ${art.title}`,
              summary: `Update "${art.title}" to maintain relevance.`,
              rationale: "Content freshness is a ranking factor and prevents decay.",
              priorityScore: priority,
              confidenceScore: confidence,
              effortScore: effort,
              impactScore: impact,
              sourceSignals: {
                articleId: art.id,
                articleStatus: art.status,
                lastUpdated: art.updated_at,
                scoringBreakdown: { impact, confidence, effort, calculation: "(I*0.5)+(C*0.3)+((100-E)*0.2)" }
              },
              relatedArticleId: art.id
            });
          }
        }
      }
    }

    // Insert idempotently
    const { data: existingOpps } = await this.client.from("opportunities").select("title").eq("brand_id", brandId);
    const existingTitles = new Set((existingOpps || []).map(o => o.title));

    const created: Opportunity[] = [];
    for (const opp of opportunities) {
      if (!existingTitles.has(opp.title)) {
        const newOpp = await this.repo.createOpportunity(opp);
        created.push(newOpp);
        existingTitles.add(opp.title); // prevent duplicates within the same run
      }
    }

    return created;
  }
}

export function getOpportunityEngine(client: SupabaseClient) {
  return new OpportunityEngine(client, new OpportunityRepository(client));
}
