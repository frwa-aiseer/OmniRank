import { createServerAdminSupabaseClient } from "../supabase/admin.ts";
import {
  Profile,
  Organization,
  OrganizationMember,
  Brand,
  BrandMember,
  Website,
  OrgRole,
  BrandRole,
} from "../../types/index.ts";

export interface SecurityContext {
  userId?: string;
  isAuthenticated: boolean;
  isServiceRole?: boolean;
}

export class TenancyAuthorizationError extends Error {
  constructor(message: string, public code: string = "FORBIDDEN") {
    super(message);
    this.name = "TenancyAuthorizationError";
  }
}

/**
 * In-memory Tenant Isolation Store for dev/testing/simulation
 * strictly implements Postgres RLS rules for OmniRank.
 */
export class TenancyRepository {
  private profiles: Map<string, Profile> = new Map();
  private organizations: Map<string, Organization> = new Map();
  private orgMembers: Map<string, OrganizationMember> = new Map();
  private brands: Map<string, Brand> = new Map();
  private brandMembers: Map<string, BrandMember> = new Map();
  private websites: Map<string, Website> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Seed default demo user and org for development preview
    const demoUser: Profile = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "demo@omnirank.ai",
      fullName: "Alex Rivera",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(demoUser.id, demoUser);

    const demoOrg: Organization = {
      id: "11111111-1111-4000-8000-111111111111",
      name: "Acme Growth Media",
      slug: "acme-growth-media",
      createdBy: demoUser.id,
      createdAt: new Date().toISOString(),
    };
    this.organizations.set(demoOrg.id, demoOrg);

    const demoOrgMember: OrganizationMember = {
      id: "22222222-2222-4000-8000-222222222221",
      organizationId: demoOrg.id,
      userId: demoUser.id,
      role: "owner",
      createdAt: new Date().toISOString(),
    };
    this.orgMembers.set(demoOrgMember.id, demoOrgMember);

    const demoBrand: Brand = {
      id: "33333333-3333-4000-8000-333333333331",
      organizationId: demoOrg.id,
      name: "Acme Cloud",
      slug: "acme-cloud",
      primaryDomain: "acmecloud.io",
      industry: "B2B SaaS / DevOps",
      createdAt: new Date().toISOString(),
    };
    this.brands.set(demoBrand.id, demoBrand);

    const demoBrandMember: BrandMember = {
      id: "44444444-4444-4000-8000-444444444441",
      brandId: demoBrand.id,
      userId: demoUser.id,
      role: "strategist",
      createdAt: new Date().toISOString(),
    };
    this.brandMembers.set(demoBrandMember.id, demoBrandMember);

    const demoWebsite: Website = {
      id: "55555555-5555-4000-8000-555555555551",
      organizationId: demoOrg.id,
      brandId: demoBrand.id,
      domain: "acmecloud.io",
      sitemapUrl: "https://acmecloud.io/sitemap.xml",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    this.websites.set(demoWebsite.id, demoWebsite);
  }

  // --- RLS Helper Methods ---

  public isOrgMember(orgId: string, userId?: string): boolean {
    if (!userId) return false;
    return Array.from(this.orgMembers.values()).some(
      (m) => m.organizationId === orgId && m.userId === userId
    );
  }

  public getOrgRole(orgId: string, userId?: string): OrgRole | null {
    if (!userId) return null;
    const member = Array.from(this.orgMembers.values()).find(
      (m) => m.organizationId === orgId && m.userId === userId
    );
    return member ? member.role : null;
  }

  public isOrgAdmin(orgId: string, userId?: string): boolean {
    const role = this.getOrgRole(orgId, userId);
    return role === "owner" || role === "admin";
  }

  public isBrandMember(brandId: string, userId?: string): boolean {
    if (!userId) return false;
    // Direct brand member or org admin/owner
    const direct = Array.from(this.brandMembers.values()).some(
      (m) => m.brandId === brandId && m.userId === userId
    );
    if (direct) return true;

    const brand = this.brands.get(brandId);
    if (brand && this.isOrgAdmin(brand.organizationId, userId)) {
      return true;
    }
    return false;
  }

