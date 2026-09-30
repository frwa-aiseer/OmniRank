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
    expect(content).toContain("Writers cannot revive dismissed or completed opportunities");
    expect(content).toContain("NEW.title IS DISTINCT FROM OLD.title");
    expect(content).toContain("Writers can only update workflow status and related article");
    expect(content).toContain("organization_id cannot be modified");
    expect(content).toContain("brand_id cannot be modified");
  });
});

describe("OR-P06-PREDEPLOY — Final Auth + Handoff Fixes", () => {
  it("Writer cannot modify protected engine fields or revive dismissed/completed (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    
    expect(content).toContain("Writers cannot revive dismissed or completed opportunities");
    expect(content).toContain("Invalid workflow transition for writer");
    
    // Check fields protected
    const fields = ['fingerprint', 'type', 'title', 'summary', 'rationale', 'priority_score', 'confidence_score', 'effort_score', 'impact_score', 'source_signals', 'target_keyword', 'target_url', 'dismissed_at'];
    fields.forEach(f => {
      expect(content).toContain(`NEW.${f} IS DISTINCT FROM OLD.${f}`);
    });
  });

  it("Writer direct INSERT denied, Strategist/Admin generation allowed (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    
    expect(content).toContain('CREATE POLICY "opportunities_insert_strategist"');
    expect(content).toContain("authz.has_brand_role(brand_id, ARRAY['strategist'])");
    
  });

  it("Article handoff creates schemaVersion 1.0 atomically and idempotently (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    
    expect(content).toContain("handoff_opportunity_to_article(");
    expect(content).toContain("FOR UPDATE"); // locks row
    expect(content).toContain("schema_version");
    expect(content).toContain("'1.0'");
    expect(content).toContain("v_opp.related_article_id IS NOT NULL THEN"); // Idempotency
  });
});

describe("OR-P06-LAST-GATE — RPC AUTH ONLY", () => {
  it("Viewer handoff denied (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("v_brand_role NOT IN ('strategist', 'writer')");
    expect(content).toContain("Forbidden: Not authorized for this brand");
  });

  it("Writer accepted handoff allowed, new/dismissed/completed denied (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("Cannot handoff dismissed or completed opportunities");
    expect(content).toContain("Writer can only handoff accepted or in_progress opportunities");
  });

  it("Writer website_id mutation denied (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("NEW.website_id IS DISTINCT FROM OLD.website_id");
  });

  it("completed_at assigned by DB and client cannot control (migration check)", () => {
    const MIG_12 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000012_opportunities_schema.sql");
    const content = require("node:fs").readFileSync(MIG_12, "utf8");
    expect(content).toContain("completed_at is strictly database-controlled");
    expect(content).toContain("NEW.completed_at = NOW();");
  });
});
