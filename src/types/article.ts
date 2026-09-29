/**
 * OR-P05 — Canonical Article Schema Types
 *
 * Source of truth: structured versioned JSON. HTML is NEVER stored or persisted.
 * HTML is a rendering-only output derived from these types at display time.
 */

// ============================================================================
// Block Types
// ============================================================================

export const ARTICLE_SCHEMA_VERSION = "1.0";

export const V1_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "bulletList",
  "numberedList",
  "table",
  "comparisonTable",
  "image",
  "youtube",
  "quote",
  "statistic",
  "callout",
  "cta",
  "faq",
  "code",
  "citation",
  "divider",
] as const;

export type BlockType = (typeof V1_BLOCK_TYPES)[number];

/**
 * Safe inline mark — links only. href validated on write; no JS URIs.
 */
export interface InlineMark {
  type: "link";
  href: string;   // validated: must be http/https or relative path
  text: string;
}

/**
 * Provenance record for a block — who touched it and how.
 */
export interface BlockProvenance {
  createdBy: string;       // user ID
  createdAt: string;       // ISO 8601
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  aiGenerated?: boolean;
  aiTaskCode?: string;     // e.g. 'block_rewrite'
  aiModelHint?: string;    // label only; never a secret key
  sourceRefs?: string[];   // knowledge_chunk or evidence_claim IDs
  evidenceRefs?: string[]; // evidence_claim IDs for statistic/citation blocks
}

/**
 * Core block interface — every block in a V1 article must satisfy this.
 */
export interface ArticleBlock {
  /** Stable UUID — assigned once at creation, never changed. */
  id: string;
  type: BlockType;
  schemaVersion: string;
  content: Record<string, unknown>;
  attributes: Record<string, unknown>;
  sourceRefs: string[];
  evidenceRefs: string[];
  provenance: BlockProvenance;
  children?: ArticleBlock[];
}

// ---- Concrete block content shapes ----

export interface HeadingContent { level: 1 | 2 | 3 | 4 | 5 | 6; text: string; }
export interface ParagraphContent { text: string; marks?: InlineMark[]; }
export interface ListContent { items: string[]; }
export interface TableContent { headers: string[]; rows: string[][]; caption?: string; }
export interface ComparisonTableContent { headers: string[]; rows: Record<string, string>[]; caption?: string; }
export interface ImageContent { src: string; alt: string; caption?: string; width?: number; height?: number; }
export interface YoutubeContent { videoId: string; caption?: string; startSec?: number; }
export interface QuoteContent { text: string; attribution?: string; source?: string; }
export interface StatisticContent { value: string; label: string; source?: string; evidenceClaimId?: string; }
export interface CalloutContent { variant: "info" | "warning" | "tip" | "caution"; text: string; }
export interface CtaContent { text: string; href: string; label: string; variant?: string; }
export interface FaqContent { question: string; answer: string; }
export interface CodeContent { language: string; code: string; }
export interface CitationContent { text: string; href?: string; evidenceClaimId?: string; }
export interface DividerContent { style?: "solid" | "dashed"; }

// ============================================================================
// Article Envelope
// ============================================================================

export interface ArticleEnvelope {
  schemaVersion: string;
  articleId: string;
  brandId: string;
  websiteId?: string;
  locale: string;
  title: string;
  slug: string;
  document: {
    blocks: ArticleBlock[];
  };
  metadata: {
    status: ArticleStatus;
    targetKeyword?: string;
    wordCountEstimate?: number;
    readingTimeMinutes?: number;
    [key: string]: unknown;
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    [key: string]: unknown;
  };
  geo: {
    geoFocus?: string;
    entities?: string[];
    faqs?: Array<{ question: string; answer: string }>;
    [key: string]: unknown;
  };
  sources: Array<{
    id: string;
    type: "knowledge_source" | "evidence_claim" | "external";
    label: string;
    url?: string;
  }>;
  relationships: Array<{
    type: "internal_link" | "canonical_of" | "translation_of";
    targetArticleId?: string;
    targetUrl?: string;
  }>;
  provenance: {
    createdBy: string;
    createdAt: string;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
  };
}

// ============================================================================
// Article DB Row Types
// ============================================================================

export type ArticleStatus =
  | "idea"
  | "researching"
  | "brief"
  | "drafting"
  | "ai_review"
  | "human_review"
  | "approved"
  | "scheduled"
  | "published"
  | "monitoring"
  | "refresh_recommended"
  | "archived";

export interface Article {
  id: string;
  organizationId: string;
  brandId: string;
  websiteId?: string;
  schemaVersion: string;
  status: ArticleStatus;
  title: string;
  slug: string;
  locale: string;
  seo: Record<string, unknown>;
  geo: Record<string, unknown>;
  metadata: Record<string, unknown>;
  sources: unknown[];
  relationships: unknown[];
  createdBy: string;
  approvedBy?: string;
  approvedVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleWorkingDocument {
  id: string;
  articleId: string;
  organizationId: string;
  brandId: string;
  content: ArticleEnvelope;
  lastSavedBy: string;
  savedAt: string;
  autosaveSeq: number;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  organizationId: string;
  brandId: string;
  versionNumber: number;
  label: string;
  content: ArticleEnvelope;
  schemaVersion: string;
  createdBy: string;
  createdAt: string;
}

export type BlockOperationType = "insert" | "update" | "delete" | "ai_replace" | "restore" | "reorder";

export interface ContentBlockOperation {
  id: string;
  articleId: string;
  organizationId: string;
  brandId: string;
  blockId: string;
  operationType: BlockOperationType;
  blockBefore?: ArticleBlock;
  blockAfter?: ArticleBlock;
  aiTaskCode?: string;
  aiModelHint?: string;
  aiPromptSummary?: string;
  performedBy: string;
  performedAt: string;
}

// ============================================================================
// Schema Validation Result
// ============================================================================

export interface BlockValidationError {
  blockId?: string;
  field: string;
  message: string;
}

export interface ArticleValidationResult {
  valid: boolean;
  errors: BlockValidationError[];
}
