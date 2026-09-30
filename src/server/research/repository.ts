import { SupabaseClient } from "@supabase/supabase-js";
import { 
  ResearchProject, ResearchQuestion, ResearchSource, 
  ResearchFinding, ContentBrief, ResearchMode, ResearchProjectStatus, ResearchQuestionStatus, ResearchSourceClassification, ResearchFindingSupportStatus
} from "../../types/research.ts";

export class ResearchRepository {
  constructor(private client: SupabaseClient) {}

  // Projects
  async getProjects(brandId: string): Promise<ResearchProject[]> {
    const { data, error } = await this.client.from("research_projects").select("*").eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return data.map(this.mapProject);
  }

  async getProject(id: string, brandId: string): Promise<ResearchProject | null> {
    const { data, error } = await this.client.from("research_projects").select("*").eq("id", id).eq("brand_id", brandId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapProject(data) : null;
  }

  async createManualProject(brandId: string, orgId: string, title: string, objective: string, mode: ResearchMode): Promise<ResearchProject> {
    const { data, error } = await this.client.from("research_projects").insert({
      brand_id: brandId,
      organization_id: orgId,
      title,
      objective,
      mode,
      status: 'draft'
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapProject(data);
  }

  async handoffOpportunity(opportunityId: string, brandId: string): Promise<string> {
    const { data, error } = await this.client.rpc("handoff_opportunity_to_research", {
      p_opportunity_id: opportunityId,
      p_brand_id: brandId
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // Questions
  async listQuestions(projectId: string, brandId: string): Promise<ResearchQuestion[]> {
    const { data, error } = await this.client.from("research_questions").select("*").eq("project_id", projectId).eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return data.map(this.mapQuestion);
  }

  async addQuestion(projectId: string, brandId: string, orgId: string, text: string): Promise<ResearchQuestion> {
    const { data, error } = await this.client.from("research_questions").insert({
      project_id: projectId, brand_id: brandId, organization_id: orgId,
      question_text: text, origin_type: 'user'
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapQuestion(data);
  }

  async updateQuestion(id: string, brandId: string, updates: Partial<{ status: ResearchQuestionStatus; questionText: string }>): Promise<ResearchQuestion> {
    const { data, error } = await this.client.from("research_questions").update({
      status: updates.status,
      question_text: updates.questionText,
      updated_at: new Date().toISOString()
    }).eq("id", id).eq("brand_id", brandId).select().single();
    if (error) throw new Error(error.message);
    return this.mapQuestion(data);
  }

  // Sources
  async listSources(projectId: string, brandId: string): Promise<ResearchSource[]> {
    const { data, error } = await this.client.from("research_sources").select("*").eq("project_id", projectId).eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return data.map(this.mapSource);
  }

  async addSource(projectId: string, brandId: string, orgId: string, classification: ResearchSourceClassification, title: string, url?: string): Promise<ResearchSource> {
    const { data, error } = await this.client.from("research_sources").insert({
      project_id: projectId, brand_id: brandId, organization_id: orgId,
      classification, title, url, trust_classification: 'unverified'
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapSource(data);
  }

  // Findings
  async listFindings(projectId: string, brandId: string): Promise<ResearchFinding[]> {
    const { data, error } = await this.client.from("research_findings").select("*").eq("project_id", projectId).eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return data.map(this.mapFinding);
  }

  async addFinding(projectId: string, brandId: string, orgId: string, text: string, questionId?: string, sourceRefs: string[] = []): Promise<ResearchFinding> {
    const { data, error } = await this.client.from("research_findings").insert({
      project_id: projectId, brand_id: brandId, organization_id: orgId,
      question_id: questionId, finding_text: text, support_status: 'unsupported',
      source_references: sourceRefs
    }).select().single();
    if (error) throw new Error(error.message);
    return this.mapFinding(data);
  }

  async reviewFinding(id: string, brandId: string, supportStatus: ResearchFindingSupportStatus, confidence: number, notes?: string): Promise<void> {
    const { error } = await this.client.rpc("review_research_finding", {
      p_finding_id: id, p_support_status: supportStatus, p_confidence_score: confidence, p_notes: notes
    });
    if (error) throw new Error(error.message);
  }

  // Brief
  async getBriefForProject(projectId: string, brandId: string): Promise<ContentBrief | null> {
    const { data, error } = await this.client.from("content_briefs").select("*").eq("project_id", projectId).eq("brand_id", brandId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.mapBrief(data) : null;
  }

  async saveBrief(projectId: string, brandId: string, orgId: string, briefData: Partial<ContentBrief>): Promise<ContentBrief> {
    // Upsert equivalent since project_id is unique
    const { data: existing } = await this.client.from("content_briefs").select("id").eq("project_id", projectId).eq("brand_id", brandId).maybeSingle();
    
    let result;
    if (existing) {
      result = await this.client.from("content_briefs").update({
        ...briefData, updated_at: new Date().toISOString()
      }).eq("id", existing.id).select().single();
    } else {
      result = await this.client.from("content_briefs").insert({
        ...briefData, project_id: projectId, brand_id: brandId, organization_id: orgId
      }).select().single();
    }
    
    if (result.error) throw new Error(result.error.message);
    return this.mapBrief(result.data);
  }

  async reviewBrief(briefId: string, status: string, notes?: string): Promise<void> {
    const { error } = await this.client.rpc("review_content_brief", {
      p_brief_id: briefId, p_status: status, p_notes: notes
    });
    if (error) throw new Error(error.message);
  }

  private mapProject(row: any): ResearchProject {
    return {
      id: row.id,
      organizationId: row.organization_id,
      brandId: row.brand_id,
      opportunityId: row.opportunity_id ?? undefined,
      opportunityContext: row.opportunity_context ?? undefined,
      articleId: row.article_id ?? undefined,
      title: row.title,
      objective: row.objective,
      mode: row.mode,
      status: row.status,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapQuestion(row: any): ResearchQuestion {
    return {
      id: row.id, projectId: row.project_id, organizationId: row.organization_id, brandId: row.brand_id,
      questionText: row.question_text, status: row.status, originType: row.origin_type, originReference: row.origin_reference ?? undefined,
      orderIndex: row.order_index, createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  private mapSource(row: any): ResearchSource {
    return {
      id: row.id, projectId: row.project_id, organizationId: row.organization_id, brandId: row.brand_id,
      classification: row.classification, title: row.title, url: row.url ?? undefined, publisher: row.publisher ?? undefined,
      publicationDate: row.publication_date ?? undefined, trustClassification: row.trust_classification,
      extractedText: row.extracted_text ?? undefined, metadata: row.metadata,
      knowledgeSourceId: row.knowledge_source_id ?? undefined, knowledgeDocumentId: row.knowledge_document_id ?? undefined,
      knowledgeChunkId: row.knowledge_chunk_id ?? undefined, evidenceSourceId: row.evidence_source_id ?? undefined,
      evidenceClaimId: row.evidence_claim_id ?? undefined, createdAt: row.created_at
    };
  }

  private mapFinding(row: any): ResearchFinding {
    return {
      id: row.id, projectId: row.project_id, organizationId: row.organization_id, brandId: row.brand_id,
      questionId: row.question_id ?? undefined, findingText: row.finding_text, supportStatus: row.support_status,
      confidenceScore: row.confidence_score, sourceReferences: row.source_references ?? [],
      provenanceNotes: row.provenance_notes ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  private mapBrief(row: any): ContentBrief {
    return {
      id: row.id, projectId: row.project_id, organizationId: row.organization_id, brandId: row.brand_id,
      title: row.title, angle: row.angle, targetAudience: row.target_audience, searchIntent: row.search_intent,
      primaryObjective: row.primary_objective, targetKeyword: row.target_keyword ?? undefined,
      supportingKeywords: row.supporting_keywords ?? [], cta: row.cta ?? undefined, outline: row.outline ?? [],
      proposedTables: row.proposed_tables ?? [], proposedVisuals: row.proposed_visuals ?? [],
      faqIdeas: row.faq_ideas ?? [], sourceSelections: row.source_selections ?? [], unsupportedIssues: row.unsupported_issues ?? [],
      notes: row.notes ?? undefined, status: row.status, createdBy: row.created_by ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }
}

export function getResearchRepository(client: SupabaseClient) {
  return new ResearchRepository(client);
}
