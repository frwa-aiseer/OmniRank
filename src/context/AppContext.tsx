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
  ArticleDocument,
  OpportunitySignal,
  GrowthMetrics,
} from "../types/index.ts";
import { supabase } from "../lib/supabase/client.ts";
import { isLiveBrowserSupabaseConfigured } from "../lib/env.ts";

interface AppContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  organizations: Organization[];
  currentOrg: Organization;
  setCurrentOrg: (org: Organization) => void;
  createOrg: (name: string, slug: string) => Promise<Organization>;
  deleteOrg: (orgId: string) => Promise<void>;
  brands: Brand[];
  currentBrand: Brand;
  setCurrentBrand: (brand: Brand) => void;
  createBrand: (name: string, slug: string, primaryDomain: string, industry?: string) => Promise<Brand>;
  deleteBrand: (brandId: string) => Promise<void>;
  websites: Website[];
  currentWebsite: Website | null;
  setCurrentWebsite: (website: Website | null) => void;
  createWebsite: (domain: string, sitemapUrl?: string) => Promise<Website>;
  deleteWebsite: (websiteId: string) => Promise<void>;
  currentUser: UserProfile;
  setCurrentUserRole: (orgRole: OrgRole, brandRole: BrandRole) => void;
  orgMembers: OrganizationMember[];
  brandMembers: BrandMember[];
  addOrgMember: (email: string, role: OrgRole) => void;
  removeOrgMember: (memberId: string) => Promise<void>;
  addBrandMember: (email: string, role: BrandRole) => void;
  removeBrandMember: (memberId: string) => Promise<void>;
  articles: ArticleDocument[];
  createArticle: (data: Omit<ArticleDocument, "id" | "brandId" | "createdAt" | "updatedAt">) => Promise<ArticleDocument>;
  updateArticle: (articleId: string, updates: Partial<ArticleDocument>) => Promise<void>;
  deleteArticle: (articleId: string) => Promise<void>;
  opportunities: OpportunitySignal[];
  createOpportunity: (data: Omit<OpportunitySignal, "id" | "brandId" | "createdAt">) => Promise<OpportunitySignal>;
  deleteOpportunity: (opportunityId: string) => Promise<void>;
  growthMetrics: GrowthMetrics;
  updateGrowthMetrics: (metrics: Partial<GrowthMetrics>) => void;
  connectSearchConsole: (propertyUrl: string) => void;
  disconnectSearchConsole: () => void;
  isAuthenticated: boolean;
  isLiveSupabase: boolean;
  signOut: () => Promise<void>;
  loadDemoWorkspace: () => void;
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
];

const placeholderEmptyOrg: Organization = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "No Organization",
  slug: "no-org",
  createdAt: new Date().toISOString(),
};