  public getBrandRole(brandId: string, userId?: string): BrandRole | null {
    if (!userId) return null;
    const member = Array.from(this.brandMembers.values()).find(
      (m) => m.brandId === brandId && m.userId === userId
    );
    if (member) return member.role;

    const brand = this.brands.get(brandId);
    if (brand && this.isOrgAdmin(brand.organizationId, userId)) {
      return "strategist"; // Org admins act with highest strategist privileges on brands
    }
    return null;
  }

  // --- RLS Protected Operations ---

  // 1. Profiles
  public getProfile(context: SecurityContext, profileId: string): Profile | null {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (context.isServiceRole || context.userId === profileId) {
      return this.profiles.get(profileId) || null;
    }
    // Check if co-member in any org
    const userOrgs = Array.from(this.orgMembers.values())
      .filter((m) => m.userId === context.userId)
      .map((m) => m.organizationId);
    const targetOrgs = Array.from(this.orgMembers.values())
      .filter((m) => m.userId === profileId)
      .map((m) => m.organizationId);
    const sharesOrg = userOrgs.some((id) => targetOrgs.includes(id));
    if (!sharesOrg) {
      throw new TenancyAuthorizationError("Cannot view cross-tenant user profile", "UNAUTHORIZED");
    }
    return this.profiles.get(profileId) || null;
  }

  public createProfile(context: SecurityContext, data: { id: string; email: string; fullName: string; avatarUrl?: string }): Profile {
    if (!context.isServiceRole && context.userId !== data.id) {
      throw new TenancyAuthorizationError("Cannot create profile for another user ID", "UNAUTHORIZED");
    }
    const profile: Profile = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(profile.id, profile);
    return profile;
  }

  // 2. Organizations
  public getOrganizationsForUser(context: SecurityContext): Organization[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (context.isServiceRole) {
      return Array.from(this.organizations.values());
    }
    const memberOrgIds = Array.from(this.orgMembers.values())
      .filter((m) => m.userId === context.userId)
      .map((m) => m.organizationId);
    return Array.from(this.organizations.values()).filter((o) => memberOrgIds.includes(o.id));
  }

  public createOrganization(context: SecurityContext, name: string, slug: string): { org: Organization; member: OrganizationMember } {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous users cannot create organizations", "UNAUTHENTICATED");
    }
    const orgId = crypto.randomUUID();
    const org: Organization = {
      id: orgId,
      name,
      slug,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(org.id, org);

    const memberId = crypto.randomUUID();
    const member: OrganizationMember = {
      id: memberId,
      organizationId: org.id,
      userId: context.userId,
      role: "owner",
      createdAt: new Date().toISOString(),
    };
    this.orgMembers.set(member.id, member);
    return { org, member };
  }

  public updateOrganization(context: SecurityContext, orgId: string, updates: Partial<Organization>): Organization {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isOrgAdmin(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can update organization settings", "FORBIDDEN");
    }
    const org = this.organizations.get(orgId);
    if (!org) throw new Error("Organization not found");
    const updated = { ...org, ...updates, updatedAt: new Date().toISOString() };
    this.organizations.set(orgId, updated);
    return updated;
  }

