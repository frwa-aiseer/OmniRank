import { describe, it, expect, vi } from "vitest";

describe("OR-P07 — Research and Evidence Engine", () => {
  it("Brand/Org isolation enforced (migration check)", () => {
    const MIG_13 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
    const content = require("node:fs").readFileSync(MIG_13, "utf8");
    expect(content).toContain("Brand does not belong to the specified organization");
    expect(content).toContain("Child record tenant details must match parent project");
  });

  it("Opportunity → Research Project handoff is atomic and idempotent (migration check)", () => {
    const MIG_13 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
    const content = require("node:fs").readFileSync(MIG_13, "utf8");
    expect(content).toContain("handoff_opportunity_to_research(");
    expect(content).toContain("FOR UPDATE");
    expect(content).toContain("IF FOUND THEN"); // Idempotency check return
  });

  it("Role permissions verified in RPC (migration check)", () => {
    const MIG_13 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
    const content = require("node:fs").readFileSync(MIG_13, "utf8");
    expect(content).toContain("Forbidden: Not authorized for this brand");
    expect(content).toContain("authz.has_brand_role(brand_id, ARRAY['strategist','writer'])");
  });

  it("Source classifications match prompt constraints", () => {
    const MIG_13 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
    const content = require("node:fs").readFileSync(MIG_13, "utf8");
    expect(content).toContain("classification IN ('brand', 'primary', 'authoritative_external', 'competitor', 'search_result', 'weak')");
  });

  it("Finding support statuses match prompt constraints", () => {
    const MIG_13 = require("node:path").join(process.cwd(), "supabase/migrations/20260929000013_research_engine_schema.sql");
    const content = require("node:fs").readFileSync(MIG_13, "utf8");
    expect(content).toContain("support_status IN ('supported', 'partially_supported', 'unsupported', 'conflicting')");
  });
});