const placeholderEmptyBrand: Brand = {
  id: "00000000-0000-0000-0000-000000000000",
  organizationId: "00000000-0000-0000-0000-000000000000",
  name: "No Brand",
  slug: "no-brand",
  primaryDomain: "",
  createdAt: new Date().toISOString(),
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const isLiveSupabase = isLiveBrowserSupabaseConfigured();

  const [currentView, setCurrentView] = useState<AppView>(isLiveSupabase ? "auth" : "home");
  const [organizations, setOrganizations] = useState<Organization[]>(isLiveSupabase ? [] : initialOrgs);
  const [currentOrg, setCurrentOrg] = useState<Organization>(isLiveSupabase ? placeholderEmptyOrg : initialOrgs[0]);

  const [brands, setBrands] = useState<Brand[]>(isLiveSupabase ? [] : initialBrands);
  const [currentBrand, setCurrentBrand] = useState<Brand>(isLiveSupabase ? placeholderEmptyBrand : initialBrands[0]);

  const [websites, setWebsites] = useState<Website[]>(isLiveSupabase ? [] : initialWebsites);
  const [currentWebsite, setCurrentWebsite] = useState<Website | null>(isLiveSupabase ? null : initialWebsites[0]);

  const [currentUser, setCurrentUser] = useState<UserProfile>(
    isLiveSupabase
      ? {
          id: "",
          email: "",
          fullName: "Guest",
          orgRole: "member",
          brandRole: "viewer",
        }
      : defaultUser
  );

  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>(isLiveSupabase ? [] : initialOrgMembers);
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>(isLiveSupabase ? [] : initialBrandMembers);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!isLiveSupabase);

  // Content, Opportunities, and Growth state per brand
  const [articles, setArticles] = useState<ArticleDocument[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunitySignal[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetrics>({
    impressions: 0,
    clicks: 0,
    avgCtr: 0,
    impressionsDeltaPct: 0,
    clicksDeltaPct: 0,
    ctrDeltaPct: 0,
    isConnected: false,
  });

  // Load brand-scoped articles, opportunities, and growth metrics
  useEffect(() => {
    if (!currentBrand?.id || currentBrand.id === placeholderEmptyBrand.id) {
      setArticles([]);
      setOpportunities([]);
      setGrowthMetrics({
        impressions: 0,
        clicks: 0,
        avgCtr: 0,
        impressionsDeltaPct: 0,
        clicksDeltaPct: 0,
        ctrDeltaPct: 0,
        isConnected: false,
      });
      return;
    }

    try {
      const savedArticles = localStorage.getItem(`omnirank_articles_${currentBrand.id}`);
      if (savedArticles) {
        setArticles(JSON.parse(savedArticles));
      } else {
        setArticles([]);
      }

      const savedOpps = localStorage.getItem(`omnirank_opps_${currentBrand.id}`);
      if (savedOpps) {
        setOpportunities(JSON.parse(savedOpps));
      } else {
        setOpportunities([]);
      }

      const savedGrowth = localStorage.getItem(`omnirank_growth_${currentBrand.id}`);
      if (savedGrowth) {
        setGrowthMetrics(JSON.parse(savedGrowth));
      } else {
        setGrowthMetrics({
          impressions: 0,
          clicks: 0,
          avgCtr: 0,
          impressionsDeltaPct: 0,
          clicksDeltaPct: 0,
          ctrDeltaPct: 0,
          isConnected: false,
        });
      }
    } catch {
      setArticles([]);
      setOpportunities([]);
      setGrowthMetrics({
        impressions: 0,
        clicks: 0,
        avgCtr: 0,
        impressionsDeltaPct: 0,
        clicksDeltaPct: 0,
        ctrDeltaPct: 0,
        isConnected: false,
      });
    }
  }, [currentBrand?.id]);

  const createArticle = async (
    data: Omit<ArticleDocument, "id" | "brandId" | "createdAt" | "updatedAt">
  ): Promise<ArticleDocument> => {
    const newArticle: ArticleDocument = {
      ...data,
      id: crypto.randomUUID(),
      brandId: currentBrand.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newArticle, ...articles];
    setArticles(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_articles_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
    return newArticle;
  };

  const updateArticle = async (articleId: string, updates: Partial<ArticleDocument>): Promise<void> => {
    const updated = articles.map((a) =>
      a.id === articleId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    );
    setArticles(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_articles_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const deleteArticle = async (articleId: string): Promise<void> => {
    const updated = articles.filter((a) => a.id !== articleId);
    setArticles(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_articles_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const createOpportunity = async (
    data: Omit<OpportunitySignal, "id" | "brandId" | "createdAt">
  ): Promise<OpportunitySignal> => {
    const newOpp: OpportunitySignal = {
      ...data,
      id: crypto.randomUUID(),
      brandId: currentBrand.id,
      createdAt: new Date().toISOString(),
    };
    const updated = [newOpp, ...opportunities];
    setOpportunities(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_opps_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
    return newOpp;
  };

  const deleteOpportunity = async (opportunityId: string): Promise<void> => {
    const updated = opportunities.filter((o) => o.id !== opportunityId);
    setOpportunities(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_opps_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const updateGrowthMetrics = (metrics: Partial<GrowthMetrics>) => {
    const updated = { ...growthMetrics, ...metrics };
    setGrowthMetrics(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_growth_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const connectSearchConsole = (propertyUrl: string) => {
    const updated: GrowthMetrics = {
      ...growthMetrics,
      isConnected: true,
      connectedProperty: propertyUrl,
      lastSyncedAt: new Date().toISOString(),
    };
    setGrowthMetrics(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_growth_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const disconnectSearchConsole = () => {
    const updated: GrowthMetrics = {
      impressions: 0,
      clicks: 0,
      avgCtr: 0,
      impressionsDeltaPct: 0,
      clicksDeltaPct: 0,
      ctrDeltaPct: 0,
      isConnected: false,
    };
    setGrowthMetrics(updated);
    if (currentBrand?.id && currentBrand.id !== placeholderEmptyBrand.id) {
      try {
        localStorage.setItem(`omnirank_growth_${currentBrand.id}`, JSON.stringify(updated));
      } catch {}
    }
  };

  // Sync session and live tenancy when live Supabase is configured
  useEffect(() => {
    if (!isLiveSupabase) return;

    let isMounted = true;

    async function initAuth() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session?.user) {
          if (isMounted) {
            setIsAuthenticated(false);
            setCurrentView("auth");
          }
          return;
        }

        if (isMounted) {
          setIsAuthenticated(true);
          const userMeta = session.user.user_metadata || {};
          const profile: UserProfile = {
            id: session.user.id,
            email: session.user.email || "",
            fullName: userMeta.full_name || session.user.email?.split("@")[0] || "User",
            orgRole: "owner",
            brandRole: "strategist",
          };
          setCurrentUser(profile);
          if (currentView === "auth") {
            setCurrentView("home");
          }
        }

        // Fetch user's real organizations from live backend
        const orgRes = await fetch("/api/tenancy/organizations", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!orgRes.ok) return;
        const { organizations: userOrgs } = await orgRes.json();

        if (isMounted && Array.isArray(userOrgs)) {
          if (userOrgs.length > 0) {
            setOrganizations(userOrgs);
            const activeOrg = userOrgs[0];
            setCurrentOrg(activeOrg);

            // Fetch brands for active organization
            const brandsRes = await fetch(`/api/tenancy/organizations/${activeOrg.id}/brands`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (brandsRes.ok) {
              const { brands: orgBrands } = await brandsRes.json();
              if (Array.isArray(orgBrands) && orgBrands.length > 0) {
                setBrands(orgBrands);
                setCurrentBrand(orgBrands[0]);

                // Fetch websites for active brand
                const webRes = await fetch(`/api/tenancy/brands/${orgBrands[0].id}/websites`, {
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                });
                if (webRes.ok) {
                  const { websites: brandWebsites } = await webRes.json();
                  if (Array.isArray(brandWebsites)) {
                    setWebsites(brandWebsites);
                    setCurrentWebsite(brandWebsites[0] || null);
                  }
                }
              } else {
                setBrands([]);
                setCurrentBrand(placeholderEmptyBrand);
                setWebsites([]);
                setCurrentWebsite(null);
              }
            }
          } else {
            // Live user with 0 orgs yet
            setOrganizations([]);
            setCurrentOrg(placeholderEmptyOrg);
            setBrands([]);
            setCurrentBrand(placeholderEmptyBrand);
            setWebsites([]);
            setCurrentWebsite(null);
          }
        }
      } catch {
        // Leave in unauthenticated state
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentView("auth");
          setOrganizations([]);
          setCurrentOrg(placeholderEmptyOrg);
          setBrands([]);
          setCurrentBrand(placeholderEmptyBrand);
          setWebsites([]);
          setCurrentWebsite(null);
          setCurrentUser({
            id: "",
            email: "",
            fullName: "Guest",
            orgRole: "member",
            brandRole: "viewer",
          });
        }
      } else if (event === "SIGNED_IN") {
        initAuth();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isLiveSupabase]);

  // Auto-switch active brand when organization changes
  useEffect(() => {
    if (!currentOrg?.id) return;
    const orgBrands = (brands || []).filter((b) => b && b.organizationId === currentOrg.id);
    if (orgBrands.length > 0) {
      if (!orgBrands.some((b) => b?.id === currentBrand?.id)) {
        setCurrentBrand(orgBrands[0]);
      }
    } else if (!currentBrand || currentBrand.id !== placeholderEmptyBrand.id) {
      setCurrentBrand(placeholderEmptyBrand);
    }
  }, [currentOrg?.id, brands, currentBrand?.id]);

  // Auto-switch website when brand changes
  useEffect(() => {
    if (!currentBrand?.id) {
      setCurrentWebsite(null);
      return;
    }
    const brandWebsites = (websites || []).filter((w) => w && w.brandId === currentBrand.id);
    setCurrentWebsite(brandWebsites.length > 0 ? brandWebsites[0] : null);
  }, [currentBrand?.id, websites]);

  const signOut = async () => {
    if (isLiveSupabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setCurrentView("auth");
  };

  const loadDemoWorkspace = () => {
    setOrganizations(initialOrgs);
    setCurrentOrg(initialOrgs[0]);
    setBrands(initialBrands);
    setCurrentBrand(initialBrands[0]);
    setWebsites(initialWebsites);
    setCurrentWebsite(initialWebsites[0] || null);
    setCurrentUser(defaultUser);
    setCurrentView("home");
  };

  const createOrg = async (name: string, slug: string): Promise<Organization> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/tenancy/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create organization (${res.status})`);
      }
      const data = await res.json();
      const organization: Organization = data.organization || data.org;
      if (!organization) {
        throw new Error("Invalid organization data received from server");
      }
      setOrganizations((prev) => [...prev.filter((o) => o?.id !== organization.id), organization]);
      setCurrentOrg(organization);
      return organization;
    }

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

  const deleteOrg = async (orgId: string): Promise<void> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/tenancy/organizations/${orgId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete organization (${res.status})`);
      }
    }

    const remainingOrgs = organizations.filter((o) => o.id !== orgId);
    setOrganizations(remainingOrgs);
    if (currentOrg?.id === orgId) {
      const nextOrg = remainingOrgs[0] || placeholderEmptyOrg;
      setCurrentOrg(nextOrg);
      const remainingBrands = brands.filter((b) => b.organizationId === nextOrg.id);
      setBrands(remainingBrands);
      const nextBrand = remainingBrands[0] || placeholderEmptyBrand;
      setCurrentBrand(nextBrand);
    }
  };

  const createBrand = async (name: string, slug: string, primaryDomain: string, industry?: string): Promise<Brand> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const orgId = currentOrg?.id || placeholderEmptyOrg.id;
      const res = await fetch(`/api/tenancy/organizations/${orgId}/brands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug, primaryDomain, industry }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create brand (${res.status})`);
      }
      const data = await res.json();
      const brand: Brand = data.brand;
      if (!brand) {
        throw new Error("Invalid brand data received from server");
      }
      setBrands((prev) => [...prev.filter((b) => b?.id !== brand.id), brand]);
      setCurrentBrand(brand);
      return brand;
    }

    const newBrand: Brand = {
      id: crypto.randomUUID(),
      organizationId: currentOrg?.id || placeholderEmptyOrg.id,
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

  const deleteBrand = async (brandId: string): Promise<void> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/tenancy/brands/${brandId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete brand (${res.status})`);
      }
    }

    const remainingBrands = brands.filter((b) => b.id !== brandId);
    setBrands(remainingBrands);
    setWebsites((prev) => prev.filter((w) => w.brandId !== brandId));
    if (currentBrand?.id === brandId) {
      const nextBrand = remainingBrands.find((b) => b.organizationId === currentOrg?.id) || remainingBrands[0] || placeholderEmptyBrand;
      setCurrentBrand(nextBrand);
    }
  };

  const createWebsite = async (domain: string, sitemapUrl?: string): Promise<Website> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const brandId = currentBrand?.id || placeholderEmptyBrand.id;
      const res = await fetch(`/api/tenancy/brands/${brandId}/websites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain, sitemapUrl }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to register website (${res.status})`);
      }
      const data = await res.json();
      const website: Website = data.website;
      if (!website) {
        throw new Error("Invalid website data received from server");
      }
      setWebsites((prev) => [...prev.filter((w) => w?.id !== website.id), website]);
      setCurrentWebsite(website);
      return website;
    }

    const newWebsite: Website = {
      id: crypto.randomUUID(),
      organizationId: currentOrg?.id || placeholderEmptyOrg.id,
      brandId: currentBrand?.id || placeholderEmptyBrand.id,
      domain,
      sitemapUrl,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    setWebsites((prev) => [...prev, newWebsite]);
    setCurrentWebsite(newWebsite);
    return newWebsite;
  };

  const deleteWebsite = async (websiteId: string): Promise<void> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/tenancy/websites/${websiteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete website (${res.status})`);
      }
    }

    const remainingWebsites = websites.filter((w) => w.id !== websiteId);
    setWebsites(remainingWebsites);
    if (currentWebsite?.id === websiteId) {
      const nextWebsite = remainingWebsites.find((w) => w.brandId === currentBrand?.id) || null;
      setCurrentWebsite(nextWebsite);
    }
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

  const removeOrgMember = async (memberId: string): Promise<void> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/tenancy/organizations/${currentOrg?.id}/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove member (${res.status})`);
      }
    }

    setOrgMembers((prev) => prev.filter((m) => m.id !== memberId));
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

  const removeBrandMember = async (memberId: string): Promise<void> => {
    if (isLiveSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/tenancy/brands/${currentBrand?.id}/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove brand member (${res.status})`);
      }
    }

    setBrandMembers((prev) => prev.filter((m) => m.id !== memberId));
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
        deleteOrg,
        brands,
        currentBrand,
        setCurrentBrand,
        createBrand,
        deleteBrand,
        websites,
        currentWebsite,
        setCurrentWebsite,
        createWebsite,
        deleteWebsite,
        currentUser,
        setCurrentUserRole,
        orgMembers,
        brandMembers,
        addOrgMember,
        removeOrgMember,
        addBrandMember,
        removeBrandMember,
        articles,
        createArticle,
        updateArticle,
        deleteArticle,
        opportunities,
        createOpportunity,
        deleteOpportunity,
        growthMetrics,
        updateGrowthMetrics,
        connectSearchConsole,
        disconnectSearchConsole,
        isAuthenticated,
        isLiveSupabase,
        signOut,
        loadDemoWorkspace,
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
