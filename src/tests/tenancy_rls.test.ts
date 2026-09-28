import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { TenancyRepository, SecurityContext, TenancyAuthorizationError } from "../server/auth/tenancy.ts";
import { SupabaseTenancyRepository } from "../server/auth/supabase-tenancy.ts";

describe("OR-P02 Authentication, Tenancy and RLS Tests", () => {
  let repo: TenancyRepository;

  // Test Entities
  const userAlphaId = "aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa";
  const userBetaId = "bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb";
  const userGammaId = "cccccccc-cccc-4000-8000-cccccccccccc"; // Cross-tenant user
  const unassignedUserId = "dddddddd-dddd-4000-8000-dddddddddddd"; // User without any org

  const anonContext: SecurityContext = { isAuthenticated: false };
  const userAlphaContext: SecurityContext = { userId: userAlphaId, isAuthenticated: true };
  const userBetaContext: SecurityContext = { userId: userBetaId, isAuthenticated: true };
  const userGammaContext: SecurityContext = { userId: userGammaId, isAuthenticated: true };
  const unassignedContext: SecurityContext = { userId: unassignedUserId, isAuthenticated: true };
  const serviceRoleContext: SecurityContext = { isServiceRole: true, isAuthenticated: true };

  beforeEach(() => {
    repo = new TenancyRepository();

    // 1. Create Profile Alpha (will be Org A Owner)
    repo.createProfile(serviceRoleContext, {
      id: userAlphaId,
      email: "alpha@orga.com",
      fullName: "Alpha Owner",
    });

    // 2. Create Profile Beta (will be Org A Member & Brand Writer)
    repo.createProfile(serviceRoleContext, {
      id: userBetaId,
      email: "beta@orga.com",
      fullName: "Beta Writer",
    });

    // 3. Create Profile Gamma (will be Org B Owner)
    repo.createProfile(serviceRoleContext, {
      id: userGammaId,
      email: "gamma@orgb.com",
      fullName: "Gamma Competitor",
    });

    // 4. Create Profile Unassigned
    repo.createProfile(serviceRoleContext, {
      id: unassignedUserId,
      email: "unassigned@nowhere.com",
      fullName: "Unassigned User",
    });
  });

  it("should create organizations with UUIDs and automatically assign the creator as Owner", () => {
    const { org, member } = repo.createOrganization(userAlphaContext, "Alpha Corp", "alpha-corp");

    expect(org.id).toBeDefined();
    expect(org.slug).toBe("alpha-corp");
    expect(org.createdBy).toBe(userAlphaId);

    expect(member.organizationId).toBe(org.id);
    expect(member.userId).toBe(userAlphaId);
    expect(member.role).toBe("owner");
    expect(repo.isOrgAdmin(org.id, userAlphaId)).toBe(true);
  });

  it("should enforce RLS: Anonymous users cannot read or mutate organizations", () => {
    expect(() => {
      repo.getOrganizationsForUser(anonContext);
    }).toThrow(TenancyAuthorizationError);

    expect(() => {
      repo.createOrganization(anonContext, "Hacker Org", "hacker-org");
    }).toThrow(TenancyAuthorizationError);
  });

  it("should enforce multi-tenant isolation: Users cannot view or mutate organizations they do not belong to", () => {
    const { org: orgA } = repo.createOrganization(userAlphaContext, "Organization Alpha", "org-alpha");
    const { org: orgB } = repo.createOrganization(userGammaContext, "Organization Gamma", "org-gamma");

    // Alpha lists their orgs -> sees Org A only
    const alphaOrgs = repo.getOrganizationsForUser(userAlphaContext);
    expect(alphaOrgs.map((o) => o.id)).toContain(orgA.id);
    expect(alphaOrgs.map((o) => o.id)).not.toContain(orgB.id);

    // Gamma lists their orgs -> sees Org B only
    const gammaOrgs = repo.getOrganizationsForUser(userGammaContext);
    expect(gammaOrgs.map((o) => o.id)).toContain(orgB.id);
    expect(gammaOrgs.map((o) => o.id)).not.toContain(orgA.id);

    // Unassigned user lists orgs -> empty list
    const unassignedOrgs = repo.getOrganizationsForUser(unassignedContext);
    expect(unassignedOrgs).toHaveLength(0);

    // Gamma cannot update Org A
    expect(() => {
      repo.updateOrganization(userGammaContext, orgA.id, { name: "Malicious Tamper" });
    }).toThrow(TenancyAuthorizationError);
  });

  it("should enforce Organization Role hierarchy (Owner/Admin vs Member)", () => {
    const { org } = repo.createOrganization(userAlphaContext, "Tech Media Org", "tech-media-org");

    // Alpha (Owner) adds Beta as regular 'member'
    const memberBeta = repo.addOrganizationMember(userAlphaContext, org.id, userBetaId, "member");
    expect(memberBeta.role).toBe("member");
    expect(repo.isOrgMember(org.id, userBetaId)).toBe(true);
    expect(repo.isOrgAdmin(org.id, userBetaId)).toBe(false);

    // Beta (regular member) CANNOT invite other members
    expect(() => {
      repo.addOrganizationMember(userBetaContext, org.id, unassignedUserId, "member");
    }).toThrow(TenancyAuthorizationError);

    // Beta (regular member) CANNOT create brands
    expect(() => {
      repo.createBrand(userBetaContext, org.id, "Unauthorized Brand", "unauth-brand", "unauth.com");
    }).toThrow(TenancyAuthorizationError);

    // Alpha (Owner) CAN create brands
    const brand = repo.createBrand(userAlphaContext, org.id, "TechPulse Brand", "tech-pulse", "techpulse.io", "Technology");
    expect(brand.id).toBeDefined();
    expect(brand.organizationId).toBe(org.id);
  });

  it("should enforce Brand Role hierarchy (Strategist vs Writer/Reviewer/Viewer)", () => {
    const { org } = repo.createOrganization(userAlphaContext, "Media Studio", "media-studio");
    const brand = repo.createBrand(userAlphaContext, org.id, "Pulse Daily", "pulse-daily", "pulsedaily.com");

    // Add Beta as a 'writer' on Pulse Daily
    repo.addOrganizationMember(userAlphaContext, org.id, userBetaId, "member");
    repo.addBrandMember(userAlphaContext, brand.id, userBetaId, "writer");

    expect(repo.isBrandMember(brand.id, userBetaId)).toBe(true);
    expect(repo.getBrandRole(brand.id, userBetaId)).toBe("writer");

    // Writer CANNOT register websites
    expect(() => {
      repo.createWebsite(userBetaContext, brand.id, "newsite.com");
    }).toThrow(TenancyAuthorizationError);

    // Writer CANNOT add members to brand
    expect(() => {
      repo.addBrandMember(userBetaContext, brand.id, unassignedUserId, "viewer");
    }).toThrow(TenancyAuthorizationError);

    // Strategist (Alpha) CAN register websites
    const website = repo.createWebsite(userAlphaContext, brand.id, "pulsedaily.com", "https://pulsedaily.com/sitemap.xml");
    expect(website.id).toBeDefined();
    expect(website.brandId).toBe(brand.id);
    expect(website.status).toBe("active");
  });

  it("should strictly isolate brand websites between tenants", () => {
    const { org: orgA } = repo.createOrganization(userAlphaContext, "Tenant A", "tenant-a");
    const brandA = repo.createBrand(userAlphaContext, orgA.id, "Brand Alpha", "brand-a", "branda.com");
    repo.createWebsite(userAlphaContext, brandA.id, "branda.com");

    const { org: orgB } = repo.createOrganization(userGammaContext, "Tenant B", "tenant-b");
    const brandB = repo.createBrand(userGammaContext, orgB.id, "Brand Gamma", "brand-b", "brandb.com");

    // Tenant B cannot view Tenant A's websites
    expect(() => {
      repo.getWebsites(userGammaContext, brandA.id);
    }).toThrow(TenancyAuthorizationError);

    // Tenant A cannot view Tenant B's websites
    expect(() => {
      repo.getWebsites(userAlphaContext, brandB.id);
    }).toThrow(TenancyAuthorizationError);
  });

  it("should prevent unauthorized profile access across organizations", () => {
    // User Alpha and Gamma are in separate orgs
    expect(() => {
      repo.getProfile(userGammaContext, userAlphaId);
    }).toThrow(TenancyAuthorizationError);

    // User Alpha can read own profile
    const alphaProfile = repo.getProfile(userAlphaContext, userAlphaId);
    expect(alphaProfile?.email).toBe("alpha@orga.com");
  });

  it("should enforce Agency Isolation: Normal members see only assigned brands; Admins see all org brands", () => {
    const { org } = repo.createOrganization(userAlphaContext, "Agency Corp", "agency-corp");
    const brand1 = repo.createBrand(userAlphaContext, org.id, "Client Alpha", "client-alpha", "alpha.com");
    const brand2 = repo.createBrand(userAlphaContext, org.id, "Client Beta", "client-beta", "beta.com");

    // Add Beta as normal member in the org
    repo.addOrganizationMember(userAlphaContext, org.id, userBetaId, "member");

    // Before assignment, Beta sees 0 brands
    const betaBrandsInitial = repo.getBrands(userBetaContext, org.id);
    expect(betaBrandsInitial).toHaveLength(0);

    // Alpha (Owner) sees both brands
    const alphaBrands = repo.getBrands(userAlphaContext, org.id);
    expect(alphaBrands).toHaveLength(2);

    // Assign Beta to Client Alpha only
    repo.addBrandMember(userAlphaContext, brand1.id, userBetaId, "writer");

    // Beta now sees Client Alpha, but NOT Client Beta
    const betaBrandsAfter = repo.getBrands(userBetaContext, org.id);
    expect(betaBrandsAfter).toHaveLength(1);
    expect(betaBrandsAfter[0].id).toBe(brand1.id);
  });

  it("should prevent normal members from enumerating all organization users", () => {
    const { org } = repo.createOrganization(userAlphaContext, "Large Agency", "large-agency");
    const brand1 = repo.createBrand(userAlphaContext, org.id, "Brand 1", "brand-1", "b1.com");

    // Add Beta (member) and Gamma (member)
    repo.addOrganizationMember(userAlphaContext, org.id, userBetaId, "member");
    repo.addOrganizationMember(userAlphaContext, org.id, userGammaId, "member");

    // Assign Beta to Brand 1 only; Gamma is unassigned or assigned elsewhere
    repo.addBrandMember(userAlphaContext, brand1.id, userBetaId, "writer");

    // Alpha (Owner) sees all 3 members (Alpha, Beta, Gamma)
    const alphaMembers = repo.getOrganizationMembers(userAlphaContext, org.id);
    expect(alphaMembers).toHaveLength(3);

    // Beta (normal member) cannot see Gamma because they do not share any assigned brand
    const betaMembers = repo.getOrganizationMembers(userBetaContext, org.id);
    const betaSeenUserIds = betaMembers.map((m) => m.userId);
    expect(betaSeenUserIds).toContain(userBetaId);
    expect(betaSeenUserIds).toContain(userAlphaId); // Shares Brand 1 with Alpha
    expect(betaSeenUserIds).not.toContain(userGammaId); // Gamma is isolated!
  });

  it("should enforce Role Authority: Admin cannot demote/remove Owner, and Brand Strategist cannot manage brand members", () => {
    const { org } = repo.createOrganization(userAlphaContext, "Protected Org", "protected-org");
    const brand = repo.createBrand(userAlphaContext, org.id, "Protected Brand", "protected-brand", "prot.com");

    // Add Beta as Admin
    const adminMember = repo.addOrganizationMember(userAlphaContext, org.id, userBetaId, "admin");
    const ownerMember = repo.getOrganizationMembers(userAlphaContext, org.id).find((m) => m.userId === userAlphaId)!;

    // Beta (Admin) CANNOT remove Alpha (Owner)
    expect(() => {
      repo.removeOrganizationMember(userBetaContext, org.id, ownerMember.id);
    }).toThrow(TenancyAuthorizationError);

    // Beta (Admin) CANNOT demote Alpha (Owner)
    expect(() => {
      repo.updateOrganizationMember(userBetaContext, org.id, ownerMember.id, "member");
    }).toThrow(TenancyAuthorizationError);

    // Beta (Admin) CANNOT promote themselves to Owner
    expect(() => {
      repo.updateOrganizationMember(userBetaContext, org.id, adminMember.id, "owner");
    }).toThrow(TenancyAuthorizationError);

    // Add Gamma as Brand Strategist
    repo.addOrganizationMember(userAlphaContext, org.id, userGammaId, "member");
    repo.addBrandMember(userAlphaContext, brand.id, userGammaId, "strategist");

    // Gamma (Brand Strategist) CANNOT add brand members (Only Org Owner/Admin can)
    expect(() => {
      repo.addBrandMember(userGammaContext, brand.id, unassignedUserId, "writer");
    }).toThrow(TenancyAuthorizationError);
  });

  it("should enforce Supabase SECURITY DEFINER hardening guidelines across SQL migrations", () => {
    // Read both SQL migration files
    const migration1 = path.resolve(process.cwd(), "supabase/migrations/20260916000001_auth_tenancy_rls.sql");
    const migration4 = path.resolve(process.cwd(), "supabase/migrations/20260917000004_hardened_auth_tenancy_rls.sql");
    const migration5 = path.resolve(process.cwd(), "supabase/migrations/20260918000005_hardened_ingestion_tenancy.sql");

    for (const migrationFile of [migration1, migration4, migration5]) {
      const content = fs.readFileSync(migrationFile, "utf-8");

      // Extract all SECURITY DEFINER blocks
      const securityDefinerMatches = content.match(/SECURITY\s+DEFINER[\s\S]*?AS\s+\$\$/gi) || [];
      expect(securityDefinerMatches.length).toBeGreaterThan(0);

      for (const block of securityDefinerMatches) {
        // Must explicitly set search_path to empty string: SET search_path = ''
        expect(block).toMatch(/SET\s+search_path\s*=\s*''/i);
        // Must NOT set search_path = public
        expect(block).not.toMatch(/SET\s+search_path\s*=\s*public/i);
      }
    }
  });

  it("should prove SupabaseTenancyRepository correctly calls create_organization_with_owner RPC with (_name, _slug) and consumes nested organization & member response", async () => {
    const supabaseTenancy = new SupabaseTenancyRepository();
    let rpcMethodCalled = "";
    let rpcArgsPassed: Record<string, unknown> | null = null;

    const mockOrgId = "11111111-1111-4000-8000-111111111111";
    const mockMemberId = "22222222-2222-4000-8000-222222222222";
    const mockUserId = "aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa";

    const mockClient: any = {
      rpc: async (method: string, args: Record<string, unknown>) => {
        rpcMethodCalled = method;
        rpcArgsPassed = args;
        return {
          data: {
            organization: {
              id: mockOrgId,
              name: args._name,
              slug: args._slug,
              created_by: mockUserId,
              created_at: "2026-09-18T12:00:00.000Z",
              updated_at: "2026-09-18T12:00:00.000Z",
            },
            member: {
              id: mockMemberId,
              organization_id: mockOrgId,
              user_id: mockUserId,
              role: "owner",
              created_at: "2026-09-18T12:00:00.000Z",
            },
          },
          error: null,
        };
      },
    };

    (supabaseTenancy as any).getClient = () => mockClient;

    const result = await supabaseTenancy.createOrganization("Omni Enterprise", "omni-enterprise", mockUserId);

    // 1. Verify RPC name and exact canonical argument contract (_name, _slug)
    expect(rpcMethodCalled).toBe("create_organization_with_owner");
    expect(rpcArgsPassed).toEqual({
      _name: "Omni Enterprise",
      _slug: "omni-enterprise",
    });

    // 2. Verify properly mapped Organization entity
    expect(result.org.id).toBe(mockOrgId);
    expect(result.org.name).toBe("Omni Enterprise");
    expect(result.org.slug).toBe("omni-enterprise");
    expect(result.org.createdBy).toBe(mockUserId);
    expect(result.org.createdAt).toBe("2026-09-18T12:00:00.000Z");

    // 3. Verify properly mapped OrganizationMember entity
    expect(result.member.id).toBe(mockMemberId);
    expect(result.member.organizationId).toBe(mockOrgId);
    expect(result.member.userId).toBe(mockUserId);
    expect(result.member.role).toBe("owner");
    expect(result.member.createdAt).toBe("2026-09-18T12:00:00.000Z");
  });

  it("should handle error when create_organization_with_owner RPC encounters database failure", async () => {
    const supabaseTenancy = new SupabaseTenancyRepository();
    const mockClient: any = {
      rpc: async () => {
        return {
          data: null,
          error: { message: "duplicate key value violates unique constraint" },
        };
      },
    };

    (supabaseTenancy as any).getClient = () => mockClient;

    await expect(
      supabaseTenancy.createOrganization("Duplicate Org", "duplicate-org", userAlphaId)
    ).rejects.toThrow("[Supabase Tenancy] create_organization_with_owner RPC failed: duplicate key value violates unique constraint");
  });

  describe("Real Live Role Resolution & Brand Access (Owner, Admin, Strategist, Writer, Reviewer, Viewer, Unassigned)", () => {
    const orgId = "11111111-1111-4000-8000-111111111111";
    const brandId = "22222222-2222-4000-8000-222222222222";

    const ownerUserId = "user-owner-001";
    const adminUserId = "user-admin-002";
    const strategistUserId = "user-strategist-003";
    const writerUserId = "user-writer-004";
    const reviewerUserId = "user-reviewer-005";
    const viewerUserId = "user-viewer-006";
    const orgMemberOnlyUserId = "user-member-unassigned-007";
    const completelyUnassignedUserId = "user-unassigned-999";

    // Setup mock Supabase tables
    function createMockSupabaseClient() {
      const orgMembersTable = [
        { organization_id: orgId, user_id: ownerUserId, role: "owner" },
        { organization_id: orgId, user_id: adminUserId, role: "admin" },
        { organization_id: orgId, user_id: strategistUserId, role: "member" },
        { organization_id: orgId, user_id: writerUserId, role: "member" },
        { organization_id: orgId, user_id: reviewerUserId, role: "member" },
        { organization_id: orgId, user_id: viewerUserId, role: "member" },
        { organization_id: orgId, user_id: orgMemberOnlyUserId, role: "member" },
      ];

      const brandMembersTable = [
        { brand_id: brandId, user_id: strategistUserId, role: "strategist" },
        { brand_id: brandId, user_id: writerUserId, role: "writer" },
        { brand_id: brandId, user_id: reviewerUserId, role: "reviewer" },
        { brand_id: brandId, user_id: viewerUserId, role: "viewer" },
        // Notice: Owner and Admin DO NOT have explicit brand_members rows!
      ];

      const brandsTable = [
        { id: brandId, organization_id: orgId, name: "Omni Test Brand" },
      ];

      return {
        from: (table: string) => {
          let filters: Record<string, any> = {};
          const queryBuilder: any = {
            select: () => queryBuilder,
            eq: (col: string, val: any) => {
              filters[col] = val;
              return queryBuilder;
            },
            maybeSingle: async () => {
              if (table === "brands") {
                const found = brandsTable.find((b) => !filters.id || b.id === filters.id);
                return { data: found || null, error: null };
              }
              if (table === "organization_members") {
                const found = orgMembersTable.find(
                  (om) =>
                    (!filters.organization_id || om.organization_id === filters.organization_id) &&
                    (!filters.user_id || om.user_id === filters.user_id)
                );
                return { data: found || null, error: null };
              }
              if (table === "brand_members") {
                const found = brandMembersTable.find(
                  (bm) =>
                    (!filters.brand_id || bm.brand_id === filters.brand_id) &&
                    (!filters.user_id || bm.user_id === filters.user_id)
                );
                return { data: found || null, error: null };
              }
              return { data: null, error: null };
            },
          };
          return queryBuilder;
        },
      };
    }

    it("SupabaseTenancyRepository: correctly resolves getOrgRole for all roles and unassigned user", async () => {
      const repo = new SupabaseTenancyRepository();
      (repo as any).getClient = () => createMockSupabaseClient();

      expect(await repo.getOrgRole(ownerUserId, orgId)).toBe("owner");
      expect(await repo.getOrgRole(adminUserId, orgId)).toBe("admin");
      expect(await repo.getOrgRole(strategistUserId, orgId)).toBe("member");
      expect(await repo.getOrgRole(writerUserId, orgId)).toBe("member");
      expect(await repo.getOrgRole(reviewerUserId, orgId)).toBe("member");
      expect(await repo.getOrgRole(viewerUserId, orgId)).toBe("member");
      expect(await repo.getOrgRole(orgMemberOnlyUserId, orgId)).toBe("member");
      expect(await repo.getOrgRole(completelyUnassignedUserId, orgId)).toBeNull();
    });

    it("SupabaseTenancyRepository: correctly resolves getBrandRole with Owner/Admin inheritance and explicit roles", async () => {
      const repo = new SupabaseTenancyRepository();
      (repo as any).getClient = () => createMockSupabaseClient();

      // Owner & Admin inherit "strategist" without explicit brand_members row
      expect(await repo.getBrandRole(ownerUserId, brandId)).toBe("strategist");
      expect(await repo.getBrandRole(adminUserId, brandId)).toBe("strategist");

      // Explicit brand roles
      expect(await repo.getBrandRole(strategistUserId, brandId)).toBe("strategist");
      expect(await repo.getBrandRole(writerUserId, brandId)).toBe("writer");
      expect(await repo.getBrandRole(reviewerUserId, brandId)).toBe("reviewer");
      expect(await repo.getBrandRole(viewerUserId, brandId)).toBe("viewer");

      // Member not assigned to brand -> null
      expect(await repo.getBrandRole(orgMemberOnlyUserId, brandId)).toBeNull();

      // Completely unassigned user -> null
      expect(await repo.getBrandRole(completelyUnassignedUserId, brandId)).toBeNull();
    });

    it("SupabaseTenancyRepository: canAccessBrand allows Owner/Admin and explicit brand members, rejecting unassigned", async () => {
      const repo = new SupabaseTenancyRepository();
      (repo as any).getClient = () => createMockSupabaseClient();

      // Owner & Admin have access
      expect(await repo.canAccessBrand(ownerUserId, brandId)).toBe(true);
      expect(await repo.canAccessBrand(adminUserId, brandId)).toBe(true);

      // Explicit brand members have access
      expect(await repo.canAccessBrand(strategistUserId, brandId)).toBe(true);
      expect(await repo.canAccessBrand(writerUserId, brandId)).toBe(true);
      expect(await repo.canAccessBrand(reviewerUserId, brandId)).toBe(true);
      expect(await repo.canAccessBrand(viewerUserId, brandId)).toBe(true);

      // Org member without explicit brand assignment cannot access brand
      expect(await repo.canAccessBrand(orgMemberOnlyUserId, brandId)).toBe(false);

      // Unassigned user cannot access brand
      expect(await repo.canAccessBrand(completelyUnassignedUserId, brandId)).toBe(false);

      // isBrandAccessible alias behaves identically
      expect(await repo.isBrandAccessible(ownerUserId, brandId)).toBe(true);
      expect(await repo.isBrandAccessible(completelyUnassignedUserId, brandId)).toBe(false);
    });

    it("TenancyRepository: in-memory and async methods support all role types and Owner/Admin inheritance", async () => {
      const memoryRepo = new TenancyRepository();

      // Create Org
      const ownerCtx: SecurityContext = { userId: ownerUserId, isAuthenticated: true };
      const { org } = memoryRepo.createOrganization(ownerCtx, "Memory Org", "memory-org");
      const brand = memoryRepo.createBrand(ownerCtx, org.id, "Memory Brand", "mem-brand", "mem.com");

      // Add Admin
      memoryRepo.addOrganizationMember(ownerCtx, org.id, adminUserId, "admin");

      // Add Members
      memoryRepo.addOrganizationMember(ownerCtx, org.id, strategistUserId, "member");
      memoryRepo.addOrganizationMember(ownerCtx, org.id, writerUserId, "member");
      memoryRepo.addOrganizationMember(ownerCtx, org.id, reviewerUserId, "member");
      memoryRepo.addOrganizationMember(ownerCtx, org.id, viewerUserId, "member");
      memoryRepo.addOrganizationMember(ownerCtx, org.id, orgMemberOnlyUserId, "member");

      // Add Brand Memberships
      memoryRepo.addBrandMember(ownerCtx, brand.id, strategistUserId, "strategist");
      memoryRepo.addBrandMember(ownerCtx, brand.id, writerUserId, "writer");
      memoryRepo.addBrandMember(ownerCtx, brand.id, reviewerUserId, "reviewer");
      memoryRepo.addBrandMember(ownerCtx, brand.id, viewerUserId, "viewer");

      // Verify getOrgRole & getOrgRoleAsync
      expect(await memoryRepo.getOrgRoleAsync(org.id, ownerUserId)).toBe("owner");
      expect(await memoryRepo.getOrgRoleAsync(org.id, adminUserId)).toBe("admin");
      expect(await memoryRepo.getOrgRoleAsync(org.id, writerUserId)).toBe("member");
      expect(await memoryRepo.getOrgRoleAsync(org.id, completelyUnassignedUserId)).toBeNull();

      // Verify getBrandRole & getBrandRoleAsync
      expect(await memoryRepo.getBrandRoleAsync(brand.id, ownerUserId)).toBe("strategist");
      expect(await memoryRepo.getBrandRoleAsync(brand.id, adminUserId)).toBe("strategist");
      expect(await memoryRepo.getBrandRoleAsync(brand.id, strategistUserId)).toBe("strategist");
      expect(await memoryRepo.getBrandRoleAsync(brand.id, writerUserId)).toBe("writer");
      expect(await memoryRepo.getBrandRoleAsync(brand.id, reviewerUserId)).toBe("reviewer");
      expect(await memoryRepo.getBrandRoleAsync(brand.id, viewerUserId)).toBe("viewer");
      expect(await memoryRepo.getBrandRoleAsync(brand.id, orgMemberOnlyUserId)).toBeNull();
      expect(await memoryRepo.getBrandRoleAsync(brand.id, completelyUnassignedUserId)).toBeNull();

      // Verify canAccessBrand & canAccessBrandAsync
      expect(await memoryRepo.canAccessBrandAsync(brand.id, ownerUserId)).toBe(true);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, adminUserId)).toBe(true);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, strategistUserId)).toBe(true);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, writerUserId)).toBe(true);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, reviewerUserId)).toBe(true);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, viewerUserId)).toBe(true);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, orgMemberOnlyUserId)).toBe(false);
      expect(await memoryRepo.canAccessBrandAsync(brand.id, completelyUnassignedUserId)).toBe(false);
    });
  });
});
