import {
  BrandProfileDetails,
  BrandProduct,
  BrandAudience,
  BrandVoiceProfile,
  BrandVoiceExample,
  BrandTerminology,
  BrandPolicy,
  BrandCompetitor,
  BrandAuditLog,
  BrandBrainKnowledge,
  BrandRole,
  OrgRole
} from "../../types";
import { brandBrainIngestion } from "./ingestion-service.ts";
import { getServerEnv } from "../env.ts";
import { getDemoBrandBrain } from "../../fixtures/demoData.ts";
import { isLiveSupabaseConfigured } from "../supabase/client.ts";
import { supabaseBrandBrainCoreRepo } from "./supabase-core-repo.ts";

export interface BrandBrainStore {
  profiles: Map<string, BrandProfileDetails>;
  products: Map<string, BrandProduct>;
  audiences: Map<string, BrandAudience>;
  voiceProfiles: Map<string, BrandVoiceProfile>;
  voiceExamples: Map<string, BrandVoiceExample>;
  terminology: Map<string, BrandTerminology>;
  policies: Map<string, BrandPolicy>;
  competitors: Map<string, BrandCompetitor>;
  auditLogs: BrandAuditLog[];
}

export class BrandBrainRepository {
  private store: BrandBrainStore = {
    profiles: new Map(),
    products: new Map(),
    audiences: new Map(),
    voiceProfiles: new Map(),
    voiceExamples: new Map(),
    terminology: new Map(),
    policies: new Map(),
    competitors: new Map(),
    auditLogs: []
  };

  constructor() {
    const env = getServerEnv();
    if (env.NODE_ENV === "test") {
      this.seedFromDemoFixtures("brand-001");
    }
  }

  private seedFromDemoFixtures(brandId: string) {
    const demo = getDemoBrandBrain(brandId);
    this.store.profiles.set(brandId, demo.profile);
    demo.products.forEach((p) => {
      const item = { ...p, id: `${brandId}:${p.id}` };
      this.store.products.set(item.id, item);
    });
    demo.audiences.forEach((a) => {
      const item = { ...a, id: `${brandId}:${a.id}` };
      this.store.audiences.set(item.id, item);
    });
    this.store.voiceProfiles.set(brandId, demo.voiceProfile);
    demo.voiceExamples.forEach((ve) => {
      const item = { ...ve, id: `${brandId}:${ve.id}` };
      this.store.voiceExamples.set(item.id, item);
    });
    demo.terminology.forEach((t) => {
      const item = { ...t, id: `${brandId}:${t.id}` };
      this.store.terminology.set(item.id, item);
    });
    demo.policies.forEach((pol) => {
      const item = { ...pol, id: `${brandId}:${pol.id}` };
      this.store.policies.set(item.id, item);
    });
    demo.competitors.forEach((c) => {
      const item = { ...c, id: `${brandId}:${c.id}` };
      this.store.competitors.set(item.id, item);
    });
    demo.auditLogs.forEach((al) => this.store.auditLogs.unshift(al));
  }

