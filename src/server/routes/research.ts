import { Router, Request, Response } from "express";
import { authenticateRequest } from "../auth/middleware.ts";
import { createScopedUserSupabaseClient } from "../supabase/client.ts";
import { getResearchRepository } from "../research/repository.ts";
import { getResearchEngine } from "../research/engine.ts";
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

// ... PROJECTS ...
researchRouter.get("/:brandId/projects", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).getProjects(req.params.brandId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/projects", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).createManualProject(req.params.brandId, req.body.orgId, req.body.title, req.body.objective, req.body.mode));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.get("/:brandId/projects/:id", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    const repo = getResearchRepository(createScopedUserSupabaseClient(req.token));
    const project = await repo.getProject(req.params.id, req.params.brandId);
    if (!project) return void res.status(404).json({ error: "Project not found" });
    res.json({ project, brief: await repo.getBriefForProject(req.params.id, req.params.brandId) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/handoff/:opportunityId", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json({ projectId: await getResearchRepository(createScopedUserSupabaseClient(req.token)).handoffOpportunity(req.params.opportunityId, req.params.brandId) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ... QUESTIONS ...
researchRouter.get("/:brandId/projects/:projectId/questions", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).listQuestions(req.params.projectId, req.params.brandId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/projects/:projectId/questions", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).addQuestion(req.params.projectId, req.params.brandId, req.body.orgId, req.body.text));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.put("/:brandId/projects/:projectId/questions/:id", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).updateQuestion(req.params.id, req.params.brandId, req.body));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ... SOURCES ...
researchRouter.get("/:brandId/projects/:projectId/sources", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).listSources(req.params.projectId, req.params.brandId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/projects/:projectId/sources", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).addSource(req.params.projectId, req.params.brandId, req.body.orgId, req.body.classification, req.body.title, req.body.url));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ... FINDINGS ...
researchRouter.get("/:brandId/projects/:projectId/findings", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).listFindings(req.params.projectId, req.params.brandId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/projects/:projectId/findings", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).addFinding(req.params.projectId, req.params.brandId, req.body.orgId, req.body.text, req.body.questionId, req.body.sourceRefs));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/projects/:projectId/findings/:id/review", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    await getResearchRepository(createScopedUserSupabaseClient(req.token)).reviewFinding(req.params.id, req.params.brandId, req.body.supportStatus, req.body.confidenceScore, req.body.notes);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ... BRIEF ...
researchRouter.post("/:brandId/projects/:projectId/brief/prepare", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchEngine(createScopedUserSupabaseClient(req.token)).prepareBrief(req.params.projectId, req.params.brandId, req.body.orgId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.put("/:brandId/projects/:projectId/brief", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    res.json(await getResearchRepository(createScopedUserSupabaseClient(req.token)).saveBrief(req.params.projectId, req.params.brandId, req.body.orgId, req.body));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

researchRouter.post("/:brandId/projects/:projectId/brief/:id/review", async (req: Request, res: Response) => {
  const auth = await resolveAuth(req, req.params.brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });
  try {
    await getResearchRepository(createScopedUserSupabaseClient(req.token)).reviewBrief(req.params.id, req.body.status, req.body.notes);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
