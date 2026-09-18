import { Router, Request, Response } from "express";
import multer from "multer";
import { brandBrainRepo } from "../brand-brain/repo.ts";
import { tenancyRepo } from "../auth/tenancy.ts";
import { authenticateRequest } from "../auth/middleware.ts";
import { OrgRole, BrandRole, DocumentFileType } from "../../types/index.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

const router = Router();

// Apply Supabase authentication middleware to all brand-brain routes
router.use(authenticateRequest);

// Helper to extract authenticated user and verify tenancy/brand membership
async function resolveAuthContext(req: Request, brandId: string) {
  const ctx = req.securityContext;
  if (!ctx || !ctx.isAuthenticated || !ctx.userId) {
    return { error: "Authentication required", status: 401, user: null, orgRole: null, brandRole: null };
  }

  const userId = ctx.userId;
  if (ctx.isServiceRole) {
    return {
      error: null,
      status: 200,
      user: { id: userId, name: "Service Role" },
      orgRole: "admin" as OrgRole,
      brandRole: "strategist" as BrandRole,
    };
  }

  const isMember = await tenancyRepo.isBrandMemberAsync(brandId, userId, req.token);
  if (!isMember) {
    return { error: "Forbidden: Not authorized for this brand", status: 403, user: null, orgRole: null, brandRole: null };
  }

  const user = {
    id: userId,
    name: req.user?.fullName || req.user?.email || "Authenticated User"
  };

  try {
    const brand = await tenancyRepo.getBrandByIdAsync(ctx, brandId, req.token);
    const orgRole: OrgRole = brand ? (tenancyRepo.getOrgRole(brand.organizationId, userId) || "member") : "member";
    const brandRole: BrandRole = tenancyRepo.getBrandRole(brandId, userId) || "viewer";
    return { error: null, status: 200, user, orgRole, brandRole };
  } catch {
    return { error: "Forbidden: Not authorized for this brand", status: 403, user: null, orgRole: null, brandRole: null };
  }
}

// 1. Get Brand Brain Core Knowledge
router.get("/:brandId", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const knowledge = await brandBrainRepo.getBrandBrainAsync(brandId, req.token);
    res.json({
      brandId,
      knowledge,
      userPermissions: {
        canEditStrategist: brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"]),
        canEditWriter: brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"]),
        orgRole: auth.orgRole,
        brandRole: auth.brandRole
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch brand brain" });
  }
});

// 2. Update Profile (Strategist only)
router.put("/:brandId/profile", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can update Brand Profile" });
    return;
  }

  try {
    const updated = await brandBrainRepo.updateProfileAsync(brandId, req.body, auth.user, req.token);
    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

// 3. Products & Services (Strategist & Writer)
router.post("/:brandId/products", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to add products" });
    return;
  }

  try {
    const product = await brandBrainRepo.createProductAsync(brandId, req.body, auth.user, req.token);
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create product" });
  }
});

router.put("/:brandId/products/:productId", async (req: Request, res: Response) => {
  const { brandId, productId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to update products" });
    return;
  }

  try {
    const product = await brandBrainRepo.updateProductAsync(brandId, productId, req.body, auth.user, req.token);
    res.json({ product });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/products/:productId/archive", async (req: Request, res: Response) => {
  const { brandId, productId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can archive products" });
    return;
  }

  try {
    const product = await brandBrainRepo.toggleArchiveProductAsync(brandId, productId, auth.user, req.token);
    res.json({ product });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 4. Audiences (Strategist only)
router.post("/:brandId/audiences", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can create audience personas" });
    return;
  }

  try {
    const audience = await brandBrainRepo.createAudienceAsync(brandId, req.body, auth.user, req.token);
    res.status(201).json({ audience });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create audience" });
  }
});

router.put("/:brandId/audiences/:audienceId", async (req: Request, res: Response) => {
  const { brandId, audienceId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can update audience personas" });
    return;
  }

  try {
    const audience = await brandBrainRepo.updateAudienceAsync(brandId, audienceId, req.body, auth.user, req.token);
    res.json({ audience });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/audiences/:audienceId/archive", async (req: Request, res: Response) => {
  const { brandId, audienceId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can archive audiences" });
    return;
  }

  try {
    const audience = await brandBrainRepo.toggleArchiveAudienceAsync(brandId, audienceId, auth.user, req.token);
    res.json({ audience });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 5. Voice Profile & Examples
router.put("/:brandId/voice", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can adjust Voice profile settings" });
    return;
  }

  try {
    const voiceProfile = await brandBrainRepo.updateVoiceProfileAsync(brandId, req.body, auth.user, req.token);
    res.json({ voiceProfile });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update voice profile" });
  }
});

router.post(["/:brandId/voice/examples", "/:brandId/voice-examples"], async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to add voice examples" });
    return;
  }

  try {
    const example = await brandBrainRepo.createVoiceExampleAsync(brandId, req.body, auth.user, req.token);
    res.status(201).json({ example });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create voice example" });
  }
});

router.delete(["/:brandId/voice/examples/:exampleId", "/:brandId/voice-examples/:exampleId"], async (req: Request, res: Response) => {
  const { brandId, exampleId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can delete voice examples" });
    return;
  }

  try {
    const success = await brandBrainRepo.deleteVoiceExampleAsync(brandId, exampleId, auth.user, req.token);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete voice example" });
  }
});

// 6. Terminology
router.post("/:brandId/terminology", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to add terminology" });
    return;
  }

  try {
    const term = await brandBrainRepo.createTerminologyAsync(brandId, req.body, auth.user, req.token);
    res.status(201).json({ term });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create terminology" });
  }
});