  private seedDefaultBrandBrain(brandId: string) {
    // 1. Profile
    this.store.profiles.set(brandId, {
      id: "profile-001",
      brandId,
      mission: "Empower engineering and growth teams to dominate organic and AI search engines with authoritative, evidence-backed technical content.",
      positioningStatement: "OmniRank is the enterprise AI Content Growth OS that bridges deep technical accuracy with continuous organic search performance.",
      targetMarket: "B2B SaaS, Cloud Infrastructure, Developer Tools, and Enterprise AI companies.",
      valueProposition: "Automated content research, GEO/SEO optimization, and block-based editorial workflows with zero AI hallucination risk.",
      toneKeywords: ["authoritative", "pragmatic", "architectural", "evidence-backed", "direct"],
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
    });

    // 2. Products
    const products: BrandProduct[] = [
      {
        id: "prod-001",
        brandId,
        name: "OmniRank Growth Cloud",
        category: "Enterprise Software",
        valueProposition: "Autonomous SEO & GEO intelligence engine with automated competitor gap analysis and real-time Search Console sync.",
        keyFeatures: ["Search Console & GA4 Integration", "Competitor Opportunity Graph", "Algorithmic Rank Tracking", "Automatic Gap Detection"],
        targetAudience: "VP Growth & Marketing Leaders",
        pricingSummary: "$1,499/mo per brand seat with unlimited block generation",
        status: "active",
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 86400000).toISOString()
      },
      {
        id: "prod-002",
        brandId,
        name: "Brand Brain Engine",
        category: "AI Knowledge Architecture",
        valueProposition: "Deterministic knowledge retrieval and policy enforcement boundary preventing off-brand and hallucinated content.",
        keyFeatures: ["Semantic Vector Store", "Policy Severity Enforcement", "Audit Trail & Provenance", "Terminology Guardrails"],
        targetAudience: "Technical Content Strategists & Lead Editors",
        pricingSummary: "Included in all Core & Enterprise tiers",
        status: "active",
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: "prod-003",
        brandId,
        name: "OmniRouter AI Orchestrator",
        category: "Infrastructure",
        valueProposition: "Provider-neutral task dispatching ensuring zero vendor lock-in across Gemini, Claude, and OpenAI.",
        keyFeatures: ["Task-based Routing", "Cost Optimization Layer", "Durable Inngest Workflows", "Structured Block JSON Output"],
        targetAudience: "Developers and Infrastructure Teams",
        pricingSummary: "Usage-based token pass-through with zero markup",
        status: "active",
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ];
    products.forEach((p) => this.store.products.set(p.id, p));

    // 3. Audiences
    const audiences: BrandAudience[] = [
      {
        id: "aud-001",
        brandId,
        name: "VP of Growth & Demand Gen",
        jobTitle: "VP Marketing / Growth Lead",
        painPoints: [
          "Generic AI-written content gets penalized or ignored by search algorithms",
          "Lack of engineering domain depth in outsourced freelance articles",
          "Inability to attribute organic traffic to specific high-intent conversions"
        ],
        goals: [
          "Rank top 3 for high-value transactional and architectural keywords",
          "Scale technical article publishing velocity by 5x without lowering editorial standards",
          "Ensure GEO visibility in AI Overviews and Perplexity answer engines"
        ],
        objections: [
          "Worried that AI-assisted content will sound robotic or dilute brand reputation",
          "Previous tools lacked structured approval workflows"
        ],
        preferredChannels: ["LinkedIn", "Specialized Substacks", "Hacker News", "Search Engine Land"],
        status: "active",
        createdAt: new Date(Date.now() - 22 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 86400000).toISOString()
      },
      {
        id: "aud-002",
        brandId,
        name: "Principal Cloud Architect",
        jobTitle: "Principal Systems / Infrastructure Architect",
        painPoints: [
          "Marketing articles contain superficial code snippets and inaccurate architecture diagrams",
          "Vendor lock-in claims that fail basic compliance review"
        ],
        goals: [
          "Find rigorously vetted migration guides and benchmark comparisons",
          "Evaluate infrastructure cost models transparently"
        ],
        objections: [
          "Skeptical of marketing claims that lack cited source code or reproducible benchmarks"
        ],
        preferredChannels: ["GitHub", "Reddit r/devops", "ArXiv", "Engineering Blogs"],
        status: "active",
        createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ];
    audiences.forEach((a) => this.store.audiences.set(a.id, a));

    // 4. Voice Profile
    this.store.voiceProfiles.set(brandId, {
      id: "voice-001",
      brandId,
      archetype: "The Pragmatic Systems Architect",
      formalityScore: 4,
      enthusiasmScore: 2,
      technicalDepthScore: 5,
      humorScore: 1,
      readingGradeLevel: "Grade 11-12 / Technical Executive",
      primaryToneTraits: ["Authoritative", "Fact-Driven", "Pragmatic", "Concise", "Uncompromising on Quality"],
      styleGuidelines: "Write with architectural clarity. Use concrete numbers and benchmark references instead of vague qualifiers like 'lightning fast' or 'game-changing'. Prefer active voice, structured block formats, and code-level accuracy.",
      createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
    });

    // 5. Voice Examples
    const voiceExamples: BrandVoiceExample[] = [
      {
        id: "ve-001",
        brandId,
        type: "do",
        title: "Architecture Comparison",
        snippet: "When evaluating PostgreSQL vs Spanner for multi-region active-active clusters, write latency increases from 1.2ms to 14.8ms due to TrueTime consensus synchronization across continents.",
        explanation: "Contains precise latency figures, technical causality, and concrete architecture concepts without hyperbole.",
        category: "Technical Explanation",
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
      },
      {
        id: "ve-002",
        brandId,
        type: "dont",
        title: "Fluffy Marketing Intro",
        snippet: "In today's fast-paced digital world, companies must supercharge their synergy and unleash the next level of disruptive cloud magic.",
        explanation: "Uses banned clichés ('fast-paced', 'supercharge', 'disruptive') and lacks any concrete technical premise.",
        category: "Introductory Paragraph",
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
      },
      {
        id: "ve-003",
        brandId,
        type: "do",
        title: "Action-Oriented Call to Action",
        snippet: "Inspect the reproducible benchmark repository on GitHub or configure your first OmniRouter task pipeline in under 3 minutes.",
        explanation: "Low friction, high specificity, zero aggressive sales pressure.",
        category: "CTA",
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
      }
    ];
    voiceExamples.forEach((ve) => this.store.voiceExamples.set(ve.id, ve));

    // 6. Terminology
    const terms: BrandTerminology[] = [
      {
        id: "term-001",
        brandId,
        type: "preferred",
        term: "AI Content Growth Operating System",
        preferredUsage: "Use to describe OmniRank's unified platform category rather than simply 'an AI writer' or 'SEO tool'.",
        reason: "Positions OmniRank as an enterprise system of record rather than a generic copywriting utility.",
        caseSensitive: false,
        status: "active",
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        id: "term-002",
        brandId,
        type: "avoided",
        term: "AI copywriter",
        replacement: "evidence-backed content engine / Growth OS",
        reason: "Demeans the platform to a low-grade commodity text generator and triggers spam filters.",
        caseSensitive: false,
        status: "active",
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        id: "term-003",
        brandId,
        type: "avoided",
        term: "supercharge",
        replacement: "accelerate / streamline / optimize",
        reason: "Generic SaaS cliché banned under our Brand Voice policy.",
        caseSensitive: false,
        status: "active",
        createdAt: new Date(Date.now() - 18 * 86400000).toISOString()
      },
      {
        id: "term-004",
        brandId,
        type: "preferred",
        term: "Brand Brain",
        preferredUsage: "Always capitalize as a proper noun when referring to OmniRank's knowledge architecture.",
        reason: "Core proprietary terminology.",
        caseSensitive: true,
        status: "active",
        createdAt: new Date(Date.now() - 18 * 86400000).toISOString()
      }
    ];
    terms.forEach((t) => this.store.terminology.set(t.id, t));

    // 7. Policies (with severity levels: suggestion, warning, blocking)
    const policies: BrandPolicy[] = [
      {
        id: "pol-001",
        brandId,
        title: "Mandatory Evidence Citation for Numerical Claims",
        description: "Any statistical claim, benchmark metric, market percentage, or latency figure must cite a primary source, official documentation, or verified study.",
        category: "factual_claim",
        severity: "blocking",
        enforcementAction: "Rejects article approval until citation URL or footnote is verified.",
        status: "active",
        createdAt: new Date(Date.now() - 26 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
      },
      {
        id: "pol-002",
        brandId,
        title: "Zero Defamation in Competitor Comparisons",
        description: "Competitor comparisons must be objective, fair, and cite published feature matrices or documentation. Never use disparaging or derogatory language.",
        category: "competitor_reference",
        severity: "blocking",
        enforcementAction: "Flags block for mandatory senior strategist review before publishing.",
        status: "active",
        createdAt: new Date(Date.now() - 24 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: "pol-003",
        brandId,
        title: "Banned AI Slop Clichés",
        description: "Disallow terms like 'delve', 'supercharge', 'in conclusion', 'beacon of hope', 'tapestry', and 'game-changer'.",
        category: "editorial_style",
        severity: "warning",
        enforcementAction: "Highlights banned phrases in editor with one-click replacement suggestions.",
        status: "active",
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString()
      },
      {
        id: "pol-004",
        brandId,
        title: "Current Pricing Disclaimers",
        description: "Whenever specific SaaS pricing tiers are cited, include a footnote noting that pricing is accurate as of the publication date.",
        category: "pricing_mention",
        severity: "suggestion",
        enforcementAction: "Suggests inserting the standard pricing disclaimer callout block.",
        status: "active",
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ];
    policies.forEach((pol) => this.store.policies.set(pol.id, pol));

    // 8. Competitors
    const competitors: BrandCompetitor[] = [
      {
        id: "comp-001",
        brandId,
        name: "SurferSEO",
        domain: "surferseo.com",
        positioning: "Content optimization and keyword density analyzer for freelance writers.",
        keyStrengths: ["Strong keyword NLP scoring", "Broad market awareness in affiliate SEO"],
        keyWeaknesses: ["Lacks multi-block structured article CMS", "No enterprise Brand Brain policy enforcement", "Promotes keyword stuffing"],
        differentiator: "OmniRank enforces brand policy guardrails, evidence verification, and deterministic block JSON rather than raw text dumping.",
        notes: "Position as enterprise growth OS vs their single-article keyword checker.",
        status: "active",
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 86400000).toISOString()
      },
      {
        id: "comp-002",
        brandId,
        name: "Jasper AI",
        domain: "jasper.ai",
        positioning: "Broad AI marketing copywriting assistant for generic social and blog posts.",
        keyStrengths: ["Extensive template library", "High consumer brand recognition"],
        keyWeaknesses: ["Heavy hallucination rate on deep technical topics", "No native Search Console rank loop", "Weak technical block support"],
        differentiator: "OmniRank is built for technical accuracy, developer/growth teams, and verifiable search traffic.",
        notes: "Target customers frustrated by high hallucination rates and lack of technical depth.",
        status: "active",
        createdAt: new Date(Date.now() - 16 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ];
    competitors.forEach((c) => this.store.competitors.set(c.id, c));

    // 9. Initial Audit Logs
    this.store.auditLogs.push(
      {
        id: "audit-001",
        brandId,
        userId: "usr-admin-01",
        userName: "Arooj Fatima",
        entityType: "profile",
        entityId: "profile-001",
        action: "create",
        summary: "Initialized Brand Brain profile and core positioning statements.",
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        id: "audit-002",
        brandId,
        userId: "usr-admin-01",
        userName: "Arooj Fatima",
        entityType: "policy",
        entityId: "pol-001",
        action: "create",
        summary: "Added blocking policy: Mandatory Evidence Citation for Numerical Claims.",
        createdAt: new Date(Date.now() - 26 * 86400000).toISOString()
      },
      {
        id: "audit-003",
        brandId,
        userId: "usr-admin-01",
        userName: "Arooj Fatima",
        entityType: "product",
        entityId: "prod-001",
        action: "create",
        summary: "Registered core product: OmniRank Growth Cloud.",
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
      },
      {
        id: "audit-004",
        brandId,
        userId: "usr-admin-01",
        userName: "Arooj Fatima",
        entityType: "policy",
        entityId: "pol-003",
        action: "update",
        summary: "Updated warning policy for Banned AI Slop Clichés.",
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    );
  }

  // Authorization check helper
  public checkPermission(
    orgRole: OrgRole,
    brandRole: BrandRole,
    requiredBrandRoles: BrandRole[],
    requiredOrgRoles: OrgRole[] = ["owner", "admin"]
  ): boolean {
    if (requiredOrgRoles.includes(orgRole)) return true;
    return requiredBrandRoles.includes(brandRole);
  }

  // Completeness score calculator
  public calculateCompleteness(brandId: string): number {
    let score = 0;
    const profile = this.store.profiles.get(brandId);
    if (profile && profile.mission && profile.positioningStatement) score += 20;

    const products = Array.from(this.store.products.values()).filter(
      (p) => p.brandId === brandId && p.status === "active"
    );
    if (products.length >= 1) score += 15;
    if (products.length >= 3) score += 5;

    const audiences = Array.from(this.store.audiences.values()).filter(
      (a) => a.brandId === brandId && a.status === "active"
    );
    if (audiences.length >= 1) score += 15;

    const voice = this.store.voiceProfiles.get(brandId);
    if (voice && voice.archetype && voice.styleGuidelines) score += 15;

    const voiceExamples = Array.from(this.store.voiceExamples.values()).filter(
      (ve) => ve.brandId === brandId
    );
    if (voiceExamples.length >= 2) score += 10;

    const policies = Array.from(this.store.policies.values()).filter(
      (pol) => pol.brandId === brandId && pol.status === "active"
    );
    if (policies.length >= 1) score += 10;

    const competitors = Array.from(this.store.competitors.values()).filter(
      (c) => c.brandId === brandId && c.status === "active"
    );
    if (competitors.length >= 1) score += 10;

    return Math.min(100, score);
  }

  // Fetch complete knowledge for a brand
  public getBrandBrain(brandId: string): BrandBrainKnowledge {
    let profile = this.store.profiles.get(brandId);
    if (!profile) {
      profile = {
        id: `profile-${brandId}`,
        brandId,
        mission: "",
        positioningStatement: "",
        targetMarket: "",
        valueProposition: "",
        toneKeywords: ["authoritative", "pragmatic"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.store.profiles.set(brandId, profile);
    }

    let voiceProfile = this.store.voiceProfiles.get(brandId);
    if (!voiceProfile) {
      voiceProfile = {
        id: `voice-${brandId}`,
        brandId,
        archetype: "The Pragmatic Expert",
        formalityScore: 3,
        enthusiasmScore: 3,
        technicalDepthScore: 4,
        humorScore: 2,
        readingGradeLevel: "Professional / Grade 10-12",
        primaryToneTraits: ["authoritative", "evidence-backed", "clear"],
        styleGuidelines: "Write clearly and accurately.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.store.voiceProfiles.set(brandId, voiceProfile);
    }

    const products = Array.from(this.store.products.values()).filter((p) => p.brandId === brandId);
    const audiences = Array.from(this.store.audiences.values()).filter((a) => a.brandId === brandId);
    const voiceExamples = Array.from(this.store.voiceExamples.values()).filter((ve) => ve.brandId === brandId);
    const terminology = Array.from(this.store.terminology.values()).filter((t) => t.brandId === brandId);
    const policies = Array.from(this.store.policies.values()).filter((p) => p.brandId === brandId);
    const competitors = Array.from(this.store.competitors.values()).filter((c) => c.brandId === brandId);
    const sources = brandBrainIngestion.getSources(brandId);
    const documents = brandBrainIngestion.getDocuments(brandId);
    const evidenceClaims = brandBrainIngestion.getEvidenceClaims(brandId);
    const evidenceSources = brandBrainIngestion.getEvidenceSources(brandId);
    const recentAuditLogs = this.store.auditLogs
      .filter((l) => l.brandId === brandId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return {
      profile,
      products,
      audiences,
      voiceProfile,
      voiceExamples,
      terminology,
      policies,
      competitors,
      sources,
      documents,
      evidenceClaims,
      evidenceSources,
      recentAuditLogs,
      completenessScore: this.calculateCompleteness(brandId)
    };
  }

  // Audit logger
  public logAudit(log: Omit<BrandAuditLog, "id" | "createdAt">): BrandAuditLog {
    const entry: BrandAuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.store.auditLogs.unshift(entry);
    return entry;
  }

  // Mutations: Profile
  public updateProfile(
    brandId: string,
    updates: Partial<BrandProfileDetails>,
    user: { id: string; name: string }
  ): BrandProfileDetails {
    const current = this.getBrandBrain(brandId).profile;
    const updated: BrandProfileDetails = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.store.profiles.set(brandId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "profile",
      entityId: updated.id,
      action: "update",
      summary: "Updated core Brand Brain profile and positioning statements."
    });
    return updated;
  }

  // Mutations: Products
  public createProduct(
    brandId: string,
    data: Omit<BrandProduct, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string }
  ): BrandProduct {
    const product: BrandProduct = {
      ...data,
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.products.set(product.id, product);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "product",
      entityId: product.id,
      action: "create",
      summary: `Created product offering: "${product.name}".`
    });
    return product;
  }

  public updateProduct(
    brandId: string,
    productId: string,
    updates: Partial<BrandProduct>,
    user: { id: string; name: string }
  ): BrandProduct {
    const current = this.store.products.get(productId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Product not found for this brand");
    }
    const updated: BrandProduct = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.store.products.set(productId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "product",
      entityId: productId,
      action: "update",
      summary: `Updated product details for "${updated.name}".`
    });
    return updated;
  }

  public toggleArchiveProduct(
    brandId: string,
    productId: string,
    user: { id: string; name: string }
  ): BrandProduct {
    const current = this.store.products.get(productId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Product not found");
    }
    const newStatus = current.status === "active" ? "archived" : "active";
    current.status = newStatus;
    current.updatedAt = new Date().toISOString();
    this.store.products.set(productId, current);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "product",
      entityId: productId,
      action: newStatus === "archived" ? "archive" : "unarchive",
      summary: `${newStatus === "archived" ? "Archived" : "Restored"} product "${current.name}".`
    });
    return current;
  }

  // Mutations: Audiences
  public createAudience(
    brandId: string,
    data: Omit<BrandAudience, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string }
  ): BrandAudience {
    const audience: BrandAudience = {
      ...data,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.audiences.set(audience.id, audience);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "audience",
      entityId: audience.id,
      action: "create",
      summary: `Defined target audience persona: "${audience.name}".`
    });
    return audience;
  }

  public updateAudience(
    brandId: string,
    audienceId: string,
    updates: Partial<BrandAudience>,
    user: { id: string; name: string }
  ): BrandAudience {
    const current = this.store.audiences.get(audienceId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Audience not found");
    }
    const updated: BrandAudience = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.store.audiences.set(audienceId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "audience",
      entityId: audienceId,
      action: "update",
      summary: `Updated audience details for "${updated.name}".`
    });
    return updated;
  }

  public toggleArchiveAudience(
    brandId: string,
    audienceId: string,
    user: { id: string; name: string }
  ): BrandAudience {
    const current = this.store.audiences.get(audienceId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Audience not found");
    }
    const newStatus = current.status === "active" ? "archived" : "active";
    current.status = newStatus;
    current.updatedAt = new Date().toISOString();
    this.store.audiences.set(audienceId, current);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "audience",
      entityId: audienceId,
      action: newStatus === "archived" ? "archive" : "unarchive",
      summary: `${newStatus === "archived" ? "Archived" : "Restored"} audience "${current.name}".`
    });
    return current;
  }

  // Mutations: Voice Profile & Examples
  public updateVoiceProfile(
    brandId: string,
    updates: Partial<BrandVoiceProfile>,
    user: { id: string; name: string }
  ): BrandVoiceProfile {
    const current = this.getBrandBrain(brandId).voiceProfile;
    const updated: BrandVoiceProfile = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.store.voiceProfiles.set(brandId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "voice",
      entityId: updated.id,
      action: "update",
      summary: `Updated Brand Voice archetype (${updated.archetype}) and tone trait scores.`
    });
    return updated;
  }

  public createVoiceExample(
    brandId: string,
    data: Omit<BrandVoiceExample, "id" | "brandId" | "createdAt">,
    user: { id: string; name: string }
  ): BrandVoiceExample {
    const example: BrandVoiceExample = {
      ...data,
      id: `ve-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      createdAt: new Date().toISOString()
    };
    this.store.voiceExamples.set(example.id, example);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "voice",
      entityId: example.id,
      action: "create",
      summary: `Added ${example.type.toUpperCase()} voice example: "${example.title}".`
    });
    return example;
  }

  public deleteVoiceExample(
    brandId: string,
    exampleId: string,
    user: { id: string; name: string }
  ): boolean {
    const current = this.store.voiceExamples.get(exampleId);
    if (!current || current.brandId !== brandId) return false;
    this.store.voiceExamples.delete(exampleId);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "voice",
      entityId: exampleId,
      action: "delete",
      summary: `Deleted voice example "${current.title}".`
    });
    return true;
  }

  // Mutations: Terminology
  public createTerminology(
    brandId: string,
    data: Omit<BrandTerminology, "id" | "brandId" | "createdAt">,
    user: { id: string; name: string }
  ): BrandTerminology {
    const term: BrandTerminology = {
      ...data,
      id: `term-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      createdAt: new Date().toISOString()
    };
    this.store.terminology.set(term.id, term);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "terminology",
      entityId: term.id,
      action: "create",
      summary: `Registered ${term.type} term "${term.term}".`
    });
    return term;
  }

  public toggleArchiveTerminology(
    brandId: string,
    termId: string,
    user: { id: string; name: string }
  ): BrandTerminology {
    const current = this.store.terminology.get(termId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Terminology item not found");
    }
    const newStatus = current.status === "active" ? "archived" : "active";
    current.status = newStatus;
    this.store.terminology.set(termId, current);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "terminology",
      entityId: termId,
      action: newStatus === "archived" ? "archive" : "unarchive",
      summary: `${newStatus === "archived" ? "Archived" : "Restored"} term "${current.term}".`
    });
    return current;
  }

  public updateTerminology(
    brandId: string,
    termId: string,
    updates: Partial<Omit<BrandTerminology, "id" | "brandId" | "createdAt">>,
    user: { id: string; name: string }
  ): BrandTerminology {
    const current = this.store.terminology.get(termId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Terminology item not found");
    }
    const updated: BrandTerminology = {
      ...current,
      ...updates,
    };
    this.store.terminology.set(termId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "terminology",
      entityId: termId,
      action: "update",
      summary: `Updated terminology "${updated.term}".`
    });
    return updated;
  }

  // Mutations: Policies (suggestion, warning, blocking)
  public createPolicy(
    brandId: string,
    data: Omit<BrandPolicy, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string }
  ): BrandPolicy {
    const policy: BrandPolicy = {
      ...data,
      id: `pol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.policies.set(policy.id, policy);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "policy",
      entityId: policy.id,
      action: "create",
      summary: `Created ${policy.severity.toUpperCase()} policy: "${policy.title}".`
    });
    return policy;
  }

  public updatePolicy(
    brandId: string,
    policyId: string,
    updates: Partial<BrandPolicy>,
    user: { id: string; name: string }
  ): BrandPolicy {
    const current = this.store.policies.get(policyId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Policy not found");
    }
    const updated: BrandPolicy = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.store.policies.set(policyId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "policy",
      entityId: policyId,
      action: "update",
      summary: `Updated ${updated.severity.toUpperCase()} policy: "${updated.title}".`
    });
    return updated;
  }

  public toggleArchivePolicy(
    brandId: string,
    policyId: string,
    user: { id: string; name: string }
  ): BrandPolicy {
    const current = this.store.policies.get(policyId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Policy not found");
    }
    const newStatus = current.status === "active" ? "archived" : "active";
    current.status = newStatus;
    current.updatedAt = new Date().toISOString();
    this.store.policies.set(policyId, current);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "policy",
      entityId: policyId,
      action: newStatus === "archived" ? "archive" : "unarchive",
      summary: `${newStatus === "archived" ? "Archived" : "Restored"} policy "${current.title}".`
    });
    return current;
  }

  // Mutations: Competitors
  public createCompetitor(
    brandId: string,
    data: Omit<BrandCompetitor, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string }
  ): BrandCompetitor {
    const competitor: BrandCompetitor = {
      ...data,
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.store.competitors.set(competitor.id, competitor);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "competitor",
      entityId: competitor.id,
      action: "create",
      summary: `Added competitor tracking: "${competitor.name}" (${competitor.domain}).`
    });
    return competitor;
  }

  public updateCompetitor(
    brandId: string,
    competitorId: string,
    updates: Partial<BrandCompetitor>,
    user: { id: string; name: string }
  ): BrandCompetitor {
    const current = this.store.competitors.get(competitorId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Competitor not found");
    }
    const updated: BrandCompetitor = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.store.competitors.set(competitorId, updated);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "competitor",
      entityId: competitorId,
      action: "update",
      summary: `Updated competitor profile for "${updated.name}".`
    });
    return updated;
  }

  public toggleArchiveCompetitor(
    brandId: string,
    competitorId: string,
    user: { id: string; name: string }
  ): BrandCompetitor {
    const current = this.store.competitors.get(competitorId);
    if (!current || current.brandId !== brandId) {
      throw new Error("Competitor not found");
    }
    const newStatus = current.status === "active" ? "archived" : "active";
    current.status = newStatus;
    current.updatedAt = new Date().toISOString();
    this.store.competitors.set(competitorId, current);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "competitor",
      entityId: competitorId,
      action: newStatus === "archived" ? "archive" : "unarchive",
      summary: `${newStatus === "archived" ? "Archived" : "Restored"} competitor "${current.name}".`
    });
    return current;
  }

  // --- Persistent Database-Backed Async Methods (OR-G04C) ---

  public async getBrandBrainAsync(brandId: string, accessToken?: string): Promise<BrandBrainKnowledge> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.getBrandBrain(brandId, accessToken);
    }
    return this.getBrandBrain(brandId);
  }

  public async updateProfileAsync(
    brandId: string,
    profile: Partial<BrandProfileDetails>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProfileDetails> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.updateProfile(brandId, profile, user, accessToken);
    }
    return this.updateProfile(brandId, profile, user);
  }

  public async createProductAsync(
    brandId: string,
    input: Omit<BrandProduct, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProduct> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.createProduct(brandId, input, user, accessToken);
    }
    return this.createProduct(brandId, input, user);
  }

  public async updateProductAsync(
    brandId: string,
    productId: string,
    input: Partial<BrandProduct>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProduct> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.updateProduct(brandId, productId, input, user, accessToken);
    }
    return this.updateProduct(brandId, productId, input, user);
  }

  public async toggleArchiveProductAsync(
    brandId: string,
    productId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProduct> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.toggleArchiveProduct(brandId, productId, user, accessToken);
    }
    return this.toggleArchiveProduct(brandId, productId, user);
  }

  public async deleteProductAsync(
    brandId: string,
    productId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.deleteProduct(brandId, productId, user, accessToken);
    }
    return this.deleteProduct(brandId, productId, user);
  }

  public async createAudienceAsync(
    brandId: string,
    input: Omit<BrandAudience, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandAudience> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.createAudience(brandId, input, user, accessToken);
    }
    return this.createAudience(brandId, input, user);
  }

  public async updateAudienceAsync(
    brandId: string,
    audienceId: string,
    input: Partial<BrandAudience>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandAudience> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.updateAudience(brandId, audienceId, input, user, accessToken);
    }
    return this.updateAudience(brandId, audienceId, input, user);
  }

  public async toggleArchiveAudienceAsync(
    brandId: string,
    audienceId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandAudience> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.toggleArchiveAudience(brandId, audienceId, user, accessToken);
    }
    return this.toggleArchiveAudience(brandId, audienceId, user);
  }

  public async deleteAudienceAsync(
    brandId: string,
    audienceId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.deleteAudience(brandId, audienceId, user, accessToken);
    }
    return this.deleteAudience(brandId, audienceId, user);
  }

  public async updateVoiceProfileAsync(
    brandId: string,
    input: Partial<BrandVoiceProfile>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandVoiceProfile> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.updateVoiceProfile(brandId, input, user, accessToken);
    }
    return this.updateVoiceProfile(brandId, input, user);
  }

  public async createVoiceExampleAsync(
    brandId: string,
    input: Omit<BrandVoiceExample, "id" | "brandId" | "createdAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandVoiceExample> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.createVoiceExample(brandId, input, user, accessToken);
    }
    return this.createVoiceExample(brandId, input, user);
  }

  public async deleteVoiceExampleAsync(
    brandId: string,
    exampleId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.deleteVoiceExample(brandId, exampleId, user, accessToken);
    }
    return this.deleteVoiceExample(brandId, exampleId, user);
  }

  public async createTerminologyAsync(
    brandId: string,
    input: Omit<BrandTerminology, "id" | "brandId" | "createdAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandTerminology> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.createTerminology(brandId, input, user, accessToken);
    }
    return this.createTerminology(brandId, input, user);
  }

  public async deleteTerminologyAsync(
    brandId: string,
    termId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.deleteTerminology(brandId, termId, user, accessToken);
    }
    return this.deleteTerminology(brandId, termId, user);
  }

  public async createPolicyAsync(
    brandId: string,
    input: Omit<BrandPolicy, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandPolicy> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.createPolicy(brandId, input, user, accessToken);
    }
    return this.createPolicy(brandId, input, user);
  }

  public async updatePolicyAsync(
    brandId: string,
    policyId: string,
    input: Partial<BrandPolicy>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandPolicy> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.updatePolicy(brandId, policyId, input, user, accessToken);
    }
    return this.updatePolicy(brandId, policyId, input, user);
  }

  public async toggleArchivePolicyAsync(
    brandId: string,
    policyId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandPolicy> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.toggleArchivePolicy(brandId, policyId, user, accessToken);
    }
    return this.toggleArchivePolicy(brandId, policyId, user);
  }

  public async createCompetitorAsync(
    brandId: string,
    input: Omit<BrandCompetitor, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandCompetitor> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.createCompetitor(brandId, input, user, accessToken);
    }
    return this.createCompetitor(brandId, input, user);
  }

  public async updateCompetitorAsync(
    brandId: string,
    competitorId: string,
    input: Partial<BrandCompetitor>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandCompetitor> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.updateCompetitor(brandId, competitorId, input, user, accessToken);
    }
    return this.updateCompetitor(brandId, competitorId, input, user);
  }

  public async toggleArchiveCompetitorAsync(
    brandId: string,
    competitorId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandCompetitor> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.toggleArchiveCompetitor(brandId, competitorId, user, accessToken);
    }
    return this.toggleArchiveCompetitor(brandId, competitorId, user);
  }

  public deleteProduct(
    brandId: string,
    productId: string,
    user: { id: string; name: string }
  ): boolean {
    const product = this.store.products.get(productId);
    if (!product || product.brandId !== brandId) return false;
    this.store.products.delete(productId);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "product",
      entityId: productId,
      action: "delete",
      summary: `Deleted product offering "${product.name}".`
    });
    return true;
  }

  public deleteAudience(
    brandId: string,
    audienceId: string,
    user: { id: string; name: string }
  ): boolean {
    const audience = this.store.audiences.get(audienceId);
    if (!audience || audience.brandId !== brandId) return false;
    this.store.audiences.delete(audienceId);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "audience",
      entityId: audienceId,
      action: "delete",
      summary: `Deleted target audience persona "${audience.name}".`
    });
    return true;
  }

  public deleteTerminology(
    brandId: string,
    termId: string,
    user: { id: string; name: string }
  ): boolean {
    const term = this.store.terminology.get(termId);
    if (!term || term.brandId !== brandId) return false;
    this.store.terminology.delete(termId);
    this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: "terminology",
      entityId: termId,
      action: "delete",
      summary: `Deleted terminology "${term.term}".`
    });
    return true;
  }

  public getAuditHistory(brandId: string): BrandAuditLog[] {
    return this.store.auditLogs
      .filter((l) => l.brandId === brandId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async logAuditAsync(
    brandIdOrLog: string | Omit<BrandAuditLog, "id" | "createdAt">,
    userOrAccessToken?: { id: string; name: string } | string,
    entityType?: "profile" | "product" | "audience" | "voice" | "terminology" | "policy" | "competitor",
    entityId?: string,
    action?: "create" | "update" | "archive" | "unarchive" | "delete",
    summary?: string,
    details?: Record<string, unknown>,
    _accessToken?: string
  ): Promise<BrandAuditLog> {
    if (typeof brandIdOrLog === "object") {
      const log = brandIdOrLog;
      if (isLiveSupabaseConfigured()) {
        return await supabaseBrandBrainCoreRepo.logAudit(
          log.brandId,
          { id: log.userId, name: log.userName },
          log.entityType as any,
          log.entityId,
          log.action,
          log.summary,
          log.details || {}
        );
      }
      return this.logAudit(log);
    }

    const brandId = brandIdOrLog;
    const user = userOrAccessToken as { id: string; name: string };
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.logAudit(
        brandId,
        user,
        entityType || "profile",
        entityId || "unknown",
        action || "create",
        summary || "",
        details || {}
      );
    }
    return this.logAudit({
      brandId,
      userId: user.id,
      userName: user.name,
      entityType: (entityType || "profile") as any,
      entityId: entityId || "unknown",
      action: (action || "create") as any,
      summary: summary || "",
      details,
    });
  }

  public async getAuditHistoryAsync(brandId: string, accessToken?: string): Promise<BrandAuditLog[]> {
    if (isLiveSupabaseConfigured()) {
      return await supabaseBrandBrainCoreRepo.getAuditHistory(brandId, accessToken);
    }
    return this.getAuditHistory(brandId);
  }
}

export const brandBrainRepo = new BrandBrainRepository();
