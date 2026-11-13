/**
 * OR-P05 — Article API Routes
 *
 * All routes are authenticated via existing authenticateRequest middleware.
 * All operations are brand-scoped; cross-brand access is rejected.
 */

import { Router, Request, Response } from "express";
import { authenticateRequest } from "../auth/middleware.ts";
import { tenancyRepo } from "../auth/tenancy.ts";
import { getArticleRepository } from "../article/repository.ts";
import {
  validateArticleEnvelope,
  validateBlockReplacement,
  EnvelopeIdentityCheck,
} from "../article/schema-validator.ts";
import { Article, ArticleEnvelope, ArticleBlock } from "../../types/article.ts";
import { createScopedUserSupabaseClient, getAdminSupabaseClient } from "../supabase/client.ts";
import { getOmniRouter } from "../omnirouter/router.ts";
import { generateArticleFromBrief, rewriteBlock } from "../generation/content-generator.ts";
import {
  runSeoAudit,
  runGeoAudit,
  runBrandAudit,
  saveSeoAudit,
  saveGeoAudit,
  saveBrandAudit,
} from "../quality/audits.ts";

const router = Router();
router.use(authenticateRequest);

// ---- Auth helper (same pattern as brand-brain.ts) ----
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

function getRepo(req: Request) {
  return getArticleRepository(req.token);
}

