export type ResearchMode = 'fast' | 'standard' | 'deep';
export type ResearchProjectStatus = 'draft' | 'researching' | 'review' | 'completed' | 'archived';
export type ResearchQuestionStatus = 'pending' | 'answered' | 'needs_more_research' | 'not_answerable';
export type ResearchSourceClassification = 'brand' | 'primary' | 'authoritative_external' | 'competitor' | 'search_result' | 'weak';
export type ResearchFindingSupportStatus = 'supported' | 'partially_supported' | 'unsupported' | 'conflicting';
export type ContentBriefStatus = 'draft' | 'review' | 'approved' | 'rejected';
export type ResearchQuestionOrigin = 'user' | 'opportunity' | 'brand_brain' | 'system';

export interface ResearchProject {
  id: string;
  organizationId: string;
  brandId: string;
  opportunityId?: string;
  articleId?: string;
  opportunityContext?: any;
  title: string;
  objective: string;
  mode: ResearchMode;
  status: ResearchProjectStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchQuestion {
  id: string;
  projectId: string;
  organizationId: string;
  brandId: string;
  questionText: string;
  status: ResearchQuestionStatus;
  originType: ResearchQuestionOrigin;
  originReference?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  projectId: string;
  organizationId: string;
  brandId: string;
  classification: ResearchSourceClassification;
  title: string;
  url?: string;
  publisher?: string;
  publicationDate?: string;
  trustClassification: string;
  extractedText?: string;
  metadata: any;
  knowledgeSourceId?: string;
  knowledgeDocumentId?: string;
  knowledgeChunkId?: string;
  evidenceSourceId?: string;
  evidenceClaimId?: string;
  createdAt: string;
}

export interface ResearchFinding {
  id: string;
  projectId: string;
  organizationId: string;
  brandId: string;
  questionId?: string;
  findingText: string;
  supportStatus: ResearchFindingSupportStatus;
  confidenceScore: number;
  sourceReferences: string[];
  provenanceNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentBrief {
  id: string;
  projectId: string;
  organizationId: string;
  brandId: string;
  title: string;
  angle: string;
  targetAudience: string;
  searchIntent: string;
  primaryObjective: string;
  targetKeyword?: string;
  supportingKeywords: string[];
  cta?: string;
  outline: any[];
  proposedTables: any[];
  proposedVisuals: any[];
  faqIdeas: any[];
  sourceSelections: string[];
  unsupportedIssues: string[];
  notes?: string;
  status: ContentBriefStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchConfig {
  maxSources: number;
  maxQuestions: number;
  allowExternal: boolean;
  requireMultipleSources: boolean;
  checkConflicts: boolean;
}

export const RESEARCH_MODE_CONFIGS: Record<ResearchMode, ResearchConfig> = {
  fast: {
    maxSources: 5,
    maxQuestions: 3,
    allowExternal: false,
    requireMultipleSources: false,
    checkConflicts: false,
  },
  standard: {
    maxSources: 15,
    maxQuestions: 8,
    allowExternal: true,
    requireMultipleSources: false,
    checkConflicts: true,
  },
  deep: {
    maxSources: 50,
    maxQuestions: 20,
    allowExternal: true,
    requireMultipleSources: true,
    checkConflicts: true,
  },
};
