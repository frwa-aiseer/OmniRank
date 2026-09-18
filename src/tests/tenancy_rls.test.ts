import { describe, it, expect, beforeEach } from "vitest";
import { TenancyRepository, SecurityContext, TenancyAuthorizationError } from "../server/auth/tenancy.ts";

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

  it("should enforce Supabase SECURITY DEFINER hardening guidelines across SQL migrations", () => {
    // Read the SQL migration file
    const fs = require("fs");
    const path = require("path");
    const migrationFile = path.resolve(__dirname, "../../supabase/migrations/20260916000001_auth_tenancy_rls.sql");
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
  });
});
