import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  AppView,
  Organization,
  Brand,
  Website,
  UserProfile,
  OrganizationMember,
  BrandMember,
  OrgRole,
  BrandRole,
} from "../types/index.ts";

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  organizations: Organization[];
  currentOrg: Organization;
  setCurrentOrg: (org: Organization) => void;
  createOrg: (name: string, slug: string) => Promise<Organization>;
  brands: Brand[];
  currentBrand: Brand;
  setCurrentBrand: (brand: Brand) => void;
  createBrand: (name: string, slug: string, primaryDomain: string, industry?: string) => Promise<Brand>;
  websites: Website[];
  currentWebsite: Website | null;
  setCurrentWebsite: (website: Website | null) => void;
  createWebsite: (domain: string, sitemapUrl?: string) => Promise<Website>;
  currentUser: UserProfile;
  setCurrentUserRole: (orgRole: OrgRole, brandRole: BrandRole) => void;
  orgMembers: OrganizationMember[];
  brandMembers: BrandMember[];
  addOrgMember: (email: string, role: OrgRole) => void;
  addBrandMember: (email: string, role: BrandRole) => void;
}

const defaultUser: UserProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "alex@omnirank.ai",
  fullName: "Alex Rivera",
  orgRole: "owner",
  brandRole: "strategist",
};

const initialOrgs: Organization[] = [
  {
    id: "11111111-1111-4000-8000-111111111111",
    name: "Acme Growth Media",
    slug: "acme-growth-media",
    createdBy: defaultUser.id,
    createdAt: "2026-01-15T08:00:00Z",
  },
  {
    id: "22222222-2222-4000-8000-222222222222",
    name: "Nexus Ventures Corp",
    slug: "nexus-ventures",
    createdBy: defaultUser.id,
    createdAt: "2026-02-10T11:00:00Z",
  },
];

const initialBrands: Brand[] = [
  {
    id: "33333333-3333-4000-8000-333333333331",
    organizationId: "11111111-1111-4000-8000-111111111111",
    name: "Acme Cloud",
    slug: "acme-cloud",
    primaryDomain: "acmecloud.io",
    industry: "B2B SaaS / DevOps",
    createdAt: "2026-01-15T08:30:00Z",
  },
  {
    id: "33333333-3333-4000-8000-333333333332",
    organizationId: "11111111-1111-4000-8000-111111111111",
    name: "Acme Security",
    slug: "acme-security",
    primaryDomain: "acmesec.com",
    industry: "Cybersecurity",
    createdAt: "2026-02-01T09:00:00Z",
  },
  {
    id: "33333333-3333-4000-8000-333333333333",
    organizationId: "22222222-2222-4000-8000-222222222222",
    name: "Nexus AI Lab",
    slug: "nexus-ai",
    primaryDomain: "nexusai.tech",
    industry: "Artificial Intelligence",
    createdAt: "2026-02-10T11:30:00Z",
  },
];

const initialWebsites: Website[] = [
  {
    id: "55555555-5555-4000-8000-555555555551",
    organizationId: "11111111-1111-4000-8000-111111111111",
    brandId: "33333333-3333-4000-8000-333333333331",
    domain: "acmecloud.io",
    sitemapUrl: "https://acmecloud.io/sitemap.xml",
    status: "active",
    createdAt: "2026-01-15T09:00:00Z",
  },
  {
    id: "55555555-5555-4000-8000-555555555552",
    organizationId: "11111111-1111-4000-8000-111111111111",
    brandId: "33333333-3333-4000-8000-333333333332",
    domain: "acmesec.com",
    sitemapUrl: "https://acmesec.com/sitemap.xml",
    status: "active",
    createdAt: "2026-02-01T09:30:00Z",
  },
];

const initialOrgMembers: OrganizationMember[] = [
  {
    id: "om-01",
    organizationId: "11111111-1111-4000-8000-111111111111",
    userId: defaultUser.id,
    role: "owner",
    createdAt: "2026-01-15T08:00:00Z",
    profile: {
      id: defaultUser.id,
      email: defaultUser.email,
      fullName: defaultUser.fullName,
      createdAt: "2026-01-15T08:00:00Z",
      updatedAt: "2026-01-15T08:00:00Z",
    },
  },
  {
    id: "om-02",
    organizationId: "11111111-1111-4000-8000-111111111111",
    userId: "usr-team-02",
    role: "member",
    createdAt: "2026-01-20T10:00:00Z",
    profile: {
      id: "usr-team-02",
      email: "sarah.chen@acme.com",
      fullName: "Sarah Chen",
      createdAt: "2026-01-20T10:00:00Z",
      updatedAt: "2026-01-20T10:00:00Z",
    },
  },
];

