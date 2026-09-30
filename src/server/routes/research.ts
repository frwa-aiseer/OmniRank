import { Router, Request, Response } from "express";
import { authenticateRequest } from "../auth/middleware.ts";
import { createScopedUserSupabaseClient } from "../supabase/client.ts";
import { getResearchRepository } from "../research/repository.ts";
import { tenancyRepo } from "../auth/tenancy.ts";

export const researchRouter = Router();
researchRouter.use(authenticateRequest);

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

researchRouter.get("/:brandId/projects", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const projects = await repo.getProjects(brandId);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

researchRouter.post("/:brandId/handoff/:opportunityId", async (req: Request, res: Response) => {
  const { brandId, opportunityId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const projectId = await repo.handoffOpportunity(opportunityId, brandId);
    res.json({ projectId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

researchRouter.get("/:brandId/projects/:id", async (req: Request, res: Response) => {
  const { brandId, id } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const project = await repo.getProject(id, brandId);
    if (!project) return void res.status(404).json({ error: "Project not found" });
    const brief = await repo.getBriefForProject(id, brandId);
    res.json({ project, brief });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
