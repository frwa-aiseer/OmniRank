import { describe, it, expect, beforeEach } from "vitest";
import { BrandBrainRepository } from "../server/brand-brain/repo";

describe("Brand Brain Core & Auditability (OR-P03)", () => {
  let repo: BrandBrainRepository;
  const testBrandId = "brand-test-01";
  const testUser = { id: "usr-strategist-01", name: "Lead Strategist" };
  const writerUser = { id: "usr-writer-01", name: "Content Writer" };

  beforeEach(() => {
    repo = new BrandBrainRepository();
  });

  it("should initialize default Brand Brain knowledge and calculate completeness score", () => {
    const knowledge = repo.getBrandBrain("brand-001");
    expect(knowledge).toBeDefined();
    expect(knowledge.profile.toneKeywords.length).toBeGreaterThan(0);
    expect(knowledge.products.length).toBeGreaterThanOrEqual(3);
    expect(knowledge.audiences.length).toBeGreaterThanOrEqual(2);
    expect(knowledge.voiceProfile.archetype).toContain("Architect");
    expect(knowledge.voiceExamples.length).toBeGreaterThanOrEqual(3);
    expect(knowledge.policies.length).toBeGreaterThanOrEqual(4);
    expect(knowledge.competitors.length).toBeGreaterThanOrEqual(2);
    expect(knowledge.completenessScore).toBeGreaterThanOrEqual(70);
  });

  it("should create, update, and archive products with audit trail logging", () => {
    const newProduct = repo.createProduct(
      testBrandId,
      {
        name: "OmniRank Autonomous Agent",
        category: "AI Agent",
        valueProposition: "Self-optimizing block editor with multi-model task router.",
        keyFeatures: ["Block JSON", "OmniRouter Dispatch"],
        targetAudience: "Engineering Leads",
        pricingSummary: "$999/mo",
        status: "active"
      },
      testUser
    );

    expect(newProduct.id).toBeDefined();
    expect(newProduct.name).toBe("OmniRank Autonomous Agent");

    // Update product
    const updated = repo.updateProduct(
      testBrandId,
      newProduct.id,
      { pricingSummary: "$1,299/mo" },
      testUser
    );
    expect(updated.pricingSummary).toBe("$1,299/mo");

    // Archive product
    const archived = repo.toggleArchiveProduct(testBrandId, newProduct.id, testUser);
    expect(archived.status).toBe("archived");

    // Check audit logs
    const brain = repo.getBrandBrain(testBrandId);
    const logs = brain.recentAuditLogs.filter((l) => l.entityId === newProduct.id);
    expect(logs.length).toBe(3); // create, update, archive
    expect(logs.some((l) => l.action === "create")).toBe(true);
    expect(logs.some((l) => l.action === "archive")).toBe(true);
  });

  it("should manage audience personas and validate pain points/goals", () => {
    const audience = repo.createAudience(
      testBrandId,
      {
        name: "Head of Technical SEO",
        jobTitle: "Senior SEO Director",
        painPoints: ["Crawl budget wastage", "AI Overviews traffic cannibalization"],
        goals: ["Maximize answer engine citation share"],
        objections: ["Reluctant to trust automated text"],
        preferredChannels: ["X", "LinkedIn"],
        status: "active"
      },
      testUser
    );

    expect(audience.name).toBe("Head of Technical SEO");
    expect(audience.painPoints).toHaveLength(2);

    const brain = repo.getBrandBrain(testBrandId);
    expect(brain.audiences.some((a) => a.id === audience.id)).toBe(true);
  });

  it("should manage brand policies with suggestion, warning, and blocking severities", () => {
    // 1. Blocking policy
    const blockingPolicy = repo.createPolicy(
      testBrandId,
      {
        title: "Mandatory Spanner TrueTime Latency Citation",
        description: "Must cite Google Cloud official benchmarks.",
        category: "factual_claim",
        severity: "blocking",
        enforcementAction: "Hard rejection of draft publish",
        status: "active"
      },
      testUser
    );
    expect(blockingPolicy.severity).toBe("blocking");

    // 2. Warning policy
    const warningPolicy = repo.createPolicy(
      testBrandId,
      {
        title: "Discourage Excessive Exclamation Marks",
        description: "Avoid informal punctuation in technical documentation.",
        category: "editorial_style",
        severity: "warning",
        enforcementAction: "Highlights punctuation in editor",
        status: "active"
      },
      testUser
    );
    expect(warningPolicy.severity).toBe("warning");

    // 3. Suggestion policy
    const suggestionPolicy = repo.createPolicy(
      testBrandId,
      {
        title: "Include Architecture Diagram",
        description: "Provide a block architecture diagram for systems articles.",
        category: "editorial_style",
        severity: "suggestion",
        enforcementAction: "Recommends visual block insertion",
        status: "active"
      },
      testUser
    );
    expect(suggestionPolicy.severity).toBe("suggestion");

    const brain = repo.getBrandBrain(testBrandId);
    expect(brain.policies.filter((p) => p.brandId === testBrandId).length).toBe(3);
  });

  it("should manage brand voice calibration and voice examples (Do's & Don'ts)", () => {
    // Update voice profile
    const voice = repo.updateVoiceProfile(
      testBrandId,
      {
        archetype: "The Pragmatic Architect",
        formalityScore: 5,
        technicalDepthScore: 5,
        enthusiasmScore: 1,
        humorScore: 1,
        styleGuidelines: "Always benchmark. Never speculate."
      },
      testUser
    );

    expect(voice.formalityScore).toBe(5);
    expect(voice.technicalDepthScore).toBe(5);

    // Create DO example
    const doEx = repo.createVoiceExample(
      testBrandId,
      {
        type: "do",
        title: "TrueTime Consensus Explanation",
        snippet: "GPS receiver synchronization bounds atomic clock drift to 7ms.",
        explanation: "Concrete hardware mechanics with precise bounds.",
        category: "Technical Explanation"
      },
      testUser
    );
    expect(doEx.type).toBe("do");

    // Create DONT example
    const dontEx = repo.createVoiceExample(
      testBrandId,
      {
        type: "dont",
        title: "Vague Marketing Hype",
        snippet: "Our magical cloud platform unleashes game-changing speed.",
        explanation: "Violates technical clarity rule.",
        category: "Intro"
      },
      testUser
    );
    expect(dontEx.type).toBe("dont");

    // Delete example
    const deleted = repo.deleteVoiceExample(testBrandId, dontEx.id, testUser);
    expect(deleted).toBe(true);

    const brain = repo.getBrandBrain(testBrandId);
    expect(brain.voiceExamples.some((e) => e.id === dontEx.id)).toBe(false);
  });

  it("should enforce terminology rules for preferred vs avoided phrases", () => {
    const prefTerm = repo.createTerminology(
      testBrandId,
      {
        type: "preferred",
        term: "OmniRouter",
        preferredUsage: "Capitalize as single proper camelCase word.",
        reason: "Proprietary dispatch engine name.",
        caseSensitive: true,
        status: "active"
      },
      testUser
    );
    expect(prefTerm.type).toBe("preferred");

    const avoidTerm = repo.createTerminology(
      testBrandId,
      {
        type: "avoided",
        term: "game-changer",
        replacement: "architectural shift",
        reason: "Banned marketing cliché.",
        caseSensitive: false,
        status: "active"
      },
      testUser
    );
    expect(avoidTerm.type).toBe("avoided");
    expect(avoidTerm.replacement).toBe("architectural shift");
  });

  it("should verify brand role permissions for Strategist vs Writer vs Viewer", () => {
    // Strategist permissions
    expect(repo.checkPermission("member", "strategist", ["strategist"])).toBe(true);
    expect(repo.checkPermission("member", "strategist", ["strategist", "writer"])).toBe(true);

    // Writer permissions
    expect(repo.checkPermission("member", "writer", ["strategist"])).toBe(false);
    expect(repo.checkPermission("member", "writer", ["strategist", "writer"])).toBe(true);

    // Viewer permissions
    expect(repo.checkPermission("member", "viewer", ["strategist"])).toBe(false);
    expect(repo.checkPermission("member", "viewer", ["strategist", "writer"])).toBe(false);

    // Org Admin / Owner override
    expect(repo.checkPermission("owner", "viewer", ["strategist"])).toBe(true);
    expect(repo.checkPermission("admin", "viewer", ["strategist"])).toBe(true);
  });
});
