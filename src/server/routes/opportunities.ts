import { Router, Request, Response } from "express";
import { authenticateRequest } from "../auth/middleware.ts";
import { tenancyRepo } from "../auth/tenancy.ts";
import { getOpportunityRepository } from "../opportunity/repository.ts";
import { getOpportunityEngine } from "../opportunity/engine.ts";
import { createScopedUserSupabaseClient } from "../supabase/client.ts";

const router = Router();
router.use(authenticateRequest);

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

router.get("/:brandId", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const { status } = req.query;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const opps = await getOpportunityRepository(createScopedUserSupabaseClient(req.token)).listOpportunities(brandId, status as any);
    res.json({ opportunities: opps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:brandId/:id", async (req: Request, res: Response) => {
  const { brandId, id } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const opp = await getOpportunityRepository(createScopedUserSupabaseClient(req.token)).getOpportunity(id, brandId);
    if (!opp) return void res.status(404).json({ error: "Opportunity not found" });
    res.json({ opportunity: opp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:brandId/generate", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const orgId = await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token);
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    // Using user-scoped client to respect RLS during generation reads/writes
    const client = createScopedUserSupabaseClient(req.token);
    const engine = getOpportunityEngine(client);
    const created = await engine.generateOpportunities(brandId, orgId);
    
    res.json({ success: true, createdCount: created.length, created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:brandId/:id/accept", async (req: Request, res: Response) => {
  const { brandId, id } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const opp = await getOpportunityRepository(createScopedUserSupabaseClient(req.token)).updateStatus(id, brandId, "accepted");
    res.json({ opportunity: opp });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

router.post("/:brandId/:id/dismiss", async (req: Request, res: Response) => {
  const { brandId, id } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const opp = await getOpportunityRepository(createScopedUserSupabaseClient(req.token)).updateStatus(id, brandId, "dismissed");
    res.json({ opportunity: opp });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

router.post("/:brandId/:id/create-article", async (req: Request, res: Response) => {
  const { brandId, id } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    
    // Call the atomic handoff RPC
    const { data: articleId, error } = await client.rpc("handoff_opportunity_to_article", {
      p_opportunity_id: id,
      p_brand_id: brandId
    });

    if (error) {
      if (error.message.includes("does not support")) return void res.status(400).json({ error: error.message });
      if (error.message.includes("not found")) return void res.status(404).json({ error: error.message });
      throw new Error(error.message);
    }

    // Return the updated opportunity
    const oppRepo = getOpportunityRepository(client);
    const opp = await oppRepo.getOpportunity(id, brandId);
    res.json({ opportunity: opp, articleId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:brandId/:id/complete", async (req: Request, res: Response) => {
  const { brandId, id } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { articleId } = req.body;

  try {
    const opp = await getOpportunityRepository(createScopedUserSupabaseClient(req.token)).updateStatus(id, brandId, "completed", articleId);
    res.json({ opportunity: opp });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

export default router;
