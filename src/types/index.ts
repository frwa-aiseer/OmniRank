export type AppView =
  | "home"
  | "opportunities"
  | "content"
  | "calendar"
  | "growth"
  | "brand-brain"
  | "settings";

export type OrgRole = "owner" | "admin" | "member";
export type BrandRole = "strategist" | "writer" | "reviewer" | "viewer";
export type WebsiteStatus = "active" | "indexing" | "paused" | "archived";

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  updatedAt?: string;
  profile?: Profile;
}

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  primaryDomain: string;
  industry?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BrandMember {
  id: string;
  brandId: string;
  userId: string;
  role: BrandRole;
  createdAt: string;
  updatedAt?: string;
  profile?: Profile;
}

export interface Website {
  id: string;
  organizationId: string;
  brandId: string;
  domain: string;
  sitemapUrl?: string;
  status: WebsiteStatus;
  createdAt: string;
  updatedAt?: string;
}

// Brand Brain Types
export interface BrandProfileDetails {
  id: string;
  brandId: string;
  mission: string;
  positioningStatement: string;
  targetMarket: string;
  valueProposition: string;
  toneKeywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandProduct {
  id: string;
  brandId: string;
  name: string;
  category: string;
  valueProposition: string;
  keyFeatures: string[];
  targetAudience: string;
  pricingSummary?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface BrandAudience {
  id: string;
  brandId: string;
  name: string;
  jobTitle: string;
  painPoints: string[];
  goals: string[];
  objections: string[];
  preferredChannels: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface BrandVoiceProfile {
  id: string;
  brandId: string;
  archetype: string;
  formalityScore: number; // 1-5
  enthusiasmScore: number; // 1-5
  technicalDepthScore: number; // 1-5
  humorScore: number; // 1-5
  readingGradeLevel: string;
  primaryToneTraits: string[];
  styleGuidelines: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandVoiceExample {
  id: string;
  brandId: string;
  type: "do" | "dont";
  title: string;
  snippet: string;
  explanation: string;
  category: string;
  createdAt: string;
}

export interface BrandTerminology {
  id: string;
  brandId: string;
  type: "preferred" | "avoided";
  term: string;
  replacement?: string;
  preferredUsage?: string;
  reason: string;
  caseSensitive: boolean;
  status: "active" | "archived";
  createdAt: string;
}

export type PolicyCategory =
  | "factual_claim"
  | "competitor_reference"
  | "compliance_legal"
  | "editorial_style"
  | "pricing_mention";

export type PolicySeverity = "suggestion" | "warning" | "blocking";

export interface BrandPolicy {
  id: string;
  brandId: string;
  title: string;
  description: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  enforcementAction: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface BrandCompetitor {
  id: string;
  brandId: string;
  name: string;
  domain: string;
  positioning: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  differentiator: string;
  notes?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export type AuditEntityType =
  | "profile"
  | "product"
  | "audience"
  | "voice"
  | "terminology"
  | "policy"
  | "competitor";

export type AuditAction = "create" | "update" | "archive" | "unarchive" | "delete";

export interface BrandAuditLog {
  id: string;
  brandId: string;
  userId: string;
  userName: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  summary: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface BrandBrainKnowledge {
  profile: BrandProfileDetails;
  products: BrandProduct[];
  audiences: BrandAudience[];
  voiceProfile: BrandVoiceProfile;
  voiceExamples: BrandVoiceExample[];
  terminology: BrandTerminology[];
  policies: BrandPolicy[];
  competitors: BrandCompetitor[];
  sources: KnowledgeSource[];
  documents: KnowledgeDocument[];
  evidenceClaims: EvidenceClaim[];
  evidenceSources: EvidenceSource[];
  recentAuditLogs: BrandAuditLog[];
  completenessScore: number;
}

// Ingestion Pipeline Types (OR-P04)
export type SourceType = "website" | "file_upload" | "manual_note" | "sitemap" | "api_sync";
export type TrustLevel = "verified_1p" | "partner_2p" | "unverified_3p" | "untrusted";
export type DocumentFileType = "pdf" | "docx" | "txt" | "md" | "csv" | "xlsx" | "html" | "note";
export type DocumentClassification =
  | "product_doc"
  | "technical_spec"
  | "customer_story"
  | "whitepaper"
  | "blog"
  | "policy"
  | "competitor_review"
  | "general";

export type ParsingStatus = "pending" | "processing" | "parsed" | "failed";
export type ChunkType = "text" | "table" | "list" | "code" | "quote" | "qa";

export interface KnowledgeSource {
  id: string;
  brandId: string;
  organizationId: string;
  name: string;
  type: SourceType;
  sourceUrl?: string;
  trustLevel: TrustLevel;
  status: "active" | "syncing" | "archived" | "error";
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  brandId: string;
  sourceId: string;
  title: string;
  url?: string;
  fileType: DocumentFileType;
  storageKey?: string;
  fileSizeBytes: number;
  contentHash: string;
  extractedText: string;
  documentMetadata: Record<string, unknown>;
  parsingStatus: ParsingStatus;
  trustLevel: TrustLevel;
  classification: DocumentClassification;
  chunkCount: number;
  hasUntrustedDirectives: boolean;
  sanitizationNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  brandId: string;
  documentId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  headingHierarchy: string[];
  chunkType: ChunkType;
  embedding: number[]; // 768-dim float vector
  metadata: Record<string, unknown>;
  trustLevel: TrustLevel;
  createdAt: string;
}

export type EvidenceClaimType =
  | "statistic"
  | "benchmark"
  | "customer_result"
  | "pricing"
  | "compliance"
  | "feature"
  | "quote";

export type EvidenceVerificationStatus = "unverified" | "verified" | "disputed" | "rejected";

export interface EvidenceSource {
  id: string;
  brandId: string;
  name: string;
  url?: string;
  publisher: string;
  publicationDate?: string;
  trustScore: number;
  isPrimarySource: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceClaimSourceLink {
  id: string;
  claimId: string;
  sourceId: string;
  sourceName?: string;
  sourceUrl?: string;
  documentId?: string;
  chunkId?: string;
  exactQuote: string;
  pageOrSection?: string;
  createdAt: string;
}

export interface EvidenceClaim {
  id: string;
  brandId: string;
  claimText: string;
  claimType: EvidenceClaimType;
  verificationStatus: EvidenceVerificationStatus;
  confidenceScore: number;
  extractedEntities: Record<string, unknown>;
  sources: EvidenceClaimSourceLink[];
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionInput {
  brandId: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string;
  fileType?: DocumentFileType;
  fileName?: string;
  fileBufferOrText: string | Uint8Array;
  trustLevel?: TrustLevel;
  classification?: DocumentClassification;
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  source: KnowledgeSource;
  document: KnowledgeDocument;
  chunks: KnowledgeChunk[];
  evidenceClaims: EvidenceClaim[];
  isDuplicate: boolean;
  sanitizationApplied: boolean;
}

export interface SemanticSearchResult {
  chunk: KnowledgeChunk;
  documentTitle: string;
  documentUrl?: string;
  sourceName: string;
  similarityScore: number;
  trustLevel: TrustLevel;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  orgRole: OrgRole;
  brandRole: BrandRole;
}

export interface TenancyContext {
  user: Profile | null;
  organization: Organization | null;
  brand: Brand | null;
  website: Website | null;
  orgRole: OrgRole | null;
  brandRole: BrandRole | null;
  allOrganizations: Organization[];
  allBrands: Brand[];
  allWebsites: Website[];
}
