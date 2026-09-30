import { SupabaseClient } from "@supabase/supabase-js";
import { Opportunity, OpportunityType } from "../../types/opportunity.ts";
import { OpportunityRepository } from "./repository.ts";
import * as crypto from "crypto";

export class OpportunityEngine {
  constructor(private client: SupabaseClient, private repo: OpportunityRepository) {}

  private calculateOpportunityScore(impact: number, confidence: number, effort: number, brandRelevance: number, gapStrength: number): number {
    // 5-factor deterministic scoring: normalized 0-100
    // I (30%) + C (20%) + E_inv (20%) + BR (15%) + GS (15%)
    const score = (impact * 0.30) + (confidence * 0.20) + ((100 - effort) * 0.20) + (brandRelevance * 0.15) + (gapStrength * 0.15);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  public async generateOpportunities(brandId: string, organizationId: string): Promise<Opportunity[]> {
    const opportunities: Omit<Opportunity, "id" | "createdAt" | "updatedAt">[] = [];

    // Fetch Brand Data
    const { data: brand, error: brandError } = await this.client.from("brands").select("*").eq("id", brandId).single();
    if (brandError) throw new Error("Database read error: " + brandError.message);

    const { data: claims, error: claimsError } = await this.client
      .from("evidence_claims")
      .select("*")
      .eq("brand_id", brandId)
      .in("verification_status", ["unverified", "needs_review"]);
    if (claimsError) throw new Error("Database read error: " + claimsError.message);

    const { data: articles, error: articlesError } = await this.client.from("articles").select("*").eq("brand_id", brandId);
    if (articlesError) throw new Error("Database read error: " + articlesError.message);

    // 1. Evidence Gaps
    if (claims && claims.length > 0) {
      for (const claim of claims) {
        const impact = 80;
        const confidence = 90;
        const effort = 30; // easy to add evidence
        const brandRelevance = 100;
        const gapStrength = claim.verification_status === "unverified" ? 100 : 70;
        const priority = this.calculateOpportunityScore(impact, confidence, effort, brandRelevance, gapStrength);

        opportunities.push({
          organizationId,
          brandId,
          fingerprint: `evidence_gap:${claim.id}`,
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
            scoringBreakdown: { impact, confidence, effort, brandRelevance, gapStrength, calculation: "(I*0.3)+(C*0.2)+((100-E)*0.2)+(BR*0.15)+(GS*0.15)" }
          },
        });
      }
    }

    // 2. New Content from Brand Products/Audiences
    const { data: audiences, error: audiencesError } = await this.client.from("brand_audiences").select("*").eq("brand_id", brandId);
    if (audiencesError) throw new Error("Database read error: " + audiencesError.message);

    if (audiences && audiences.length > 0) {
      for (const aud of audiences) {
        const keyword = `${aud.name} solutions`;
        // Check if an article already exists for this keyword
        const exists = articles?.some(a => a.title.toLowerCase().includes(aud.name.toLowerCase()));
        if (!exists) {
          const impact = 70;
          const confidence = 75;
          const effort = 60;
          const brandRelevance = 95;
          const gapStrength = 85;
          const priority = this.calculateOpportunityScore(impact, confidence, effort, brandRelevance, gapStrength);

          opportunities.push({
            organizationId,
            brandId,
            fingerprint: `new_content:aud:${aud.id}`,
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
              scoringBreakdown: { impact, confidence, effort, brandRelevance, gapStrength, calculation: "(I*0.3)+(C*0.2)+((100-E)*0.2)+(BR*0.15)+(GS*0.15)" }
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
            const brandRelevance = 100;
            const gapStrength = 50;
            const priority = this.calculateOpportunityScore(impact, confidence, effort, brandRelevance, gapStrength);

            opportunities.push({
              organizationId,
              brandId,
              fingerprint: `refresh_content:art:${art.id}`,
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
                scoringBreakdown: { impact, confidence, effort, brandRelevance, gapStrength, calculation: "(I*0.3)+(C*0.2)+((100-E)*0.2)+(BR*0.15)+(GS*0.15)" }
              },
              relatedArticleId: art.id
            });
          }
        }
      }
    }

    const created: Opportunity[] = [];
    for (const opp of opportunities) {
      const newOpp = await this.repo.createOpportunity(opp);
      if (newOpp) {
        created.push(newOpp);
      }
    }

    return created;
  }
}

export function getOpportunityEngine(client: SupabaseClient) {
  return new OpportunityEngine(client, new OpportunityRepository(client));
}
