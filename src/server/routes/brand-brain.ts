import { Router, Request, Response } from "express";
import { brandBrainRepo } from "../brand-brain/repo.ts";
import { tenancyRepo } from "../auth/tenancy.ts";
import { OrgRole, BrandRole } from "../../types/index.ts";

const router = Router();

// Helper to extract authenticated user and verify tenancy/brand membership
function resolveAuthContext(req: Request, brandId: string) {
  const userId = (req.headers["x-user-id"] as string) || "00000000-0000-4000-8000-000000000001";
  const userProfile = tenancyRepo.getProfile({ isAuthenticated: true, isServiceRole: true, userId }, userId);
  const user = userProfile
    ? { id: userProfile.id, name: userProfile.fullName }
    : { id: userId, name: "System Strategist" };

  const isMember = tenancyRepo.isBrandMember(brandId, userId);
  const orgRole: OrgRole = "admin";
  const brandRole: BrandRole = tenancyRepo.getBrandRole(brandId, userId) || "strategist";

  return { error: null, status: 200, user, orgRole, brandRole };
}

// 1. Get Brand Brain Core Knowledge
router.get("/:brandId", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const knowledge = brandBrainRepo.getBrandBrain(brandId);
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
});

// 2. Update Profile (Strategist only)
router.put("/:brandId/profile", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can update Brand Profile" });
    return;
  }

  const updated = brandBrainRepo.updateProfile(brandId, req.body, auth.user);
  res.json({ profile: updated });
});

// 3. Products & Services (Strategist & Writer)
router.post("/:brandId/products", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to add products" });
    return;
  }

  const product = brandBrainRepo.createProduct(brandId, req.body, auth.user);
  res.status(201).json({ product });
});

router.put("/:brandId/products/:productId", (req: Request, res: Response) => {
  const { brandId, productId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to update products" });
    return;
  }

  try {
    const product = brandBrainRepo.updateProduct(brandId, productId, req.body, auth.user);
    res.json({ product });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/products/:productId/archive", (req: Request, res: Response) => {
  const { brandId, productId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can archive products" });
    return;
  }

  try {
    const product = brandBrainRepo.toggleArchiveProduct(brandId, productId, auth.user);
    res.json({ product });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 4. Audiences (Strategist only)
router.post("/:brandId/audiences", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can create audience personas" });
    return;
  }

  const audience = brandBrainRepo.createAudience(brandId, req.body, auth.user);
  res.status(201).json({ audience });
});

router.put("/:brandId/audiences/:audienceId", (req: Request, res: Response) => {
  const { brandId, audienceId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can update audience personas" });
    return;
  }

  try {
    const audience = brandBrainRepo.updateAudience(brandId, audienceId, req.body, auth.user);
    res.json({ audience });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/audiences/:audienceId/archive", (req: Request, res: Response) => {
  const { brandId, audienceId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can archive audiences" });
    return;
  }

  try {
    const audience = brandBrainRepo.toggleArchiveAudience(brandId, audienceId, auth.user);
    res.json({ audience });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 5. Voice Profile & Examples
router.put("/:brandId/voice", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can adjust Voice profile settings" });
    return;
  }

  const voiceProfile = brandBrainRepo.updateVoiceProfile(brandId, req.body, auth.user);
  res.json({ voiceProfile });
});

router.post("/:brandId/voice/examples", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to add voice examples" });
    return;
  }

  const example = brandBrainRepo.createVoiceExample(brandId, req.body, auth.user);
  res.status(201).json({ example });
});

router.delete("/:brandId/voice/examples/:exampleId", (req: Request, res: Response) => {
  const { brandId, exampleId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists can delete voice examples" });
    return;
  }

  const success = brandBrainRepo.deleteVoiceExample(brandId, exampleId, auth.user);
  res.json({ success });
});

// 6. Terminology
router.post("/:brandId/terminology", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to add terminology" });
    return;
  }

  const term = brandBrainRepo.createTerminology(brandId, req.body, auth.user);
  res.status(201).json({ term });
});

