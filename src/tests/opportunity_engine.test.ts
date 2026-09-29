import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpportunityEngine } from "../server/opportunity/engine.ts";
import { OpportunityRepository } from "../server/opportunity/repository.ts";
import { Opportunity } from "../types/opportunity.ts";

const MOCK_BRAND_ID = "00000000-0000-0000-0000-000000000000";
const MOCK_ORG_ID = "11111111-1111-1111-1111-111111111111";

describe("OR-P06 — Opportunity Engine", () => {
  let mockClient: any;
  let mockRepo: any;
  let engine: OpportunityEngine;

  beforeEach(() => {
    mockRepo = {
      createOpportunity: vi.fn().mockImplementation((opp) => Promise.resolve({ ...opp, id: "new-id" }))
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: {} }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {} })
        })
      })
    });

    mockClient = {
      from: vi.fn().mockImplementation((table) => {
        if (table === "brands") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: MOCK_BRAND_ID } }) }) }) };
        }
        if (table === "evidence_claims") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [
            { id: "claim1", claim_text: "Our product is fast", brand_id: MOCK_BRAND_ID, status: "needs_evidence" }
          ] }) }) }) };
        }
        if (table === "articles") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [
            { id: "art1", title: "Old Article", status: "published", updated_at: "2020-01-01T00:00:00Z" }
          ] }) }) };
        }
        if (table === "brand_audiences") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [
            { id: "aud1", name: "Developers", brand_id: MOCK_BRAND_ID }
          ] }) }) };
        }
        if (table === "opportunities") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
        }
        return { select: mockSelect };
      })
    };

    engine = new OpportunityEngine(mockClient, mockRepo as unknown as OpportunityRepository);
  });

  it("deterministic scoring & no fabricated signals", async () => {
    const opps = await engine.generateOpportunities(MOCK_BRAND_ID, MOCK_ORG_ID);
    expect(opps.length).toBeGreaterThan(0);
    
    const evidenceGap = opps.find(o => o.type === "evidence_gap");
    expect(evidenceGap).toBeDefined();
    
    // Deterministic priority score check: (80*0.5)+(90*0.3)+((100-30)*0.2) = 40 + 27 + 14 = 81
    expect(evidenceGap?.priorityScore).toBe(81);
    
    // No fabricated signals check: contains real claimId
    expect(evidenceGap?.sourceSignals.claimId).toBe("claim1");
  });

  it("duplicate suppression (idempotency)", async () => {
    mockClient.from = vi.fn().mockImplementation((table) => {
      // Mock existing opportunities to suppress creation
      if (table === "opportunities") {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [
          { title: "Provide evidence for: Our product is fast..." },
          { title: "Create content for audience: Developers" },
          { title: "Refresh article: Old Article" }
        ] }) }) };
      }
      // Return normal mock data for others
      if (table === "brands") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: MOCK_BRAND_ID } }) }) }) };
      if (table === "evidence_claims") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [ { id: "claim1", claim_text: "Our product is fast" } ] }) }) }) };
      if (table === "articles") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [ { id: "art1", title: "Old Article", status: "published", updated_at: "2020-01-01T00:00:00Z" } ] }) }) };
      if (table === "brand_audiences") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [ { id: "aud1", name: "Developers" } ] }) }) };
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {} }) }) }) };
    });

    engine = new OpportunityEngine(mockClient, mockRepo as unknown as OpportunityRepository);
    const opps = await engine.generateOpportunities(MOCK_BRAND_ID, MOCK_ORG_ID);
    
    // Should be 0 since all are duplicates
    expect(opps.length).toBe(0);
    expect(mockRepo.createOpportunity).not.toHaveBeenCalled();
  });
  
  it("tenant/brand isolation enforced via RLS (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("authz.can_view_brand(brand_id)");
    expect(content).toContain("organization_id UUID NOT NULL REFERENCES public.organizations(id)");
  });

  it("role restrictions (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("Writers cannot dismiss opportunities");
  });
});
