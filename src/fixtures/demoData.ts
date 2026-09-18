import {
  Organization,
  Brand,
  Website,
  UserProfile,
  OrganizationMember,
  BrandMember,
  BrandProduct,
  BrandAudience,
  BrandVoiceProfile,
  BrandVoiceExample,
  BrandTerminology,
  BrandPolicy,
  BrandCompetitor,
  BrandAuditLog,
} from "../types/index.ts";

/**
 * Dedicated Demo Fixtures Module (OR-G04A - Requirement 11)
 *
 * Invariants:
 * 1. Demo fixtures are used ONLY when DEMO_MODE === true in development/test.
 * 2. Demo data is NEVER silently mixed into production tables or production migrations.
 * 3. Centralizes all Acme, Alex Rivera, and Nexus demo entities in one place.
 */

export const DEMO_USER_ALEX: UserProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "alex@omnirank.ai",
  fullName: "Alex Rivera",
  orgRole: "owner",
  brandRole: "strategist",
};

export const DEMO_USER_SARAH: UserProfile = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "sarah@omnirank.ai",
  fullName: "Sarah Chen",
  orgRole: "admin",
  brandRole: "writer",
};

export const DEMO_USER_MARCUS: UserProfile = {
  id: "00000000-0000-4000-8000-000000000003",
  email: "marcus@omnirank.ai",
  fullName: "Marcus Vance",
  orgRole: "member",
  brandRole: "reviewer",
};

export const DEMO_USER_ELENA: UserProfile = {
  id: "00000000-0000-4000-8000-000000000004",
  email: "elena@omnirank.ai",
  fullName: "Elena Rostova",
  orgRole: "member",
  brandRole: "viewer",
};

export const DEMO_USER_UNRELATED: UserProfile = {
  id: "00000000-0000-4000-8000-000000000099",
  email: "stranger@external.org",
  fullName: "Unrelated User",
  orgRole: "member",
  brandRole: "viewer",
};

export const DEMO_ORGANIZATION_ACME: Organization = {
  id: "11111111-1111-4000-8000-111111111111",
  name: "Acme Growth Media",
  slug: "acme-growth-media",
  createdBy: DEMO_USER_ALEX.id,
  createdAt: "2026-01-15T08:00:00Z",
  updatedAt: "2026-01-15T08:00:00Z",
};

export const DEMO_ORGANIZATION_NEXUS: Organization = {
  id: "22222222-2222-4000-8000-222222222222",
  name: "Nexus Ventures Corp",
  slug: "nexus-ventures",
  createdBy: DEMO_USER_ALEX.id,
  createdAt: "2026-02-10T11:00:00Z",
  updatedAt: "2026-02-10T11:00:00Z",
};

export const DEMO_BRAND_ACME_CLOUD: Brand = {
  id: "33333333-3333-4000-8000-333333333331",
  organizationId: DEMO_ORGANIZATION_ACME.id,
  name: "Acme Cloud",
  slug: "acme-cloud",
  primaryDomain: "acmecloud.io",
  industry: "B2B SaaS / DevOps",
  createdAt: "2026-01-15T08:30:00Z",
  updatedAt: "2026-01-15T08:30:00Z",
};

export const DEMO_BRAND_ACME_SECURITY: Brand = {
  id: "33333333-3333-4000-8000-333333333332",
  organizationId: DEMO_ORGANIZATION_ACME.id,
  name: "Acme Security",
  slug: "acme-security",
  primaryDomain: "acmesec.com",
  industry: "Cybersecurity",
  createdAt: "2026-02-01T09:00:00Z",
  updatedAt: "2026-02-01T09:00:00Z",
};

export const DEMO_BRAND_NEXUS_AI: Brand = {
  id: "33333333-3333-4000-8000-333333333333",
  organizationId: DEMO_ORGANIZATION_NEXUS.id,
  name: "Nexus AI Lab",
  slug: "nexus-ai",
  primaryDomain: "nexusai.tech",
  industry: "Artificial Intelligence",
  createdAt: "2026-02-10T11:30:00Z",
  updatedAt: "2026-02-10T11:30:00Z",
};

