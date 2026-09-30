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

// ------------------------------------------------------------------
// PROJECTS
// ------------------------------------------------------------------
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

researchRouter.post("/:brandId/projects", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const { title, objective, mode, orgId } = req.body;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const project = await repo.createManualProject(brandId, orgId, title, objective, mode);
    res.json(project);
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

// ------------------------------------------------------------------
// QUESTIONS
// ------------------------------------------------------------------
researchRouter.get("/:brandId/projects/:projectId/questions", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const questions = await repo.listQuestions(projectId, brandId);
    res.json(questions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

researchRouter.post("/:brandId/projects/:projectId/questions", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const { orgId, text } = req.body;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const question = await repo.addQuestion(projectId, brandId, orgId, text);
    res.json(question);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// SOURCES
// ------------------------------------------------------------------
researchRouter.get("/:brandId/projects/:projectId/sources", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const sources = await repo.listSources(projectId, brandId);
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

researchRouter.post("/:brandId/projects/:projectId/sources", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const { orgId, classification, title, url } = req.body;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const source = await repo.addSource(projectId, brandId, orgId, classification, title, url);
    res.json(source);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// FINDINGS
// ------------------------------------------------------------------
researchRouter.get("/:brandId/projects/:projectId/findings", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const findings = await repo.listFindings(projectId, brandId);
    res.json(findings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

researchRouter.post("/:brandId/projects/:projectId/findings", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const { orgId, text, questionId, sourceRefs } = req.body;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const repo = getResearchRepository(client);
    const finding = await repo.addFinding(projectId, brandId, orgId, text, questionId, sourceRefs);
    res.json(finding);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// BRIEF
// ------------------------------------------------------------------
researchRouter.post("/:brandId/projects/:projectId/brief/prepare", async (req: Request, res: Response) => {
  const { brandId, projectId } = req.params;
  const { orgId } = req.body;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const client = createScopedUserSupabaseClient(req.token);
    const engine = getResearchEngine(client);
    const brief = await engine.prepareBrief(projectId, brandId, orgId);
    res.json(brief);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
