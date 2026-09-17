import { Router, Request, Response } from "express";
import { tenancyRepo, SecurityContext, TenancyAuthorizationError } from "../auth/tenancy.ts";

export const tenancyRouter = Router();

// Helper to extract security context from headers (or authorization bearer / mock context for local development)
function getSecurityContext(req: Request): SecurityContext {
  const authHeader = req.headers.authorization;
  const userIdHeader = req.headers["x-user-id"] as string | undefined;
  const isServiceRole = req.headers["x-service-role"] === "true";

  if (isServiceRole) {
    return {
      userId: userIdHeader || "00000000-0000-0000-0000-000000000000",
      isAuthenticated: true,
      isServiceRole: true,
    };
  }

  if (userIdHeader) {
    return {
      userId: userIdHeader,
      isAuthenticated: true,
    };
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    // In live environment with Supabase Auth, verify JWT token; in local preview extract subject or demo user
    const token = authHeader.replace("Bearer ", "");
    if (token === "anonymous" || !token) {
      return { isAuthenticated: false };
    }
    return {
      userId: token.length > 20 ? token.slice(0, 36) : "00000000-0000-4000-8000-000000000001",
      isAuthenticated: true,
    };
  }

  return { isAuthenticated: false };
}

// 1. Get organizations for current user
tenancyRouter.get("/organizations", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const orgs = tenancyRepo.getOrganizationsForUser(ctx);
    res.json({ organizations: orgs });
  } catch (err: any) {
    const status = err instanceof TenancyAuthorizationError && err.code === "UNAUTHENTICATED" ? 401 : 403;
    res.status(status).json({ error: err.message });
  }
});

// 2. Create an organization
tenancyRouter.post("/organizations", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }
    const result = tenancyRepo.createOrganization(ctx, name, slug);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err instanceof TenancyAuthorizationError && err.code === "UNAUTHENTICATED" ? 401 : 403;
    res.status(status).json({ error: err.message });
  }
});

// 3. Get members of an organization
tenancyRouter.get("/organizations/:orgId/members", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const members = tenancyRepo.getOrganizationMembers(ctx, req.params.orgId);
    res.json({ members });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 4. Add member to organization
tenancyRouter.post("/organizations/:orgId/members", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const { userId, role } = req.body;
    const member = tenancyRepo.addOrganizationMember(ctx, req.params.orgId, userId, role);
    res.status(201).json({ member });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 5. Get brands for an organization
tenancyRouter.get("/organizations/:orgId/brands", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const brands = tenancyRepo.getBrands(ctx, req.params.orgId);
    res.json({ brands });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 6. Create brand under an organization
tenancyRouter.post("/organizations/:orgId/brands", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const { name, slug, primaryDomain, industry } = req.body;
    if (!name || !slug || !primaryDomain) {
      return res.status(400).json({ error: "Name, slug, and primary domain are required" });
    }
    const brand = tenancyRepo.createBrand(ctx, req.params.orgId, name, slug, primaryDomain, industry);
    res.status(201).json({ brand });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 7. Get websites for a brand
tenancyRouter.get("/brands/:brandId/websites", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const websites = tenancyRepo.getWebsites(ctx, req.params.brandId);
    res.json({ websites });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// 8. Register website for a brand
tenancyRouter.post("/brands/:brandId/websites", (req: Request, res: Response) => {
  try {
    const ctx = getSecurityContext(req);
    const { domain, sitemapUrl } = req.body;
    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }
    const website = tenancyRepo.createWebsite(ctx, req.params.brandId, domain, sitemapUrl);
    res.status(201).json({ website });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});