export const DEMO_WEBSITE_ACME_CLOUD: Website = {
  id: "55555555-5555-4000-8000-555555555551",
  organizationId: DEMO_ORGANIZATION_ACME.id,
  brandId: DEMO_BRAND_ACME_CLOUD.id,
  domain: "acmecloud.io",
  sitemapUrl: "https://acmecloud.io/sitemap.xml",
  status: "active",
  createdAt: "2026-01-15T09:00:00Z",
  updatedAt: "2026-01-15T09:00:00Z",
};

export const DEMO_WEBSITE_ACME_SECURITY: Website = {
  id: "55555555-5555-4000-8000-555555555552",
  organizationId: DEMO_ORGANIZATION_ACME.id,
  brandId: DEMO_BRAND_ACME_SECURITY.id,
  domain: "acmesec.com",
  sitemapUrl: "https://acmesec.com/sitemap.xml",
  status: "active",
  createdAt: "2026-02-01T09:30:00Z",
  updatedAt: "2026-02-01T09:30:00Z",
};

export const DEMO_ORG_MEMBERS: OrganizationMember[] = [
  {
    id: "om-01",
    organizationId: DEMO_ORGANIZATION_ACME.id,
    userId: DEMO_USER_ALEX.id,
    role: "owner",
    createdAt: "2026-01-15T08:00:00Z",
    profile: {
      id: DEMO_USER_ALEX.id,
      email: DEMO_USER_ALEX.email,
      fullName: DEMO_USER_ALEX.fullName,
      createdAt: "2026-01-15T08:00:00Z",
      updatedAt: "2026-01-15T08:00:00Z",
    },
  },
  {
    id: "om-02",
    organizationId: DEMO_ORGANIZATION_ACME.id,
    userId: DEMO_USER_SARAH.id,
    role: "admin",
    createdAt: "2026-01-20T10:00:00Z",
    profile: {
      id: DEMO_USER_SARAH.id,
      email: DEMO_USER_SARAH.email,
      fullName: DEMO_USER_SARAH.fullName,
      createdAt: "2026-01-20T10:00:00Z",
      updatedAt: "2026-01-20T10:00:00Z",
    },
  },
  {
    id: "om-03",
    organizationId: DEMO_ORGANIZATION_ACME.id,
    userId: DEMO_USER_MARCUS.id,
    role: "member",
    createdAt: "2026-02-01T12:00:00Z",
    profile: {
      id: DEMO_USER_MARCUS.id,
      email: DEMO_USER_MARCUS.email,
      fullName: DEMO_USER_MARCUS.fullName,
      createdAt: "2026-02-01T12:00:00Z",
      updatedAt: "2026-02-01T12:00:00Z",
    },
  },
];

export const DEMO_BRAND_MEMBERS: BrandMember[] = [
  {
    id: "bm-01",
    brandId: DEMO_BRAND_ACME_CLOUD.id,
    userId: DEMO_USER_ALEX.id,
    role: "strategist",
    createdAt: "2026-01-15T08:30:00Z",
    profile: {
      id: DEMO_USER_ALEX.id,
      email: DEMO_USER_ALEX.email,
      fullName: DEMO_USER_ALEX.fullName,
      createdAt: "2026-01-15T08:00:00Z",
      updatedAt: "2026-01-15T08:00:00Z",
    },
  },
  {
    id: "bm-02",
    brandId: DEMO_BRAND_ACME_CLOUD.id,
    userId: DEMO_USER_SARAH.id,
    role: "writer",
    createdAt: "2026-01-20T10:30:00Z",
    profile: {
      id: DEMO_USER_SARAH.id,
      email: DEMO_USER_SARAH.email,
      fullName: DEMO_USER_SARAH.fullName,
      createdAt: "2026-01-20T10:00:00Z",
      updatedAt: "2026-01-20T10:00:00Z",
    },
  },
  {
    id: "bm-03",
    brandId: DEMO_BRAND_ACME_CLOUD.id,
    userId: DEMO_USER_MARCUS.id,
    role: "reviewer",
    createdAt: "2026-02-01T12:30:00Z",
    profile: {
      id: DEMO_USER_MARCUS.id,
      email: DEMO_USER_MARCUS.email,
      fullName: DEMO_USER_MARCUS.fullName,
      createdAt: "2026-02-01T12:00:00Z",
      updatedAt: "2026-02-01T12:00:00Z",
    },
  },
];