router.delete("/:brandId/terminology/:termId", async (req: Request, res: Response) => {
  const { brandId, termId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to delete terminology" });
    return;
  }

  try {
    const success = await brandBrainRepo.deleteTerminologyAsync(brandId, termId, auth.user, req.token);
    res.json({ success });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 7. Policies (suggestion, warning, blocking)
router.post("/:brandId/policies", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can define Brand Policies" });
    return;
  }

  try {
    const policy = await brandBrainRepo.createPolicyAsync(brandId, req.body, auth.user, req.token);
    res.status(201).json({ policy });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create policy" });
  }
});

router.put("/:brandId/policies/:policyId", async (req: Request, res: Response) => {
  const { brandId, policyId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can update Brand Policies" });
    return;
  }

  try {
    const policy = await brandBrainRepo.updatePolicyAsync(brandId, policyId, req.body, auth.user, req.token);
    res.json({ policy });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/policies/:policyId/archive", async (req: Request, res: Response) => {
  const { brandId, policyId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can archive policies" });
    return;
  }

  try {
    const policy = await brandBrainRepo.toggleArchivePolicyAsync(brandId, policyId, auth.user, req.token);
    res.json({ policy });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 8. Competitors
router.post("/:brandId/competitors", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can add competitors" });
    return;
  }

  try {
    const competitor = await brandBrainRepo.createCompetitorAsync(brandId, req.body, auth.user, req.token);
    res.status(201).json({ competitor });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create competitor" });
  }
});

router.put("/:brandId/competitors/:competitorId", async (req: Request, res: Response) => {
  const { brandId, competitorId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can update competitors" });
    return;
  }

  try {
    const competitor = await brandBrainRepo.updateCompetitorAsync(brandId, competitorId, req.body, auth.user, req.token);
    res.json({ competitor });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/competitors/:competitorId/archive", async (req: Request, res: Response) => {
  const { brandId, competitorId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can archive competitors" });
    return;
  }

  try {
    const competitor = await brandBrainRepo.toggleArchiveCompetitorAsync(brandId, competitorId, auth.user, req.token);
    res.json({ competitor });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==========================================
// Ingestion & Semantic Knowledge Base Routes (OR-P04 & OR-G04B)
// ==========================================

// Multipart Binary File Upload (PDF, DOCX, XLSX, CSV, MD, TXT, HTML)
router.post("/:brandId/upload", upload.single("file"), async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Only Strategists and Writers can ingest content into Brand Brain" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file was uploaded in the 'file' field" });
    return;
  }

  try {
    const rawBuffer = req.file.buffer;
    const fileName = req.file.originalname || "document";
    const ext = fileName.split(".").pop()?.toLowerCase() || "txt";
    const fileType = (["pdf", "docx", "xlsx", "csv", "md", "html", "txt", "note"].includes(ext)
      ? ext
      : "txt") as DocumentFileType;

    const sourceName = req.body.sourceName || fileName.replace(/\.[^/.]+$/, "");
    const trustLevel = req.body.trustLevel;
    const classification = req.body.classification;

    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const result = await brandBrainIngestion.ingestContent(
      {
        brandId,
        sourceType: "file_upload",
        sourceName,
        fileType,
        fileName,
        fileBufferOrText: rawBuffer,
        trustLevel,
        classification
      },
      auth.user
    );

    await brandBrainRepo.logAuditAsync(
      brandId,
      auth.user,
      "profile",
      result.document.id,
      "create",
      `Uploaded binary file '${fileName}' (${result.chunks.length} chunks, ${result.evidenceClaims.length} claims).`,
      {
        isDuplicate: result.isDuplicate,
        fileType,
        fileSizeBytes: req.file.size
      },
      req.token
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Binary file upload failed" });
  }
});

// Ingest Content (File upload, website crawl, manual note, spreadsheet)
router.post("/:brandId/ingest", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Only Strategists and Writers can ingest content into Brand Brain" });
    return;
  }

  try {
    const {
      sourceType,
      sourceName,
      sourceUrl,
      fileType,
      fileName,
      content,
      fileBufferOrText,
      trustLevel,
      classification,
      metadata
    } = req.body;

    const payload = content || fileBufferOrText || "";
    if (!payload && !sourceUrl) {
      res.status(400).json({ error: "Content or sourceUrl is required for ingestion" });
      return;
    }

    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const result = await brandBrainIngestion.ingestContent({
      brandId,
      sourceType: sourceType || "file_upload",
      sourceName: sourceName || fileName || "Uploaded Knowledge Document",
      sourceUrl,
      fileType: fileType || "txt",
      fileName,
      fileBufferOrText: payload,
      trustLevel,
      classification,
      metadata
    }, auth.user);

    await brandBrainRepo.logAuditAsync(
      brandId,
      auth.user,
      "profile",
      result.document.id,
      "create",
      `Ingested document '${result.document.title}' (${result.chunks.length} chunks, ${result.evidenceClaims.length} evidence candidates).`,
      {
        isDuplicate: result.isDuplicate,
        hasUntrustedDirectives: result.document.hasUntrustedDirectives,
        trustLevel: result.document.trustLevel,
        classification: result.document.classification
      },
      req.token
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to ingest content" });
  }
});

// Semantic Vector Search with Brand Isolation Guarantee
router.post("/:brandId/search", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const { query, topK, minSimilarity } = req.body;
    if (!query) {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const results = await brandBrainIngestion.searchBrandKnowledge(
      brandId,
      query,
      topK || 5,
      minSimilarity !== undefined ? minSimilarity : 0.15
    );

    res.json({ results, query, brandId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to search brand knowledge" });
  }
});

// Get Knowledge Sources (Database-backed)
router.get("/:brandId/sources", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const sources = await brandBrainIngestion.getSourcesAsync(brandId);
    res.json({ sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch sources" });
  }
});

// Get Knowledge Documents (Database-backed)
router.get("/:brandId/documents", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const documents = await brandBrainIngestion.getDocumentsAsync(brandId);
    res.json({ documents });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch documents" });
  }
});

// Delete Knowledge Document
router.delete("/:brandId/documents/:documentId", async (req: Request, res: Response) => {
  const { brandId, documentId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can delete documents" });
    return;
  }

  try {
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const success = await brandBrainIngestion.deleteDocument(brandId, documentId);
    if (!success) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    await brandBrainRepo.logAuditAsync(
      brandId,
      auth.user,
      "profile",
      documentId,
      "delete",
      `Deleted knowledge document ${documentId}`,
      {},
      req.token
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete document" });
  }
});

// Get Chunks (Database-backed)
router.get("/:brandId/chunks", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const documentId = req.query.documentId as string | undefined;
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const chunks = await brandBrainIngestion.getChunksAsync(brandId, documentId);
    res.json({ chunks });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch chunks" });
  }
});

// Get Evidence Claims & Sources (Database-backed)
router.get("/:brandId/evidence", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  try {
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const [claims, sources] = await Promise.all([
      brandBrainIngestion.getEvidenceClaimsAsync(brandId),
      brandBrainIngestion.getEvidenceSourcesAsync(brandId)
    ]);
    res.json({ claims, sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch evidence" });
  }
});

// Verify / Reject Evidence Claim (Database-backed, with real authenticated reviewer provenance)
router.put("/:brandId/evidence/:claimId/status", async (req: Request, res: Response) => {
  const { brandId, claimId } = req.params;
  const auth = await resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "reviewer"])) {
    res.status(403).json({ error: "Only Strategists, Reviewers, and Admins can verify or reject evidence claims" });
    return;
  }

  const { status } = req.body;
  if (!["unverified", "verified", "disputed", "rejected"].includes(status)) {
    res.status(400).json({ error: "Invalid verification status" });
    return;
  }

  try {
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const updated = await brandBrainIngestion.verifyClaimAsync(brandId, claimId, status, auth.user.id);

    await brandBrainRepo.logAuditAsync(
      brandId,
      auth.user,
      "policy",
      claimId,
      "update",
      `Updated evidence claim status to '${status}': "${updated.claimText.slice(0, 50)}..."`,
      { status, verifiedBy: auth.user.id },
      req.token
    );

    res.json({ claim: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message || "Failed to update evidence claim" });
  }
});

export default router;
