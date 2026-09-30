import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpportunityEngine } from "../server/opportunity/engine.ts";
import { OpportunityRepository } from "../server/opportunity/repository.ts";
import { Opportunity } from "../types/opportunity.ts";

const MOCK_BRAND_ID = "00000000-0000-0000-0000-000000000000";
const MOCK_ORG_ID = "11111111-1111-1111-1111-111111111111";

describe("OR-P06-FIX — Opportunity Engine Fixes", () => {
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
          single: vi.fn().mockResolvedValue({ data: {} }),
          in: vi.fn().mockResolvedValue({ data: [] })
        })
      })
    });

    mockClient = {
      from: vi.fn().mockImplementation((table) => {
        if (table === "brands") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: MOCK_BRAND_ID } }) }) }) };
        }
        if (table === "evidence_claims") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [
            { id: "claim1", claim_text: "Our product is fast", brand_id: MOCK_BRAND_ID, verification_status: "unverified" }
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
        return { select: mockSelect };
      })
    };

    engine = new OpportunityEngine(mockClient, mockRepo as unknown as OpportunityRepository);
  });

  it("five-factor deterministic scoring, real schema, no fabricated signals", async () => {
    const opps = await engine.generateOpportunities(MOCK_BRAND_ID, MOCK_ORG_ID);
    expect(opps.length).toBeGreaterThan(0);
    
    const evidenceGap = opps.find(o => o.type === "evidence_gap");
    expect(evidenceGap).toBeDefined();
    
    // Impact(80*0.3)+Conf(90*0.2)+EffortInv((100-30)*0.2)+BR(100*0.15)+GS(100*0.15)
    // = 24 + 18 + 14 + 15 + 15 = 86
    expect(evidenceGap?.priorityScore).toBe(86);
    expect(evidenceGap?.sourceSignals.claimId).toBe("claim1");
    expect(evidenceGap?.fingerprint).toBe("evidence_gap:claim1");
  });

  it("DB read error fail-closed", async () => {
    mockClient.from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ error: { message: "Simulated Error" } }) }) })
    }));
    engine = new OpportunityEngine(mockClient, mockRepo as unknown as OpportunityRepository);
    await expect(engine.generateOpportunities(MOCK_BRAND_ID, MOCK_ORG_ID)).rejects.toThrow("Database read error: Simulated Error");
  });

  it("tenant/brand isolation enforced via DB constraints (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    // Checks for strict DB invariants
    expect(content).toContain("Brand does not belong to the specified organization");
    expect(content).toContain("Website does not belong to the specified brand");
    expect(content).toContain("Article does not belong to the specified brand");
  });

  it("Writer mutation restrictions (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("Writers cannot dismiss opportunities");
    expect(content).toContain("NEW.title IS DISTINCT FROM OLD.title");
    expect(content).toContain("Writers can only update status and related article");
    expect(content).toContain("organization_id cannot be modified");
    expect(content).toContain("brand_id cannot be modified");
  });
});