  // 3. Organization Members
  public getOrganizationMembers(context: SecurityContext, orgId: string): OrganizationMember[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isOrgMember(orgId, context.userId)) {
      throw new TenancyAuthorizationError("User is not a member of this organization", "FORBIDDEN");
    }
    return Array.from(this.orgMembers.values())
      .filter((m) => m.organizationId === orgId)
      .map((m) => ({
        ...m,
        profile: this.profiles.get(m.userId),
      }));
  }

  public addOrganizationMember(context: SecurityContext, orgId: string, targetUserId: string, role: OrgRole): OrganizationMember {
    if (!context.isServiceRole && !this.isOrgAdmin(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Only Org Owners and Admins can add members", "FORBIDDEN");
    }
    const id = crypto.randomUUID();
    const member: OrganizationMember = {
      id,
      organizationId: orgId,
      userId: targetUserId,
      role,
      createdAt: new Date().toISOString(),
    };
    this.orgMembers.set(id, member);
    return member;
  }

  // 4. Brands
  public getBrands(context: SecurityContext, orgId: string): Brand[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isOrgMember(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Access denied to organization brands", "FORBIDDEN");
    }
    return Array.from(this.brands.values()).filter((b) => b.organizationId === orgId);
  }

  public createBrand(context: SecurityContext, orgId: string, name: string, slug: string, primaryDomain: string, industry?: string): Brand {
    if (!context.isServiceRole && !this.isOrgAdmin(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can create brands", "FORBIDDEN");
    }
    const brandId = crypto.randomUUID();
    const brand: Brand = {
      id: brandId,
      organizationId: orgId,
      name,
      slug,
      primaryDomain,
      industry,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.brands.set(brand.id, brand);

    if (context.userId) {
      const memberId = crypto.randomUUID();
      this.brandMembers.set(memberId, {
        id: memberId,
        brandId: brand.id,
        userId: context.userId,
        role: "strategist",
        createdAt: new Date().toISOString(),
      });
    }

    return brand;
  }

  // 5. Brand Members
  public getBrandMembers(context: SecurityContext, brandId: string): BrandMember[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isBrandMember(brandId, context.userId)) {
      throw new TenancyAuthorizationError("Access denied: User is not a member of this brand", "FORBIDDEN");
    }
    return Array.from(this.brandMembers.values())
      .filter((m) => m.brandId === brandId)
      .map((m) => ({
        ...m,
        profile: this.profiles.get(m.userId),
      }));
  }

  public addBrandMember(context: SecurityContext, brandId: string, targetUserId: string, role: BrandRole): BrandMember {
    const brand = this.brands.get(brandId);
    if (!brand) throw new Error("Brand not found");

    const isOrgAdm = context.userId ? this.isOrgAdmin(brand.organizationId, context.userId) : false;
    const isBrandStrategist = context.userId ? this.getBrandRole(brandId, context.userId) === "strategist" : false;

    if (!context.isServiceRole && !isOrgAdm && !isBrandStrategist) {
      throw new TenancyAuthorizationError("Only Org Admins or Brand Strategists can manage brand members", "FORBIDDEN");
    }

    const id = crypto.randomUUID();
    const member: BrandMember = {
      id,
      brandId,
      userId: targetUserId,
      role,
      createdAt: new Date().toISOString(),
    };
    this.brandMembers.set(id, member);
    return member;
  }

  // 6. Websites
  public getWebsites(context: SecurityContext, brandId: string): Website[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isBrandMember(brandId, context.userId)) {
      throw new TenancyAuthorizationError("Access denied: User is not authorized for this brand's websites", "FORBIDDEN");
    }
    return Array.from(this.websites.values()).filter((w) => w.brandId === brandId);
  }

  public createWebsite(context: SecurityContext, brandId: string, domain: string, sitemapUrl?: string): Website {
    const brand = this.brands.get(brandId);
    if (!brand) throw new Error("Brand not found");

    const isOrgAdm = context.userId ? this.isOrgAdmin(brand.organizationId, context.userId) : false;
    const isBrandStrategist = context.userId ? this.getBrandRole(brandId, context.userId) === "strategist" : false;

    if (!context.isServiceRole && !isOrgAdm && !isBrandStrategist) {
      throw new TenancyAuthorizationError("Only Strategists and Org Admins can register websites", "FORBIDDEN");
    }

    const id = crypto.randomUUID();
    const website: Website = {
      id,
      organizationId: brand.organizationId,
      brandId,
      domain,
      sitemapUrl,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.websites.set(id, website);
    return website;
  }
}

export const tenancyRepo = new TenancyRepository();