export function getDemoBrandBrain(brandId: string) {
  return {
    profile: {
      id: "profile-001",
      brandId,
      mission: "Empower engineering and growth teams to dominate organic and AI search engines with authoritative, evidence-backed technical content.",
      positioningStatement: "OmniRank is the enterprise AI Content Growth OS that bridges deep technical accuracy with continuous organic search performance.",
      targetMarket: "B2B SaaS, Cloud Infrastructure, Developer Tools, and Enterprise AI companies.",
      valueProposition: "Automated content research, GEO/SEO optimization, and block-based editorial workflows with zero AI hallucination risk.",
      toneKeywords: ["authoritative", "pragmatic", "architectural", "evidence-backed", "direct"],
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    products: [
      {
        id: "prod-001",
        brandId,
        name: "OmniRank Growth Cloud",
        category: "Enterprise Software",
        valueProposition: "Autonomous SEO & GEO intelligence engine with automated competitor gap analysis and real-time Search Console sync.",
        keyFeatures: ["Search Console & GA4 Integration", "Competitor Opportunity Graph", "Algorithmic Rank Tracking", "Automatic Gap Detection"],
        targetAudience: "VP Growth & Marketing Leaders",
        pricingSummary: "$1,499/mo per brand seat with unlimited block generation",
        status: "active" as const,
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
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
        status: "active" as const,
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
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
        status: "active" as const,
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    audiences: [
      {
        id: "aud-001",
        brandId,
        name: "VP of Growth & Demand Gen",
        jobTitle: "VP Marketing / Growth Lead",
        painPoints: [
          "Generic AI-written content gets penalized or ignored by search algorithms",
          "Lack of engineering domain depth in outsourced freelance articles",
          "Inability to attribute organic traffic to specific high-intent conversions",
        ],
        goals: [
          "Rank top 3 for high-value transactional and architectural keywords",
          "Scale technical article publishing velocity by 5x without lowering editorial standards",
          "Ensure GEO visibility in AI Overviews and Perplexity answer engines",
        ],
        objections: [
          "AI content creates brand reputational risk if ungrounded",
          "Engineers refuse to approve marketing articles that contain technical inaccuracies",
        ],
        preferredChannels: ["Technical Blogs", "Hacker News", "Substack Deep Dives", "Gartner/Forrester Reports"],
        status: "active" as const,
        createdAt: new Date(Date.now() - 24 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      },
      {
        id: "aud-002",
        brandId,
        name: "Technical Content Architect",
        jobTitle: "Principal Tech Writer / Staff Editor",
        painPoints: [
          "Manual formatting of complex tables, citations, and comparison blocks takes hours",
          "Junior contributors frequently hallucinate technical syntax and API methods",
          "Context switching between multiple SEO keyword checkers and the CMS",
        ],
        goals: [
          "Enforce strict style and voice guardrails automatically",
          "Generate verified citations linked directly to official documentation",
          "Export validated Block JSON to headless CMS platforms effortlessly",
        ],
        objections: [
          "Reluctant to use automated tools that produce unmaintainable HTML junk",
        ],
        preferredChannels: ["GitHub", "Discord Tech Communities", "Engineering RFCs"],
        status: "active" as const,
        createdAt: new Date(Date.now() - 16 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    voiceProfile: {
      id: "voice-001",
      brandId,
      archetype: "The Pragmatic Architect",
      formalityScore: 4,
      enthusiasmScore: 2,
      technicalDepthScore: 5,
      humorScore: 1,
      readingGradeLevel: "Grade 11 - 12 (Technical/Professional)",
      primaryToneTraits: ["authoritative", "evidence-backed", "architectural", "direct"],
      styleGuidelines: "Write with structural precision. Ground every major performance claim with concrete benchmarks.",
      createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    voiceExamples: [
      {
        id: "ve-001",
        brandId,
        type: "do" as const,
        title: "Concrete Engineering Statements",
        snippet: "OmniRank isolates each brand's vector index using dedicated tenant schemas, reducing retrieval cross-talk to zero.",
        explanation: "Speaks to specific architecture with precise terminology without superficial marketing buzzwords.",
        category: "Product Description",
        createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
      },
      {
        id: "ve-002",
        brandId,
        type: "dont" as const,
        title: "Superficial Fluff & Hyperbole",
        snippet: "OmniRank will supercharge your content and take your digital presence to the next stratosphere with effortless AI magic!",
        explanation: "Contains banned clichés ('supercharge', 'effortless AI magic'). Violates pragmatism policy.",
        category: "Marketing Copy",
        createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
      },
      {
        id: "ve-003",
        brandId,
        type: "do" as const,
        title: "Action-Oriented Call to Action",
        snippet: "Inspect the reproducible benchmark repository on GitHub or configure your first OmniRouter task pipeline in under 3 minutes.",
        explanation: "Low friction, high specificity, zero aggressive sales pressure.",
        category: "CTA",
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
    ],
    terminology: [
      {
        id: "term-001",
        brandId,
        type: "preferred" as const,
        term: "AI Content Growth OS",
        replacement: "SEO Tool",
        reason: "Positions OmniRank as an operational operating system rather than a point utility.",
        caseSensitive: true,
        status: "active" as const,
        createdAt: new Date(Date.now() - 22 * 86400000).toISOString(),
      },
      {
        id: "term-002",
        brandId,
        type: "avoided" as const,
        term: "AI Content Spinner",
        replacement: "Evidence-Backed Content Generation Engine",
        reason: "Spinner implies low-quality derivative spam penalized by search quality algorithms.",
        caseSensitive: false,
        status: "active" as const,
        createdAt: new Date(Date.now() - 22 * 86400000).toISOString(),
      },
    ],
    policies: [
      {
        id: "pol-001",
        brandId,
        title: "Mandatory Source Attribution for Numerical Claims",
        description: "Any statistical claim, benchmark percentage, or ROI figure must link directly to verified Brand Brain evidence.",
        category: "factual_claim" as const,
        severity: "blocking" as const,
        enforcementAction: "Block publication if block provenance is missing or citation confidence < 0.90.",
        status: "active" as const,
        createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 21 * 86400000).toISOString(),
      },
      {
        id: "pol-002",
        brandId,
        title: "Objective Competitor Comparison Standard",
        description: "Never disparage competitors with subjective insults. All comparisons must evaluate verifiable features from public docs.",
        category: "competitor_reference" as const,
        severity: "warning" as const,
        enforcementAction: "Flag for editorial review by Brand Strategist before human sign-off.",
        status: "active" as const,
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
      {
        id: "pol-003",
        brandId,
        title: "Banned AI Slop Clichés",
        description: "Disallow terms like 'delve', 'supercharge', 'in conclusion', 'beacon of hope', 'tapestry', and 'game-changer'.",
        category: "editorial_style" as const,
        severity: "warning" as const,
        enforcementAction: "Highlights banned phrases in editor with one-click replacement suggestions.",
        status: "active" as const,
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: "pol-004",
        brandId,
        title: "Current Pricing Disclaimers",
        description: "Whenever specific SaaS pricing tiers are cited, include a footnote noting that pricing is accurate as of the publication date.",
        category: "pricing_mention" as const,
        severity: "suggestion" as const,
        enforcementAction: "Suggests inserting the standard pricing disclaimer callout block.",
        status: "active" as const,
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ],
    competitors: [
      {
        id: "comp-001",
        brandId,
        name: "LegacySEOCorp",
        domain: "legacyseocorp.com",
        positioning: "Traditional keyword database and backlink reporting tool.",
        keyStrengths: ["Massive historical link database", "Broad industry brand recognition"],
        keyWeaknesses: ["Zero block-level generation", "No Brand Brain guardrails", "No GEO/AI Overview rank tracking"],
        differentiator: "OmniRank creates evidence-backed block JSON directly connected to brand policies.",
        notes: "Target their enterprise accounts experiencing declining organic traffic due to ungrounded AI overviews.",
        status: "active" as const,
        createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 19 * 86400000).toISOString(),
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
        status: "active" as const,
        createdAt: new Date(Date.now() - 16 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    auditLogs: [
      {
        id: "log-001",
        brandId,
        userId: DEMO_USER_ALEX.id,
        userName: "Alex Rivera",
        entityType: "policy" as const,
        entityId: "pol-001",
        action: "create" as const,
        summary: "Created mandatory numerical claim attribution policy",
        details: { severity: "blocking" },
        createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
      },
    ],
  };
}