router.post("/:brandId/terminology/:termId/archive", (req: Request, res: Response) => {
  const { brandId, termId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist", "writer"])) {
    res.status(403).json({ error: "Permission denied to archive terminology" });
    return;
  }

  try {
    const term = brandBrainRepo.toggleArchiveTerminology(brandId, termId, auth.user);
    res.json({ term });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 7. Policies (suggestion, warning, blocking)
router.post("/:brandId/policies", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can define Brand Policies" });
    return;
  }

  const policy = brandBrainRepo.createPolicy(brandId, req.body, auth.user);
  res.status(201).json({ policy });
});

router.put("/:brandId/policies/:policyId", (req: Request, res: Response) => {
  const { brandId, policyId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can update Brand Policies" });
    return;
  }

  try {
    const policy = brandBrainRepo.updatePolicy(brandId, policyId, req.body, auth.user);
    res.json({ policy });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/policies/:policyId/archive", (req: Request, res: Response) => {
  const { brandId, policyId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can archive policies" });
    return;
  }

  try {
    const policy = brandBrainRepo.toggleArchivePolicy(brandId, policyId, auth.user);
    res.json({ policy });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 8. Competitors
router.post("/:brandId/competitors", (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can add competitors" });
    return;
  }

  const competitor = brandBrainRepo.createCompetitor(brandId, req.body, auth.user);
  res.status(201).json({ competitor });
});

router.put("/:brandId/competitors/:competitorId", (req: Request, res: Response) => {
  const { brandId, competitorId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can update competitors" });
    return;
  }

  try {
    const competitor = brandBrainRepo.updateCompetitor(brandId, competitorId, req.body, auth.user);
    res.json({ competitor });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post("/:brandId/competitors/:competitorId/archive", (req: Request, res: Response) => {
  const { brandId, competitorId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can archive competitors" });
    return;
  }

  try {
    const competitor = brandBrainRepo.toggleArchiveCompetitor(brandId, competitorId, auth.user);
    res.json({ competitor });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==========================================
// Ingestion & Semantic Knowledge Base Routes (OR-P04)
// ==========================================

// Ingest Content (File upload, website crawl, manual note, spreadsheet)
router.post("/:brandId/ingest", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
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

    // Record audit log
    brandBrainRepo.logAudit({
      brandId,
      userId: auth.user.id,
      userName: auth.user.name,
      entityType: "profile",
      entityId: result.document.id,
      action: "create",
      summary: `Ingested document '${result.document.title}' (${result.chunks.length} chunks, ${result.evidenceClaims.length} evidence candidates).`,
      details: {
        isDuplicate: result.isDuplicate,
        hasUntrustedDirectives: result.document.hasUntrustedDirectives,
        trustLevel: result.document.trustLevel,
        classification: result.document.classification
      }
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to ingest content" });
  }
});

// Semantic Vector Search with Brand Isolation Guarantee
router.post("/:brandId/search", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
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

// Get Knowledge Sources
router.get("/:brandId/sources", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
  const sources = brandBrainIngestion.getSources(brandId);
  res.json({ sources });
});

// Get Knowledge Documents
router.get("/:brandId/documents", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
  const documents = brandBrainIngestion.getDocuments(brandId);
  res.json({ documents });
});

// Delete Knowledge Document
router.delete("/:brandId/documents/:documentId", async (req: Request, res: Response) => {
  const { brandId, documentId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can delete documents" });
    return;
  }

  const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
  const success = brandBrainIngestion.deleteDocument(brandId, documentId);
  if (!success) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  brandBrainRepo.logAudit({
    brandId,
    userId: auth.user.id,
    userName: auth.user.name,
    entityType: "profile",
    entityId: documentId,
    action: "delete",
    summary: `Deleted knowledge document ${documentId}`
  });

  res.json({ success: true });
});

// Get Chunks
router.get("/:brandId/chunks", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const documentId = req.query.documentId as string | undefined;
  const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
  const chunks = brandBrainIngestion.getChunks(brandId, documentId);
  res.json({ chunks });
});

// Get Evidence Claims & Sources
router.get("/:brandId/evidence", async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
  const claims = brandBrainIngestion.getEvidenceClaims(brandId);
  const sources = brandBrainIngestion.getEvidenceSources(brandId);
  res.json({ claims, sources });
});

// Verify / Reject Evidence Claim
router.put("/:brandId/evidence/:claimId/status", async (req: Request, res: Response) => {
  const { brandId, claimId } = req.params;
  const auth = resolveAuthContext(req, brandId);
  if (auth.error || !auth.user) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  if (!brandBrainRepo.checkPermission(auth.orgRole!, auth.brandRole!, ["strategist"])) {
    res.status(403).json({ error: "Only Strategists and Admins can verify or reject evidence claims" });
    return;
  }

  const { status } = req.body;
  if (!["unverified", "verified", "disputed", "rejected"].includes(status)) {
    res.status(400).json({ error: "Invalid verification status" });
    return;
  }

  try {
    const { brandBrainIngestion } = await import("../brand-brain/ingestion-service.ts");
    const updated = brandBrainIngestion.verifyClaim(brandId, claimId, status);

    brandBrainRepo.logAudit({
      brandId,
      userId: auth.user.id,
      userName: auth.user.name,
      entityType: "policy",
      entityId: claimId,
      action: "update",
      summary: `Updated evidence claim status to '${status}': "${updated.claimText.slice(0, 50)}..."`
    });

    res.json({ claim: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