// ============================================================================
// 1. List articles
// ============================================================================
router.get("/:brandId", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const articles = await getRepo(req).listArticles(brandId);
    res.json({ articles });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 2. Get single article
// ============================================================================
router.get("/:brandId/:articleId", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const article = await getRepo(req).getArticle(articleId, brandId);
    if (!article) return void res.status(404).json({ error: "Article not found" });
    res.json({ article });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 3. Create article
// ============================================================================
router.post("/:brandId", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { organizationId, websiteId, title, slug, locale } = req.body as {
    organizationId: string;
    websiteId?: string;
    title: string;
    slug: string;
    locale?: string;
  };

  try {
    const orgId = organizationId || await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token);
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId for brand" });

    const article = await getRepo(req).createArticle({
      organizationId: orgId,
      brandId,
      websiteId,
      schemaVersion: "1.0",
      status: "idea" as Article["status"],
      title: title ?? "",
      slug: slug ?? "",
      locale: locale ?? "en",
      seo: {},
      geo: {},
      metadata: {},
      sources: [],
      relationships: [],
      createdBy: auth.userId!,
    });
    res.status(201).json({ article });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 4. Autosave working document
// ============================================================================
router.put("/:brandId/:articleId/autosave", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { content, organizationId } = req.body as { content: ArticleEnvelope; organizationId: string };
  if (!content) return void res.status(400).json({ error: "content is required" });

  // Validate envelope + enforce identity: content.articleId must match route, content.brandId must match route
  const identity: EnvelopeIdentityCheck = { expectedArticleId: articleId, expectedBrandId: brandId };
  const validation = validateArticleEnvelope(content, identity);
  if (!validation.valid) {
    return void res.status(422).json({ error: "Schema validation failed", errors: validation.errors });
  }

  try {
    const doc = await getRepo(req).autosaveWorkingDocument(
      articleId, brandId, organizationId, content, auth.userId!
    );
    res.json({ workingDocument: doc });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes("Cross-brand reference rejected")) {
      return void res.status(422).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
});

// ============================================================================
// 5. Get working document
// ============================================================================
router.get("/:brandId/:articleId/working-document", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const doc = await getRepo(req).getWorkingDocument(articleId, brandId);
    if (!doc) return void res.status(404).json({ error: "Working document not found" });
    res.json({ workingDocument: doc });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 6. Create version (milestone)
// ============================================================================
router.post("/:brandId/:articleId/versions", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { content, label, organizationId } = req.body as {
    content: ArticleEnvelope;
    label: string;
    organizationId: string;
  };

  const identity: EnvelopeIdentityCheck = { expectedArticleId: articleId, expectedBrandId: brandId };
  const validation = validateArticleEnvelope(content, identity);
  if (!validation.valid) {
    return void res.status(422).json({ error: "Schema validation failed", errors: validation.errors });
  }

  try {
    const version = await getRepo(req).createVersion(
      articleId, brandId, organizationId, content, label ?? "Milestone", auth.userId!
    );
    res.status(201).json({ version });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes("Cross-brand reference rejected")) {
      return void res.status(422).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
});

// ============================================================================
// 7. List versions
// ============================================================================
router.get("/:brandId/:articleId/versions", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const versions = await getRepo(req).listVersions(articleId, brandId);
    res.json({ versions });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 8. Restore version
// ============================================================================
router.post("/:brandId/:articleId/versions/:versionId/restore", async (req: Request, res: Response) => {
  const { brandId, articleId, versionId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { organizationId } = req.body as { organizationId: string };

  try {
    const doc = await getRepo(req).restoreVersion(
      articleId, brandId, organizationId, versionId, auth.userId!
    );
    res.json({ workingDocument: doc, restored: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 9. Replace a single block (AI or manual)
// ============================================================================
router.put("/:brandId/:articleId/blocks/:blockId", async (req: Request, res: Response) => {
  const { brandId, articleId, blockId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { block, organizationId, aiTaskCode, aiModelHint, aiPromptSummary } = req.body as {
    block: ArticleBlock;
    organizationId: string;
    aiTaskCode?: string;
    aiModelHint?: string;
    aiPromptSummary?: string;
  };

  if (!block) return void res.status(400).json({ error: "block is required" });

  // Validate only the replacement block
  const workingDoc = await getRepo(req).getWorkingDocument(articleId, brandId);
  if (!workingDoc) return void res.status(404).json({ error: "Working document not found" });

  const existingIds = new Set(workingDoc.content.document.blocks.map((b) => b.id));
  // Pass blockId as targetBlockId — validates newBlock.id must equal route blockId
  const blockErrors = validateBlockReplacement(block, existingIds, blockId);
  if (blockErrors.length > 0) {
    return void res.status(422).json({ error: "Block validation failed", errors: blockErrors });
  }

  try {
    const updatedDoc = await getRepo(req).replaceBlock(
      articleId, brandId, organizationId, blockId, block, auth.userId!,
      aiTaskCode, aiModelHint, aiPromptSummary
    );
    res.json({ workingDocument: updatedDoc });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg.includes("Cross-brand reference rejected")) {
      return void res.status(422).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
});

// ============================================================================
// 10. List block operations (provenance)
// ============================================================================
router.get("/:brandId/:articleId/block-operations", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const ops = await getRepo(req).listBlockOperations(articleId, brandId);
    res.json({ operations: ops });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 11. Review article (Approve / Reject)
// ============================================================================
router.post("/:brandId/:articleId/review", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { decision, versionId } = req.body as { decision: "approved" | "rejected"; versionId?: string };
  if (!decision || (decision !== "approved" && decision !== "rejected")) {
    return void res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }

  try {
    await getRepo(req).reviewArticle(articleId, versionId ?? null, decision);
    res.json({ success: true, decision });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    const status = msg.includes("Unauthorized") || msg.includes("does not belong") ? 403 : 500;
    res.status(status).json({ error: msg });
  }
});

// ============================================================================
// 12. OR-P08: Generate article from approved Content Brief
// ============================================================================
router.post("/:brandId/generate-from-brief", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { briefId, organizationId, quality } = req.body as {
    briefId: string;
    organizationId?: string;
    quality?: "economy" | "balanced" | "quality";
  };

  if (!briefId) return void res.status(400).json({ error: "briefId is required" });

  try {
    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    const userClient = createScopedUserSupabaseClient(req.token);
    const routerInstance = getOmniRouter(getAdminSupabaseClient());

    const result = await generateArticleFromBrief(userClient, routerInstance, {
      briefId,
      brandId,
      context: {
        organizationId: orgId,
        brandId,
        userId: auth.userId!,
        briefId,
      },
      quality,
    });

    res.json({ blocks: result.blocks, modelUsed: result.modelUsed });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 13. OR-P08: Rewrite single block with OmniRouter
// ============================================================================
router.post("/:brandId/:articleId/blocks/:blockId/rewrite", async (req: Request, res: Response) => {
  const { brandId, articleId, blockId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { instruction, organizationId, quality } = req.body as {
    instruction: string;
    organizationId?: string;
    quality?: "economy" | "balanced" | "quality";
  };

  if (!instruction) return void res.status(400).json({ error: "instruction is required" });

  try {
    const workingDoc = await getRepo(req).getWorkingDocument(articleId, brandId);
    if (!workingDoc) return void res.status(404).json({ error: "Working document not found" });

    const targetBlock = workingDoc.content.document.blocks.find((b) => b.id === blockId);
    if (!targetBlock) return void res.status(404).json({ error: "Block not found in document" });

    const orgId = organizationId || workingDoc.organizationId;
    const userClient = createScopedUserSupabaseClient(req.token);
    const routerInstance = getOmniRouter(getAdminSupabaseClient());

    const rewriteResult = await rewriteBlock(userClient, routerInstance, {
      blockId,
      blockType: targetBlock.type,
      currentContent: targetBlock.content,
      instruction,
      brandId,
      context: {
        organizationId: orgId,
        brandId,
        userId: auth.userId!,
        articleId,
      },
      quality,
    });

    const updatedBlock: ArticleBlock = {
      ...targetBlock,
      content: rewriteResult.block.content ?? targetBlock.content,
      attributes: rewriteResult.block.attributes ?? targetBlock.attributes,
      provenance: rewriteResult.block.provenance ?? {
        ...targetBlock.provenance,
        lastModifiedBy: auth.userId!,
        lastModifiedAt: new Date().toISOString(),
        aiGenerated: true,
        aiTaskCode: "block_rewrite",
        aiModelHint: rewriteResult.modelUsed,
      },
    };

    const updatedDoc = await getRepo(req).replaceBlock(
      articleId,
      brandId,
      orgId,
      blockId,
      updatedBlock,
      auth.userId!,
      "block_rewrite",
      rewriteResult.modelUsed,
      instruction
    );

    res.json({
      workingDocument: updatedDoc,
      rewrittenBlock: updatedBlock,
      modelUsed: rewriteResult.modelUsed,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 14. OR-P09: Run SEO Audit
// ============================================================================
router.post("/:brandId/:articleId/audits/seo", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { versionId, organizationId } = req.body as { versionId?: string; organizationId?: string };

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const result = await runSeoAudit(userClient, articleId, brandId, versionId);

    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (orgId) {
      await saveSeoAudit(userClient, articleId, brandId, orgId, versionId ?? null, result);
    }

    res.json({ audit: result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 15. OR-P09: Run GEO Audit
// ============================================================================
router.post("/:brandId/:articleId/audits/geo", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { versionId, organizationId } = req.body as { versionId?: string; organizationId?: string };

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const result = await runGeoAudit(userClient, articleId, brandId);

    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (orgId) {
      await saveGeoAudit(userClient, articleId, brandId, orgId, versionId ?? null, result);
    }

    res.json({ audit: result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 16. OR-P09: Run Brand Compliance Audit
// ============================================================================
router.post("/:brandId/:articleId/audits/brand", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { versionId, organizationId } = req.body as { versionId?: string; organizationId?: string };

  try {
    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    const userClient = createScopedUserSupabaseClient(req.token);
    const result = await runBrandAudit(userClient, articleId, brandId, orgId);

    await saveBrandAudit(userClient, articleId, brandId, orgId, versionId ?? null, result);

    res.json({ audit: result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 17. OR-P09: Get Audits for Article
// ============================================================================
router.get("/:brandId/:articleId/audits", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);

    const [seoRes, geoRes, brandRes] = await Promise.all([
      userClient
        .from("seo_audits")
        .select("*")
        .eq("article_id", articleId)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      userClient
        .from("geo_audits")
        .select("*")
        .eq("article_id", articleId)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      userClient
        .from("brand_audits")
        .select("*")
        .eq("article_id", articleId)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    res.json({
      seo: seoRes.data ?? null,
      geo: geoRes.data ?? null,
      brand: brandRes.data ?? null,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 18. OR-P09: Immutable Version Approval via DB RPC
// ============================================================================
router.post("/:brandId/:articleId/versions/:versionId/approve-version", async (req: Request, res: Response) => {
  const { brandId, articleId, versionId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const { error: rpcError } = await userClient.rpc("approve_article_version", {
      p_article_id: articleId,
      p_version_id: versionId,
    });

    if (rpcError) {
      const msg = rpcError.message;
      const status = msg.includes("Forbidden") || msg.includes("Separation of duties") || msg.includes("blocking brand policy") ? 403 : 400;
      return void res.status(status).json({ error: msg });
    }

    res.json({ success: true, approvedVersionId: versionId });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 19. OR-P09: Content Reviews
// ============================================================================
router.get("/:brandId/:articleId/reviews", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const { data, error } = await userClient
      .from("content_reviews")
      .select("*")
      .eq("article_id", articleId)
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ reviews: data ?? [] });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/:brandId/:articleId/reviews", async (req: Request, res: Response) => {
  const { brandId, articleId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { versionId, summary, organizationId } = req.body as {
    versionId?: string;
    summary?: string;
    organizationId?: string;
  };

  try {
    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    const userClient = createScopedUserSupabaseClient(req.token);
    const { data, error } = await userClient
      .from("content_reviews")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        article_id: articleId,
        version_id: versionId ?? null,
        status: "open",
        reviewer_id: auth.userId!,
        summary: summary ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ review: data });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 20. OR-P09: Review Comments
// ============================================================================
router.get("/:brandId/:articleId/reviews/:reviewId/comments", async (req: Request, res: Response) => {
  const { brandId, articleId, reviewId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  try {
    const userClient = createScopedUserSupabaseClient(req.token);
    const { data, error } = await userClient
      .from("review_comments")
      .select("*")
      .eq("review_id", reviewId)
      .eq("brand_id", brandId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ comments: data ?? [] });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/:brandId/:articleId/reviews/:reviewId/comments", async (req: Request, res: Response) => {
  const { brandId, articleId, reviewId } = req.params;
  const auth = await resolveAuth(req, brandId);
  if (auth.error) return void res.status(auth.status).json({ error: auth.error });

  const { commentText, commentType, blockId, organizationId } = req.body as {
    commentText: string;
    commentType?: string;
    blockId?: string;
    organizationId?: string;
  };

  if (!commentText) return void res.status(400).json({ error: "commentText is required" });

  try {
    const orgId = organizationId || (await tenancyRepo.resolveBrandOrganizationAsync(brandId, req.token));
    if (!orgId) return void res.status(400).json({ error: "Cannot resolve organizationId" });

    const userClient = createScopedUserSupabaseClient(req.token);
    const { data, error } = await userClient
      .from("review_comments")
      .insert({
        review_id: reviewId,
        organization_id: orgId,
        brand_id: brandId,
        author_id: auth.userId!,
        block_id: blockId ?? null,
        comment_text: commentText,
        comment_type: commentType ?? "general",
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ comment: data });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
