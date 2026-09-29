import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BrandBrainIngestionService } from "../server/brand-brain/ingestion-service.ts";
import { SupabaseBrandBrainCoreRepository } from "../server/brand-brain/supabase-core-repo.ts";
import { SupabaseBrandBrainRepository } from "../server/brand-brain/repository.ts";
import * as supabaseClientModule from "../server/supabase/client.ts";
import * as envModule from "../server/env.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("OR-G04F — Final Pre-Deployment Database Integrity Gate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Valid UUID Primary Keys for Ingestion Entities", () => {
    it("should generate strictly valid UUIDs without prefixes for all persistent ingestion entities", async () => {
      const service = new BrandBrainIngestionService();
      vi.spyOn(service as any, "resolveTenantOrganization").mockResolvedValue({
        organizationId: "11111111-1111-4000-8000-111111111111",
        brand: {
          id: "22222222-2222-4000-8000-222222222222",
          organizationId: "11111111-1111-4000-8000-111111111111",
          name: "Acme UUID Test Brand"
        }
      });

      const result = await service.ingestContent(
        {
          brandId: "22222222-2222-4000-8000-222222222222",
          sourceType: "file_upload",
          sourceName: "UUID Validation Document",
          fileName: "validation.md",
          fileBufferOrText: "# Performance Report\nRevenue increased by 45% in Q3 according to official audit."
        },
        { id: "33333333-3333-4000-8000-333333333333", name: "Auditor" }
      );

      // Verify knowledge_sources.id
      expect(result.source.id).toMatch(UUID_REGEX);
      expect(result.source.id).not.toMatch(/^src-/);

      // Verify knowledge_documents.id
      expect(result.document.id).toMatch(UUID_REGEX);
      expect(result.document.id).not.toMatch(/^doc-/);

      // Verify knowledge_chunks.id
      expect(result.chunks.length).toBeGreaterThan(0);
      for (const chunk of result.chunks) {
        expect(chunk.id).toMatch(UUID_REGEX);
        expect(chunk.id).not.toMatch(/^chk-/);
      }

      // Verify evidence_sources.id and evidence_claims.id
      expect(result.evidenceClaims.length).toBeGreaterThan(0);
      for (const claim of result.evidenceClaims) {
        expect(claim.id).toMatch(UUID_REGEX);
        expect(claim.id).not.toMatch(/^clm-/);

        for (const src of claim.sources) {
          expect(src.id).toMatch(UUID_REGEX);
          expect(src.id).not.toMatch(/^cls-/);
          expect(src.sourceId).toMatch(UUID_REGEX);
          expect(src.sourceId).not.toMatch(/^evs-/);
        }
      }
    });
  });

  describe("2. Auth User Profile Backfill Migration", () => {
    it("should include safe backfill from auth.users into public.profiles with ON CONFLICT", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      expect(fs.existsSync(migPath)).toBe(true);

      const sqlContent = fs.readFileSync(migPath, "utf-8");
      expect(sqlContent).toContain("FROM auth.users");
      expect(sqlContent).toContain("INSERT INTO public.profiles (id, email, full_name, avatar_url)");
      expect(sqlContent).toContain("ON CONFLICT (id) DO UPDATE");
    });
  });

  describe("3. Force Atomic Organization Creation", () => {
    it("should remove direct authenticated INSERT policy from public.organizations", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      const sqlContent = fs.readFileSync(migPath, "utf-8");

      expect(sqlContent).toContain('DROP POLICY IF EXISTS "organizations_insert_canonical" ON public.organizations;');
      expect(sqlContent).toContain('DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;');
    });

    it("should retain public.create_organization_with_owner as the atomic creation RPC", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      const sqlContent = fs.readFileSync(migPath, "utf-8");

      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.create_organization_with_owner");
      expect(sqlContent).toContain("INSERT INTO public.organizations");
      expect(sqlContent).toContain("INSERT INTO public.organization_members");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) TO authenticated, service_role;");
    });
  });

  describe("4. Database-Authoritative Evidence Verification & Provenance", () => {
    it("should ensure Reviewers cannot directly update evidence_claims table but must use verify_evidence_claim RPC", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      const sqlContent = fs.readFileSync(migPath, "utf-8");

      // evidence_claims_update_canonical is restricted to Strategists
      expect(sqlContent).toContain("authz.has_brand_role(brand_id, ARRAY['strategist'])");

      // public.verify_evidence_claim RPC wrapper exists
      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.verify_evidence_claim");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.verify_evidence_claim(UUID, TEXT) TO authenticated, service_role;");
    });

    it("should call verify_evidence_claim RPC in repository updateClaimVerification", async () => {
      const repo = new SupabaseBrandBrainRepository("user-jwt-token");
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          id: "claim-uuid-01",
          brand_id: "brand-uuid-01",
          verification_status: "verified",
          verified_by: "auth-uid-reviewer",
        },
        error: null
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "claim-uuid-01",
                brand_id: "brand-uuid-01",
                organization_id: "org-uuid-01",
                claim_text: "RPC Verified Claim",
                claim_type: "statistic",
                verification_status: "verified",
                confidence_score: "0.95",
                verified_by: "auth-uid-reviewer",
                verified_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                evidence_claim_sources: []
              },
              error: null
            })
          })
        })
      });

      const mockClient: any = {
        rpc: mockRpc,
        from: vi.fn().mockReturnValue({ select: mockSelect })
      };
      (repo as any).client = mockClient;

      const result = await repo.updateClaimVerification("claim-uuid-01", "brand-uuid-01", "verified", "client-passed-user");
      expect(mockRpc).toHaveBeenCalledWith("verify_evidence_claim", {
        _claim_id: "claim-uuid-01",
        _new_status: "verified"
      });
      expect(result.verificationStatus).toBe("verified");
    });
  });

  describe("5. Generic Client Audit Fabrication Protection", () => {
    it("should revoke authenticated execution on authz.record_audit_event", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      const sqlContent = fs.readFileSync(migPath, "utf-8");

      expect(sqlContent).toContain("REVOKE ALL ON FUNCTION authz.record_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION authz.record_audit_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role");
    });
  });

  describe("6. Remove Blanket authz Schema Function Grants", () => {
    it("should revoke all blanket authz grants and grant only discrete necessary functions", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      const sqlContent = fs.readFileSync(migPath, "utf-8");

      expect(sqlContent).toContain("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA authz FROM PUBLIC, anon, authenticated;");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION authz.is_org_member(UUID) TO authenticated;");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION authz.can_view_brand(UUID) TO authenticated;");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION authz.has_brand_role(UUID, TEXT[]) TO authenticated;");
    });
  });

  describe("7. Clean Legacy Tenancy Validator Triggers & Functions", () => {
    it("should drop obsolete validate_tenant_brand_consistency and trg_validate_* triggers in migration 8", async () => {
      const migPath = path.resolve(process.cwd(), "supabase/migrations/20260929000008_predeployment_integrity.sql");
      const sqlContent = fs.readFileSync(migPath, "utf-8");

      expect(sqlContent).toContain("DROP TRIGGER IF EXISTS trg_validate_sources_tenant ON public.knowledge_sources;");
      expect(sqlContent).toContain("DROP TRIGGER IF EXISTS trg_validate_docs_tenant ON public.knowledge_documents;");
      expect(sqlContent).toContain("DROP TRIGGER IF EXISTS trg_validate_chunks_tenant ON public.knowledge_chunks;");
      expect(sqlContent).toContain("DROP TRIGGER IF EXISTS trg_validate_ev_sources_tenant ON public.evidence_sources;");
      expect(sqlContent).toContain("DROP TRIGGER IF EXISTS trg_validate_ev_claims_tenant ON public.evidence_claims;");
      expect(sqlContent).toContain("DROP FUNCTION IF EXISTS public.validate_tenant_brand_consistency() CASCADE;");
    });
  });

  describe("8. RLS Status Logic & No Process-Global Attestation", () => {
    it("should return 'RLS Configured' and not use a process-global boolean attestation", async () => {
      vi.spyOn(supabaseClientModule, "isLiveSupabaseConfigured").mockReturnValue(true);
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        DEMO_MODE: false,
        NODE_ENV: "production",
      } as any);

      const mockAdminClient: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "org-01" }],
              error: null,
            }),
          }),
        }),
      };
      vi.spyOn(supabaseClientModule, "getAdminSupabaseClient").mockReturnValue(mockAdminClient);

      const { tenancyRouter } = await import("../server/routes/tenancy.ts");
      const statusLayer = tenancyRouter.stack.find(
        (layer: any) => layer.route && layer.route.path === "/status"
      );
      expect(statusLayer).toBeDefined();

      const handler = statusLayer.route.stack[0].handle;
      const req: any = {
        securityContext: { isAuthenticated: true, userId: "usr-01", isServiceRole: false },
        token: "valid-token",
      };
      let jsonResponse: any = null;
      const res: any = {
        status: () => res,
        json: (data: any) => {
          jsonResponse = data;
          return res;
        },
      };

      await handler(req, res, () => {});
      expect(jsonResponse.rlsState).toBe("RLS Configured");
      expect(jsonResponse.liveDatabaseRlsVerified).toBeUndefined();
    });
  });

  describe("9. Brand Brain Core Repository Fail-Closed Security", () => {
    it("should strictly throw error when accessToken is missing in live mode instead of silently elevating to admin", async () => {
      vi.spyOn(supabaseClientModule, "isLiveSupabaseConfigured").mockReturnValue(true);

      const repo = new SupabaseBrandBrainCoreRepository();
      await expect(
        repo.getBrandBrain("brand-uuid-01", undefined)
      ).rejects.toThrow(/Missing user access token for live Brand Brain operation/);
    });

    it("should use user-scoped client when accessToken is provided", async () => {
      vi.spyOn(supabaseClientModule, "isLiveSupabaseConfigured").mockReturnValue(true);
      const scopedSpy = vi.spyOn(supabaseClientModule, "createScopedUserSupabaseClient");

      const repo = new SupabaseBrandBrainCoreRepository();
      try {
        await repo.getBrandBrain("brand-uuid-01", "valid-user-jwt");
      } catch {
        // Expected if client is not fully mocked
      }
      expect(scopedSpy).toHaveBeenCalledWith("valid-user-jwt");
    });
  });
});