const initialBrandMembers: BrandMember[] = [
  {
    id: "bm-01",
    brandId: "33333333-3333-4000-8000-333333333331",
    userId: defaultUser.id,
    role: "strategist",
    createdAt: "2026-01-15T08:30:00Z",
    profile: {
      id: defaultUser.id,
      email: defaultUser.email,
      fullName: defaultUser.fullName,
      createdAt: "2026-01-15T08:00:00Z",
      updatedAt: "2026-01-15T08:00:00Z",
    },
  },
  {
    id: "bm-02",
    brandId: "33333333-3333-4000-8000-333333333331",
    userId: "usr-team-02",
    role: "writer",
    createdAt: "2026-01-20T10:30:00Z",
    profile: {
      id: "usr-team-02",
      email: "sarah.chen@acme.com",
      fullName: "Sarah Chen",
      createdAt: "2026-01-20T10:00:00Z",
      updatedAt: "2026-01-20T10:00:00Z",
    },
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrgs);
  const [currentOrg, setCurrentOrg] = useState<Organization>(initialOrgs[0]);

  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [currentBrand, setCurrentBrand] = useState<Brand>(initialBrands[0]);

  const [websites, setWebsites] = useState<Website[]>(initialWebsites);
  const [currentWebsite, setCurrentWebsite] = useState<Website | null>(initialWebsites[0]);

  const [currentUser, setCurrentUser] = useState<UserProfile>(defaultUser);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>(initialOrgMembers);
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>(initialBrandMembers);

  // Auto-switch active brand when organization changes
  useEffect(() => {
    const orgBrands = brands.filter((b) => b.organizationId === currentOrg.id);
    if (orgBrands.length > 0) {
      if (!orgBrands.some((b) => b.id === currentBrand.id)) {
        setCurrentBrand(orgBrands[0]);
      }
    }
  }, [currentOrg, brands, currentBrand.id]);

  // Auto-switch website when brand changes
  useEffect(() => {
    const brandWebsites = websites.filter((w) => w.brandId === currentBrand.id);
    setCurrentWebsite(brandWebsites.length > 0 ? brandWebsites[0] : null);
  }, [currentBrand, websites]);

  const createOrg = async (name: string, slug: string): Promise<Organization> => {
    const newOrg: Organization = {
      id: crypto.randomUUID(),
      name,
      slug,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    setOrganizations((prev) => [...prev, newOrg]);
    setCurrentOrg(newOrg);
    return newOrg;
  };

  const createBrand = async (name: string, slug: string, primaryDomain: string, industry?: string): Promise<Brand> => {
    const newBrand: Brand = {
      id: crypto.randomUUID(),
      organizationId: currentOrg.id,
      name,
      slug,
      primaryDomain,
      industry,
      createdAt: new Date().toISOString(),
    };
    setBrands((prev) => [...prev, newBrand]);
    setCurrentBrand(newBrand);
    return newBrand;
  };

  const createWebsite = async (domain: string, sitemapUrl?: string): Promise<Website> => {
    const newWebsite: Website = {
      id: crypto.randomUUID(),
      organizationId: currentOrg.id,
      brandId: currentBrand.id,
      domain,
      sitemapUrl,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    setWebsites((prev) => [...prev, newWebsite]);
    setCurrentWebsite(newWebsite);
    return newWebsite;
  };

  const setCurrentUserRole = (orgRole: OrgRole, brandRole: BrandRole) => {
    setCurrentUser((prev) => ({
      ...prev,
      orgRole,
      brandRole,
    }));
  };

  const addOrgMember = (email: string, role: OrgRole) => {
    const newMember: OrganizationMember = {
      id: crypto.randomUUID(),
      organizationId: currentOrg.id,
      userId: crypto.randomUUID(),
      role,
      createdAt: new Date().toISOString(),
      profile: {
        id: crypto.randomUUID(),
        email,
        fullName: email.split("@")[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    setOrgMembers((prev) => [...prev, newMember]);
  };

  const addBrandMember = (email: string, role: BrandRole) => {
    const newMember: BrandMember = {
      id: crypto.randomUUID(),
      brandId: currentBrand.id,
      userId: crypto.randomUUID(),
      role,
      createdAt: new Date().toISOString(),
      profile: {
        id: crypto.randomUUID(),
        email,
        fullName: email.split("@")[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    setBrandMembers((prev) => [...prev, newMember]);
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        organizations,
        currentOrg,
        setCurrentOrg,
        createOrg,
        brands,
        currentBrand,
        setCurrentBrand,
        createBrand,
        websites,
        currentWebsite,
        setCurrentWebsite,
        createWebsite,
        currentUser,
        setCurrentUserRole,
        orgMembers,
        brandMembers,
        addOrgMember,
        addBrandMember,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
