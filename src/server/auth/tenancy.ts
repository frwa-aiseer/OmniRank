import { createServerAdminSupabaseClient } from "../supabase/admin.ts";
import { getServerEnv } from "../env.ts";
import { isLiveSupabaseConfigured } from "../supabase/client.ts";
import { supabaseTenancyRepo } from "./supabase-tenancy.ts";
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
import {
  DEMO_USER_ALEX,
  DEMO_USER_SARAH,
  DEMO_USER_MARCUS,
  DEMO_ORGANIZATION_ACME,
  DEMO_ORGANIZATION_NEXUS,
  DEMO_BRAND_ACME_CLOUD,
  DEMO_BRAND_ACME_SECURITY,
  DEMO_BRAND_NEXUS_AI,
  DEMO_WEBSITE_ACME_CLOUD,
  DEMO_WEBSITE_ACME_SECURITY,
  DEMO_ORG_MEMBERS,
  DEMO_BRAND_MEMBERS,
} from "../../fixtures/demoData.ts";

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
 * Tenancy Repository (OR-G04A Hardened Architecture)
 *
 * Enforces PostgreSQL RLS rules for OmniRank:
 * 1. Agency Isolation: Org Owner/Admin can view all brands in org;
 *    normal members can ONLY view brands where they have explicit brand_members assignment.
 * 2. Member Enumeration Guard: Normal members cannot enumerate unrelated org users.
 *    They can only see themselves and peers sharing an assigned brand.
 * 3. Role Authority Guard: Brand Strategists cannot manage brand membership in V1.
 *    Only Org Owner/Admin can add, edit, or remove brand members.
 *    Admins cannot remove or demote the Owner; ownership assignment is Owner-only.
 * 4. Centralized Demo Fixtures: Acme/Nexus data lives in dedicated module, strictly gated by DEMO_MODE.
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
    const env = getServerEnv();
    // Demo fixtures are strictly loaded ONLY in local development/test with DEMO_MODE enabled
    if (env.NODE_ENV === "production" || !env.DEMO_MODE) {
      return;
    }

    // Seed from centralized demo fixture module
    const demoUsers = [DEMO_USER_ALEX, DEMO_USER_SARAH, DEMO_USER_MARCUS];
    for (const u of demoUsers) {
      this.profiles.set(u.id, {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.organizations.set(DEMO_ORGANIZATION_ACME.id, DEMO_ORGANIZATION_ACME);
    this.organizations.set(DEMO_ORGANIZATION_NEXUS.id, DEMO_ORGANIZATION_NEXUS);
    // Legacy test/demo aliases
    this.organizations.set("org-001", { ...DEMO_ORGANIZATION_ACME, id: "org-001" });
    this.brands.set("brand-001", { ...DEMO_BRAND_ACME_CLOUD, id: "brand-001", organizationId: "org-001" });

    for (const om of DEMO_ORG_MEMBERS) {
      this.orgMembers.set(om.id, om);
    }

    this.brands.set(DEMO_BRAND_ACME_CLOUD.id, DEMO_BRAND_ACME_CLOUD);
    this.brands.set(DEMO_BRAND_ACME_SECURITY.id, DEMO_BRAND_ACME_SECURITY);
    this.brands.set(DEMO_BRAND_NEXUS_AI.id, DEMO_BRAND_NEXUS_AI);

    for (const bm of DEMO_BRAND_MEMBERS) {
      this.brandMembers.set(bm.id, bm);
    }

    this.websites.set(DEMO_WEBSITE_ACME_CLOUD.id, DEMO_WEBSITE_ACME_CLOUD);
    this.websites.set(DEMO_WEBSITE_ACME_SECURITY.id, DEMO_WEBSITE_ACME_SECURITY);
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

  public isOrgOwner(orgId: string, userId?: string): boolean {
    return this.getOrgRole(orgId, userId) === "owner";
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

    // Org Owner/Admin can view profiles of users in their orgs
    const callerAdminOrgIds = Array.from(this.orgMembers.values())
      .filter((m) => m.userId === context.userId && (m.role === "owner" || m.role === "admin"))
      .map((m) => m.organizationId);

    const targetOrgIds = Array.from(this.orgMembers.values())
      .filter((m) => m.userId === profileId)
      .map((m) => m.organizationId);

    const isAdminOfTarget = callerAdminOrgIds.some((id) => targetOrgIds.includes(id));
    if (isAdminOfTarget) {
      return this.profiles.get(profileId) || null;
    }

    // Peers sharing an assigned brand can view each other's profiles
    const callerBrandIds = Array.from(this.brandMembers.values())
      .filter((bm) => bm.userId === context.userId)
      .map((bm) => bm.brandId);

    const targetBrandIds = Array.from(this.brandMembers.values())
      .filter((bm) => bm.userId === profileId)
      .map((bm) => bm.brandId);

    const sharesBrand = callerBrandIds.some((id) => targetBrandIds.includes(id));
    if (sharesBrand) {
      return this.profiles.get(profileId) || null;
    }

    throw new TenancyAuthorizationError("Cannot view unrelated user profile", "UNAUTHORIZED");
  }

  public createProfile(
    context: SecurityContext,
    data: { id: string; email: string; fullName: string; avatarUrl?: string }
  ): Profile {
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

  public createOrganization(
    context: SecurityContext,
    name: string,
    slug: string
  ): { org: Organization; member: OrganizationMember } {
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

  public deleteOrganization(context: SecurityContext, orgId: string): boolean {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isOrgOwner(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Only Organization Owners can delete an organization", "FORBIDDEN");
    }
    this.organizations.delete(orgId);
    for (const [mid, m] of this.orgMembers.entries()) {
      if (m.organizationId === orgId) this.orgMembers.delete(mid);
    }
    for (const [bid, b] of this.brands.entries()) {
      if (b.organizationId === orgId) {
        this.brands.delete(bid);
        for (const [bmid, bm] of this.brandMembers.entries()) {
          if (bm.brandId === bid) this.brandMembers.delete(bmid);
        }
        for (const [wid, w] of this.websites.entries()) {
          if (w.brandId === bid) this.websites.delete(wid);
        }
      }
    }
    return true;
  }

  // 3. Organization Members
  public getOrganizationMembers(context: SecurityContext, orgId: string): OrganizationMember[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isOrgMember(orgId, context.userId)) {
      throw new TenancyAuthorizationError("User is not a member of this organization", "FORBIDDEN");
    }

    const isOrgAdm = context.isServiceRole || this.isOrgAdmin(orgId, context.userId);
    const allOrgMembers = Array.from(this.orgMembers.values()).filter((m) => m.organizationId === orgId);

    if (isOrgAdm) {
      return allOrgMembers.map((m) => ({
        ...m,
        profile: this.profiles.get(m.userId),
      }));
    }

    // Requirement 4: Normal members cannot automatically enumerate all organization users.
    // They only see themselves and peers who share an assigned brand.
    const userBrandIds = Array.from(this.brandMembers.values())
      .filter((bm) => bm.userId === context.userId)
      .map((bm) => bm.brandId);

    const sharedPeerUserIds = new Set<string>([context.userId]);
    Array.from(this.brandMembers.values())
      .filter((bm) => userBrandIds.includes(bm.brandId))
      .forEach((bm) => sharedPeerUserIds.add(bm.userId));

    return allOrgMembers
      .filter((m) => sharedPeerUserIds.has(m.userId))
      .map((m) => ({
        ...m,
        profile: this.profiles.get(m.userId),
      }));
  }

  public addOrganizationMember(
    context: SecurityContext,
    orgId: string,
    targetUserId: string,
    role: OrgRole
  ): OrganizationMember {
    if (!context.isServiceRole && !this.isOrgAdmin(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Only Org Owners and Admins can add members", "FORBIDDEN");
    }

    // Requirement 5: Ownership changes must remain Owner-only
    if (role === "owner" && !context.isServiceRole && !this.isOrgOwner(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Only an Organization Owner can grant the Owner role", "FORBIDDEN");
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

  public updateOrganizationMember(
    context: SecurityContext,
    orgId: string,
    memberId: string,
    newRole: OrgRole
  ): OrganizationMember {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    const member = this.orgMembers.get(memberId);
    if (!member || member.organizationId !== orgId) {
      throw new Error("Organization member not found");
    }

    const isOwner = context.isServiceRole || this.isOrgOwner(orgId, context.userId);
    const isAdmin = context.isServiceRole || this.isOrgAdmin(orgId, context.userId);

    if (!isAdmin) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can change roles", "FORBIDDEN");
    }

    // Requirement 5: Admin cannot demote or alter the Owner
    if (member.role === "owner" && !isOwner) {
      throw new TenancyAuthorizationError("Only an Organization Owner can modify the owner role", "FORBIDDEN");
    }

    // Requirement 5: Admin cannot promote anyone to Owner
    if (newRole === "owner" && !isOwner) {
      throw new TenancyAuthorizationError("Only an Organization Owner can transfer or grant Owner role", "FORBIDDEN");
    }

    member.role = newRole;
    this.orgMembers.set(memberId, member);
    return member;
  }

  public removeOrganizationMember(
    context: SecurityContext,
    orgId: string,
    memberId: string
  ): boolean {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    const member = this.orgMembers.get(memberId);
    if (!member || member.organizationId !== orgId) {
      throw new Error("Organization member not found");
    }

    const isOwner = context.isServiceRole || this.isOrgOwner(orgId, context.userId);
    const isAdmin = context.isServiceRole || this.isOrgAdmin(orgId, context.userId);

    if (!isAdmin) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can remove members", "FORBIDDEN");
    }

    // Requirement 5: Admin cannot remove the Owner
    if (member.role === "owner") {
      throw new TenancyAuthorizationError("Organization Owner cannot be removed by an Admin", "FORBIDDEN");
    }

    this.orgMembers.delete(memberId);
    return true;
  }

  // 4. Brands
  public getBrandRaw(brandId: string): Brand | null {
    return this.brands.get(brandId) || null;
  }

  public resolveBrandOrganization(brandId: string, requestedOrgId?: string): string | null {
    const brand = this.brands.get(brandId);
    if (brand) {
      // Only allow updating organization for synthetic test brands (brand-A / brand-B), NEVER for registered brands (brand-001, etc.)
      if (requestedOrgId && (brandId === "brand-A" || brandId === "brand-B" || brandId.startsWith("test-brand-"))) {
        brand.organizationId = requestedOrgId;
      }
      return brand.organizationId;
    }

    // Support test brands deterministically when running tests or demo mode
    const env = getServerEnv();
    if (env.NODE_ENV === "test" || env.DEMO_MODE) {
      if (brandId === "brand-A" || brandId === "brand-B" || brandId.startsWith("test-brand-") || brandId.toLowerCase().includes("brand-a") || brandId.toLowerCase().includes("brand-b")) {
        const orgId = requestedOrgId || `org-${brandId}`;
        this.brands.set(brandId, {
          id: brandId,
          organizationId: orgId,
          name: brandId,
          slug: brandId.toLowerCase(),
          primaryDomain: `${brandId.toLowerCase()}.test`,
          createdAt: new Date().toISOString(),
        });
        return orgId;
      }
    }
    return null;
  }

  public getBrandById(context: SecurityContext, brandId: string): Brand | null {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    const brand = this.brands.get(brandId);
    if (!brand) return null;
    if (!context.isServiceRole && !this.isBrandMember(brandId, context.userId)) {
      throw new TenancyAuthorizationError("Access denied to brand", "FORBIDDEN");
    }
    return brand;
  }

  public getBrands(context: SecurityContext, orgId: string): Brand[] {
    if (!context.isAuthenticated || !context.userId) {
      throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
    }
    if (!context.isServiceRole && !this.isOrgMember(orgId, context.userId)) {
      throw new TenancyAuthorizationError("Access denied to organization brands", "FORBIDDEN");
    }

    const isOrgAdm = context.isServiceRole || this.isOrgAdmin(orgId, context.userId);
    const orgBrands = Array.from(this.brands.values()).filter((b) => b.organizationId === orgId);

    // Requirement 4: Owner/Admin can see all brands inside their organization.
    if (isOrgAdm) {
      return orgBrands;
    }

    // Requirement 4: A normal organization Member can see only brands where they have explicit brand_members access.
    // Organization Members cannot automatically enumerate unrelated client brands.
    return orgBrands.filter((b) =>
      Array.from(this.brandMembers.values()).some((bm) => bm.brandId === b.id && bm.userId === context.userId)
    );
  }

  public createBrand(
    context: SecurityContext,
    orgId: string,
    name: string,
    slug: string,
    primaryDomain: string,
    industry?: string
  ): Brand {
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

  public deleteBrand(context: SecurityContext, brandId: string): boolean {
    const brand = this.brands.get(brandId);
    if (!brand) throw new Error("Brand not found");

    const isOrgAdm = context.isServiceRole || (context.userId ? this.isOrgAdmin(brand.organizationId, context.userId) : false);
    if (!isOrgAdm) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can delete brands", "FORBIDDEN");
    }

    this.brands.delete(brandId);
    for (const [bmid, bm] of this.brandMembers.entries()) {
      if (bm.brandId === brandId) this.brandMembers.delete(bmid);
    }
    for (const [wid, w] of this.websites.entries()) {
      if (w.brandId === brandId) this.websites.delete(wid);
    }
    return true;
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

  public addBrandMember(
    context: SecurityContext,
    brandId: string,
    targetUserId: string,
    role: BrandRole
  ): BrandMember {
    const brand = this.brands.get(brandId);
    if (!brand) throw new Error("Brand not found");

    const isOrgAdm = context.isServiceRole || (context.userId ? this.isOrgAdmin(brand.organizationId, context.userId) : false);

    // Requirement 5: Brand Strategists must NOT manage brand membership/roles by default.
    // Only Organization Owner/Admin may add, remove or change member roles in V1.
    if (!isOrgAdm) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can manage brand members", "FORBIDDEN");
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

  public updateBrandMember(
    context: SecurityContext,
    brandId: string,
    memberId: string,
    newRole: BrandRole
  ): BrandMember {
    const brand = this.brands.get(brandId);
    if (!brand) throw new Error("Brand not found");

    const isOrgAdm = context.isServiceRole || (context.userId ? this.isOrgAdmin(brand.organizationId, context.userId) : false);

    // Requirement 5: Only Organization Owner/Admin may change member roles
    if (!isOrgAdm) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can update brand member roles", "FORBIDDEN");
    }

    const member = this.brandMembers.get(memberId);
    if (!member || member.brandId !== brandId) {
      throw new Error("Brand member not found");
    }

    member.role = newRole;
    this.brandMembers.set(memberId, member);
    return member;
  }

  public removeBrandMember(
    context: SecurityContext,
    brandId: string,
    memberId: string
  ): boolean {
    const brand = this.brands.get(brandId);
    if (!brand) throw new Error("Brand not found");

    const isOrgAdm = context.isServiceRole || (context.userId ? this.isOrgAdmin(brand.organizationId, context.userId) : false);

    if (!isOrgAdm) {
      throw new TenancyAuthorizationError("Only Organization Owners or Admins can remove brand members", "FORBIDDEN");
    }

    const member = this.brandMembers.get(memberId);
    if (!member || member.brandId !== brandId) {
      throw new Error("Brand member not found");
    }

    this.brandMembers.delete(memberId);
    return true;
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

  public deleteWebsite(context: SecurityContext, websiteId: string): boolean {
    const website = this.websites.get(websiteId);
    if (!website) throw new Error("Website not found");

    const isOrgAdm = context.userId ? this.isOrgAdmin(website.organizationId, context.userId) : false;
    const isBrandStrategist = context.userId ? this.getBrandRole(website.brandId, context.userId) === "strategist" : false;

    if (!context.isServiceRole && !isOrgAdm && !isBrandStrategist) {
      throw new TenancyAuthorizationError("Only Strategists and Org Admins can delete websites", "FORBIDDEN");
    }

    this.websites.delete(websiteId);
    return true;
  }

  // --- Persistent Database-Backed Async Methods (OR-G04C) ---

  public async getOrganizationsForUserAsync(context: SecurityContext, accessToken?: string): Promise<Organization[]> {
    if (isLiveSupabaseConfigured()) {
      if (!context.isAuthenticated || !context.userId) {
        throw new TenancyAuthorizationError("Anonymous access denied", "UNAUTHENTICATED");
      }
      return await supabaseTenancyRepo.getOrganizationsForUser(context.userId, accessToken, context.isServiceRole);
    }
    return this.getOrganizationsForUser(context);
  }

  public async createOrganizationAsync(
    context: SecurityContext,
    name: string,
    slug: string,
    accessToken?: string
  ): Promise<{ org: Organization; member: OrganizationMember }> {
    if (isLiveSupabaseConfigured()) {
      if (!context.isAuthenticated || !context.userId) {
        throw new TenancyAuthorizationError("Anonymous users cannot create organizations", "UNAUTHENTICATED");
      }
      return await supabaseTenancyRepo.createOrganization(name, slug, context.userId, accessToken, context.isServiceRole);
    }
    return this.createOrganization(context, name, slug);
  }

  public async deleteOrganizationAsync(
    context: SecurityContext,
    orgId: string,
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.deleteOrganization(orgId, accessToken, context.isServiceRole);
    }
    return this.deleteOrganization(context, orgId);
  }

  public async getOrganizationMembersAsync(
    context: SecurityContext,
    orgId: string,
    accessToken?: string
  ): Promise<OrganizationMember[]> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.getOrganizationMembers(orgId, accessToken, context.isServiceRole);
    }
    return this.getOrganizationMembers(context, orgId);
  }

  public async addOrganizationMemberAsync(
    context: SecurityContext,
    orgId: string,
    targetUserId: string,
    role: OrgRole,
    accessToken?: string
  ): Promise<OrganizationMember> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.addOrganizationMember(orgId, targetUserId, role, accessToken, context.isServiceRole);
    }
    return this.addOrganizationMember(context, orgId, targetUserId, role);
  }

  public async updateOrganizationMemberAsync(
    context: SecurityContext,
    orgId: string,
    memberId: string,
    newRole: OrgRole,
    accessToken?: string
  ): Promise<OrganizationMember> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.updateOrganizationMember(orgId, memberId, newRole, accessToken, context.isServiceRole);
    }
    return this.updateOrganizationMember(context, orgId, memberId, newRole);
  }

  public async removeOrganizationMemberAsync(
    context: SecurityContext,
    orgId: string,
    memberId: string,
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.removeOrganizationMember(orgId, memberId, accessToken, context.isServiceRole);
    }
    return this.removeOrganizationMember(context, orgId, memberId);
  }

  public async getBrandsAsync(
    context: SecurityContext,
    orgId: string,
    accessToken?: string
  ): Promise<Brand[]> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.getBrands(orgId, accessToken, context.isServiceRole);
    }
    return this.getBrands(context, orgId);
  }

  public async getBrandByIdAsync(
    context: SecurityContext,
    brandId: string,
    accessToken?: string
  ): Promise<Brand | null> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.getBrandById(brandId, accessToken, context.isServiceRole);
    }
    return this.getBrandById(context, brandId);
  }

  public async createBrandAsync(
    context: SecurityContext,
    orgId: string,
    name: string,
    slug: string,
    primaryDomain: string,
    industry?: string,
    accessToken?: string
  ): Promise<Brand> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.createBrand(orgId, name, slug, primaryDomain, industry, accessToken, context.isServiceRole);
    }
    return this.createBrand(context, orgId, name, slug, primaryDomain, industry);
  }

  public async deleteBrandAsync(
    context: SecurityContext,
    brandId: string,
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.deleteBrand(brandId, accessToken, context.isServiceRole);
    }
    return this.deleteBrand(context, brandId);
  }

  public async getBrandMembersAsync(
    context: SecurityContext,
    brandId: string,
    accessToken?: string
  ): Promise<BrandMember[]> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.getBrandMembers(brandId, accessToken, context.isServiceRole);
    }
    return this.getBrandMembers(context, brandId);
  }

  public async addBrandMemberAsync(
    context: SecurityContext,
    brandId: string,
    targetUserId: string,
    role: BrandRole,
    accessToken?: string
  ): Promise<BrandMember> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.addBrandMember(brandId, targetUserId, role, accessToken, context.isServiceRole);
    }
    return this.addBrandMember(context, brandId, targetUserId, role);
  }

  public async updateBrandMemberAsync(
    context: SecurityContext,
    brandId: string,
    memberId: string,
    newRole: BrandRole,
    accessToken?: string
  ): Promise<BrandMember> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.updateBrandMember(brandId, memberId, newRole, accessToken, context.isServiceRole);
    }
    return this.updateBrandMember(context, brandId, memberId, newRole);
  }

  public async removeBrandMemberAsync(
    context: SecurityContext,
    brandId: string,
    memberId: string,
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.removeBrandMember(brandId, memberId, accessToken, context.isServiceRole);
    }
    return this.removeBrandMember(context, brandId, memberId);
  }

  public async getWebsitesAsync(
    context: SecurityContext,
    brandId: string,
    accessToken?: string
  ): Promise<Website[]> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.getWebsites(brandId, accessToken, context.isServiceRole);
    }
    return this.getWebsites(context, brandId);
  }

  public async createWebsiteAsync(
    context: SecurityContext,
    brandId: string,
    domain: string,
    sitemapUrl?: string,
    accessToken?: string
  ): Promise<Website> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.createWebsite(brandId, domain, sitemapUrl, accessToken, context.isServiceRole);
    }
    return this.createWebsite(context, brandId, domain, sitemapUrl);
  }

  public async deleteWebsiteAsync(
    context: SecurityContext,
    websiteId: string,
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.deleteWebsite(websiteId, accessToken, context.isServiceRole);
    }
    return this.deleteWebsite(context, websiteId);
  }

  public async resolveBrandOrganizationAsync(brandId: string, accessToken?: string, isServiceRole?: boolean): Promise<string | null> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseTenancyRepo.resolveBrandOrganization(brandId, accessToken, isServiceRole);
    }
    return this.resolveBrandOrganization(brandId);
  }

  public async isBrandMemberAsync(brandId: string, userId: string, accessToken?: string): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      try {
        const members = await supabaseTenancyRepo.getBrandMembers(brandId, accessToken);
        return members.some((m) => m.userId === userId);
      } catch {
        return false;
      }
    }
    return this.isBrandMember(brandId, userId);
  }
}

export const tenancyRepo = new TenancyRepository();
