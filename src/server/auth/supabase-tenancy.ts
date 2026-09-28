import { SupabaseClient } from "@supabase/supabase-js";
import { createScopedUserSupabaseClient, getAdminSupabaseClient } from "../supabase/client.ts";
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
import { TenancyAuthorizationError, SecurityContext } from "./tenancy.ts";

/**
 * SupabaseTenancyRepository
 * Production PostgreSQL-backed Tenancy & Multi-Tenant Access Layer
 */
export class SupabaseTenancyRepository {
  private getClient(accessToken?: string, isServiceRole?: boolean): SupabaseClient {
    if (isServiceRole) {
      return getAdminSupabaseClient();
    }
    return createScopedUserSupabaseClient(accessToken);
  }

  // 1. Profiles
  async getProfile(profileId: string, accessToken?: string, isServiceRole?: boolean): Promise<Profile | null> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Tenancy] getProfile failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // 2. Organizations
  async getOrganizationsForUser(userId: string, accessToken?: string, isServiceRole?: boolean): Promise<Organization[]> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw new Error(`[Supabase Tenancy] getOrganizations failed: ${error.message}`);
    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getOrganizationById(orgId: string, accessToken?: string, isServiceRole?: boolean): Promise<Organization | null> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Tenancy] getOrganizationById failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createOrganization(
    name: string,
    slug: string,
    userId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<{ org: Organization; member: OrganizationMember }> {
    const client = this.getClient(accessToken, isServiceRole);

    // Call atomic RPC create_organization_with_owner with canonical SQL contract (_name, _slug)
    const { data, error } = await client.rpc("create_organization_with_owner", {
      _name: name,
      _slug: slug,
    });

    if (error) {
      throw new Error(`[Supabase Tenancy] create_organization_with_owner RPC failed: ${error.message}`);
    }

    const rpcResult = Array.isArray(data) ? data[0] : data;
    if (!rpcResult) {
      throw new Error("[Supabase Tenancy] create_organization_with_owner returned empty result");
    }

    // Unpack canonical nested organization & member payloads
    const rawOrg = rpcResult.organization || rpcResult;
    const rawMember = rpcResult.member || rpcResult;

    const orgId = rawOrg.id || rawOrg.organization_id;
    const memberId = rawMember.id || rawMember.member_id;

    if (!orgId) {
      throw new Error("[Supabase Tenancy] create_organization_with_owner response missing organization ID");
    }

    const org: Organization = {
      id: orgId,
      name: rawOrg.name || name,
      slug: rawOrg.slug || slug,
      createdBy: rawOrg.created_by || userId,
      createdAt: rawOrg.created_at || new Date().toISOString(),
      updatedAt: rawOrg.updated_at || rawOrg.created_at || new Date().toISOString(),
    };

    const member: OrganizationMember = {
      id: memberId || crypto.randomUUID(),
      organizationId: rawMember.organization_id || orgId,
      userId: rawMember.user_id || userId,
      role: (rawMember.role as OrgRole) || "owner",
      createdAt: rawMember.created_at || new Date().toISOString(),
    };

    return { org, member };
  }

  async deleteOrganization(orgId: string, accessToken?: string, isServiceRole?: boolean): Promise<boolean> {
    const client = this.getClient(accessToken, isServiceRole);
    const { error } = await client
      .from("organizations")
      .delete()
      .eq("id", orgId);

    if (error) throw new Error(`[Supabase Tenancy] deleteOrganization failed: ${error.message}`);
    return true;
  }

  // 3. Organization Members
  async getOrganizationMembers(orgId: string, accessToken?: string, isServiceRole?: boolean): Promise<OrganizationMember[]> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("organization_members")
      .select("*, profiles(*)")
      .eq("organization_id", orgId);

    if (error) throw new Error(`[Supabase Tenancy] getOrganizationMembers failed: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role as OrgRole,
      createdAt: row.created_at,
      profile: row.profiles
        ? {
            id: row.profiles.id,
            email: row.profiles.email,
            fullName: row.profiles.full_name,
            avatarUrl: row.profiles.avatar_url,
            createdAt: row.profiles.created_at,
            updatedAt: row.profiles.updated_at,
          }
        : undefined,
    }));
  }

  async addOrganizationMember(
    orgId: string,
    targetUserId: string,
    role: OrgRole,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<OrganizationMember> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("organization_members")
      .insert({
        organization_id: orgId,
        user_id: targetUserId,
        role,
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Tenancy] addOrganizationMember failed: ${error.message}`);

    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      role: data.role as OrgRole,
      createdAt: data.created_at,
    };
  }

  async updateOrganizationMember(
    orgId: string,
    memberId: string,
    newRole: OrgRole,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<OrganizationMember> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("organization_members")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Tenancy] updateOrganizationMember failed: ${error.message}`);

    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      role: data.role as OrgRole,
      createdAt: data.created_at,
    };
  }

  async removeOrganizationMember(
    orgId: string,
    memberId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<boolean> {
    const client = this.getClient(accessToken, isServiceRole);
    const { error } = await client
      .from("organization_members")
      .delete()
      .eq("id", memberId)
      .eq("organization_id", orgId);

    if (error) throw new Error(`[Supabase Tenancy] removeOrganizationMember failed: ${error.message}`);
    return true;
  }

  // 4. Brands
  async getBrands(orgId: string, accessToken?: string, isServiceRole?: boolean): Promise<Brand[]> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brands")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`[Supabase Tenancy] getBrands failed: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      primaryDomain: row.primary_domain,
      industry: row.industry,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getBrandById(brandId: string, accessToken?: string, isServiceRole?: boolean): Promise<Brand | null> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Tenancy] getBrandById failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      slug: data.slug,
      primaryDomain: data.primary_domain,
      industry: data.industry,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createBrand(
    orgId: string,
    name: string,
    slug: string,
    primaryDomain: string,
    industry?: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<Brand> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brands")
      .insert({
        organization_id: orgId,
        name,
        slug,
        primary_domain: primaryDomain,
        industry: industry || "Technology",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Tenancy] createBrand failed: ${error.message}`);

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      slug: data.slug,
      primaryDomain: data.primary_domain,
      industry: data.industry,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteBrand(brandId: string, accessToken?: string, isServiceRole?: boolean): Promise<boolean> {
    const client = this.getClient(accessToken, isServiceRole);
    const { error } = await client
      .from("brands")
      .delete()
      .eq("id", brandId);

    if (error) throw new Error(`[Supabase Tenancy] deleteBrand failed: ${error.message}`);
    return true;
  }

  // 5. Brand Members
  async getBrandMembers(brandId: string, accessToken?: string, isServiceRole?: boolean): Promise<BrandMember[]> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brand_members")
      .select("*, profiles(*)")
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Tenancy] getBrandMembers failed: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      brandId: row.brand_id,
      userId: row.user_id,
      role: row.role as BrandRole,
      createdAt: row.created_at,
      profile: row.profiles
        ? {
            id: row.profiles.id,
            email: row.profiles.email,
            fullName: row.profiles.full_name,
            avatarUrl: row.profiles.avatar_url,
            createdAt: row.profiles.created_at,
            updatedAt: row.profiles.updated_at,
          }
        : undefined,
    }));
  }

  async addBrandMember(
    brandId: string,
    targetUserId: string,
    role: BrandRole,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<BrandMember> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brand_members")
      .insert({
        brand_id: brandId,
        user_id: targetUserId,
        role,
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Tenancy] addBrandMember failed: ${error.message}`);

    return {
      id: data.id,
      brandId: data.brand_id,
      userId: data.user_id,
      role: data.role as BrandRole,
      createdAt: data.created_at,
    };
  }

  async updateBrandMember(
    brandId: string,
    memberId: string,
    newRole: BrandRole,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<BrandMember> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brand_members")
      .update({ role: newRole })
      .eq("id", memberId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Tenancy] updateBrandMember failed: ${error.message}`);

    return {
      id: data.id,
      brandId: data.brand_id,
      userId: data.user_id,
      role: data.role as BrandRole,
      createdAt: data.created_at,
    };
  }

  async removeBrandMember(
    brandId: string,
    memberId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<boolean> {
    const client = this.getClient(accessToken, isServiceRole);
    const { error } = await client
      .from("brand_members")
      .delete()
      .eq("id", memberId)
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Tenancy] removeBrandMember failed: ${error.message}`);
    return true;
  }

  // 6. Websites
  async getWebsites(brandId: string, accessToken?: string, isServiceRole?: boolean): Promise<Website[]> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("websites")
      .select("*")
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Tenancy] getWebsites failed: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      brandId: row.brand_id,
      domain: row.domain,
      sitemapUrl: row.sitemap_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createWebsite(
    brandId: string,
    domain: string,
    sitemapUrl?: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<Website> {
    const client = this.getClient(accessToken, isServiceRole);
    const brand = await this.getBrandById(brandId, accessToken, isServiceRole);
    if (!brand) throw new Error(`Brand ${brandId} not found`);

    const { data, error } = await client
      .from("websites")
      .insert({
        organization_id: brand.organizationId,
        brand_id: brandId,
        domain,
        sitemap_url: sitemapUrl,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Tenancy] createWebsite failed: ${error.message}`);

    return {
      id: data.id,
      organizationId: data.organization_id,
      brandId: data.brand_id,
      domain: data.domain,
      sitemapUrl: data.sitemap_url,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteWebsite(websiteId: string, accessToken?: string, isServiceRole?: boolean): Promise<boolean> {
    const client = this.getClient(accessToken, isServiceRole);
    const { error } = await client
      .from("websites")
      .delete()
      .eq("id", websiteId);

    if (error) throw new Error(`[Supabase Tenancy] deleteWebsite failed: ${error.message}`);
    return true;
  }

  // 7. Dynamic Tenancy Resolution & Live Role Authorization
  async resolveBrandOrganization(brandId: string, accessToken?: string, isServiceRole?: boolean): Promise<string | null> {
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("brands")
      .select("organization_id")
      .eq("id", brandId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Tenancy] resolveBrandOrganization failed: ${error.message}`);
    return data ? data.organization_id : null;
  }

  async getOrgRole(
    userId: string,
    organizationId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<OrgRole | null> {
    if (!userId || !organizationId) return null;
    const client = this.getClient(accessToken, isServiceRole);
    const { data, error } = await client
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`[Supabase Tenancy] getOrgRole failed: ${error.message}`);
    return data ? (data.role as OrgRole) : null;
  }

  async getBrandRole(
    userId: string,
    brandId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<BrandRole | null> {
    if (!userId || !brandId) return null;
    const client = this.getClient(accessToken, isServiceRole);

    // 1. Check explicit brand membership
    const { data: bm, error: bmError } = await client
      .from("brand_members")
      .select("role")
      .eq("brand_id", brandId)
      .eq("user_id", userId)
      .maybeSingle();

    if (bmError) throw new Error(`[Supabase Tenancy] getBrandRole failed: ${bmError.message}`);
    if (bm?.role) {
      return bm.role as BrandRole;
    }

    // 2. Org Owner/Admin inherit brand operational authority with "strategist" role
    const orgId = await this.resolveBrandOrganization(brandId, accessToken, isServiceRole);
    if (orgId) {
      const orgRole = await this.getOrgRole(userId, orgId, accessToken, isServiceRole);
      if (orgRole === "owner" || orgRole === "admin") {
        return "strategist";
      }
    }

    return null;
  }

  async canAccessBrand(
    userId: string,
    brandId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<boolean> {
    if (isServiceRole) return true;
    if (!userId || !brandId) return false;

    const client = this.getClient(accessToken, isServiceRole);

    // 1. Direct brand membership check
    const { data: bm, error: bmError } = await client
      .from("brand_members")
      .select("id")
      .eq("brand_id", brandId)
      .eq("user_id", userId)
      .maybeSingle();

    if (bmError) throw new Error(`[Supabase Tenancy] canAccessBrand failed: ${bmError.message}`);
    if (bm) return true;

    // 2. Check Org Owner / Admin authority inheritance across organization brands
    const orgId = await this.resolveBrandOrganization(brandId, accessToken, isServiceRole);
    if (!orgId) return false;

    const orgRole = await this.getOrgRole(userId, orgId, accessToken, isServiceRole);
    return orgRole === "owner" || orgRole === "admin";
  }

  async isBrandAccessible(
    userId: string,
    brandId: string,
    accessToken?: string,
    isServiceRole?: boolean
  ): Promise<boolean> {
    return this.canAccessBrand(userId, brandId, accessToken, isServiceRole);
  }
}

export const supabaseTenancyRepo = new SupabaseTenancyRepository();
