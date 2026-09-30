export type OpportunityType = 
  | 'new_content' 
  | 'refresh_content' 
  | 'content_gap' 
  | 'internal_link' 
  | 'evidence_gap' 
  | 'brand_knowledge_gap';

export type OpportunityStatus = 'new' | 'accepted' | 'in_progress' | 'completed' | 'dismissed';

export interface Opportunity {
  id: string;
  organizationId: string;
  brandId: string;
  websiteId?: string;
  
  fingerprint: string;
  
  type: OpportunityType;
  status: OpportunityStatus;
  
  title: string;
  summary: string;
  rationale: string;
  
  priorityScore: number;
  confidenceScore: number;
  effortScore: number;
  impactScore: number;
  
  sourceSignals: Record<string, any>;
  
  targetKeyword?: string;
  targetUrl?: string;
  relatedArticleId?: string;
  
  createdAt: string;
  updatedAt: string;
  dismissedAt?: string;
  completedAt?: string;
}
