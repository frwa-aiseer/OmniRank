/**
 * OR-P10 — Publishing API Routes
 *
 * All routes are brand-scoped and authenticated.
 * Credentials are kept server-side only; never returned to client.
 */

import { Router, Request, Response } from "express";
import { authenticateRequest } from "../auth/middleware.ts";
import { tenancyRepo } from "../auth/tenancy.ts";
import { createScopedUserSupabaseClient, getAdminSupabaseClient } from "../supabase/client.ts";
import { PublishingService } from "../publishing/service.ts";

export const publishingRouter = Router();
publishingRouter.use(authenticateRequest);

async function resolveAuth(req: Request, brandId: string) {
  const ctx = req.securityContext;
  if (!ctx?.isAuthenticated || !ctx.userId) {
    return { error: "Authentication required", status: 401 as const };
  }
  const canAccess = await tenancyRepo.canAccessBrandAsync(brandId, ctx.userId, req.token, ctx.isServiceRole);
  if (!canAccess) {
    return { error: "Forbidden: Not authorized for this brand", status: 403 as const };
  }
  return { error: null, status: 200 as const, userId: ctx.userId };
}

// ---------------------------------------------------------------------------
// 1. List integrations for brand
// ---------------------------------------------------------------------------
publishingRouter.get("/:brandId/integrations", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const { data, error } = await userClient
      .from("integrations")
      .select("id, name, type, status, config, created_at, updated_at")
      .eq("brand_id", brandId);

    if (error) throw error;
    res.json({ integrations: data ?? [] });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// 2. Register or update WordPress integration
// ---------------------------------------------------------------------------
publishingRouter.post("/:brandId/integrations/wordpress", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { name, endpointUrl, username, appPassword, websiteId, organizationId } = req.body as {
    name: string;
    endpointUrl: string;
    username: string;
    appPassword: string;
    websiteId?: string;
    organizationId?: string;
  };

  if (!endpointUrl || !username || !appPassword) {
    return void res.status(400).json({ error: "endpointUrl, username, and appPassword are required" });
  }

  try {
    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    const userClient = createScopedUserSupabaseClient(req.token);
    const adminClient = getAdminSupabaseClient();
    const service = new PublishingService(userClient, adminClient);

    const integration = await service.saveWordPressIntegration({
      brandId,
      organizationId: orgId,
      websiteId,
      name: name || "WordPress Site",
      endpointUrl,
      username,
      appPassword,
    });

    res.json({ integration });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// 3. Test integration connection
// ---------------------------------------------------------------------------
publishingRouter.post("/:brandId/integrations/:id/test", async (req: Request, res: Response) => {
  const { brandId, id: integrationId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const adminClient = getAdminSupabaseClient();
    const service = new PublishingService(userClient, adminClient);

    const result = await service.testIntegration(integrationId, brandId);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// 4. Publish article version to CMS
// ---------------------------------------------------------------------------
publishingRouter.post("/:brandId/articles/:articleId/publish", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { versionId, integrationId, status, categories, organizationId } = req.body as {
    versionId: string;
    integrationId: string;
    status?: "draft" | "publish" | "future";
    categories?: number[];
    organizationId?: string;
  };

  if (!versionId || !integrationId) {
    return void res.status(400).json({ error: "versionId and integrationId are required" });
  }

  try {
    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    const userClient = createScopedUserSupabaseClient(req.token);
    const adminClient = getAdminSupabaseClient();
    const service = new PublishingService(userClient, adminClient);

    const result = await service.publishArticle({
      articleId,
      versionId,
      brandId,
      organizationId: orgId,
      integrationId,
      status: status ?? "draft",
      categories,
    });

    res.json({ success: true, ...result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// 5. Get CMS Content Mappings for article
// ---------------------------------------------------------------------------
publishingRouter.get("/:brandId/articles/:articleId/mappings", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const { data, error } = await userClient
      .from("cms_content_mappings")
      .select("*")
      .eq("article_id", articleId)
      .eq("brand_id", brandId);

    if (error) throw error;
    res.json({ mappings: data ?? [] });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});
