import {
  BrandBrainKnowledge,
  BrandProduct,
  BrandAudience,
  BrandVoiceProfile,
  BrandVoiceExample,
  BrandTerminology,
  BrandPolicy,
  BrandCompetitor,
  KnowledgeChunk,
  SemanticSearchResult,
  EvidenceVerificationStatus,
} from "../types/index.ts";
import { supabase } from "../lib/supabase/client.ts";
import { isLiveBrowserSupabaseConfigured } from "../lib/env.ts";

export async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  if (isLiveBrowserSupabaseConfigured()) {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        throw new Error("Authentication required: No active Supabase session.");
      }
      return {
        Authorization: `Bearer ${data.session.access_token}`,
        ...extraHeaders,
      };
    } catch (err: any) {
      throw new Error(err.message || "Authentication required: No active Supabase session.");
    }
  }

  return {
    Authorization: "Bearer demo-token",
    ...extraHeaders,
  };
}

export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const customHeaders = (init.headers as Record<string, string>) || {};
  const authHeaders = await getAuthHeaders(customHeaders);
  return fetch(url, {
    ...init,
    headers: authHeaders,
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const brandBrainApi = {
  async getKnowledge(brandId: string, _userId?: string): Promise<BrandBrainKnowledge | null> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}`, {
      headers
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch brand brain (${res.status})`);
    }
    const data = await res.json();
    return data.knowledge;
  },

  async saveProfile(brandId: string, profile: any, _userId?: string) {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`/api/brand-brain/${brandId}/profile`, {
      method: "PUT",
      headers,
      body: JSON.stringify(profile)
    });
    return handleResponse(res);
  },

  async getEvidence(brandId: string, _userId?: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/evidence`, { headers });
    return handleResponse(res);
  },

  async verifyClaim(
    brandId: string,
    claimId: string,
    status: EvidenceVerificationStatus | string,
    _userId?: string
  ) {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`/api/brand-brain/${brandId}/evidence/${claimId}/status`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  async saveProduct(brandId: string, product: Partial<BrandProduct>, _userId?: string) {
    const isUpdate = !!product.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/products/${product.id}`
      : `/api/brand-brain/${brandId}/products`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers,
      body: JSON.stringify(product)
    });
    return handleResponse(res);
  },

  async toggleArchiveProduct(brandId: string, productId: string, _userId?: string): Promise<{ product: BrandProduct }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/products/${productId}/archive`, {
      method: "POST",
      headers
    });
    return handleResponse<{ product: BrandProduct }>(res);
  },

  async saveAudience(brandId: string, audience: Partial<BrandAudience>, _userId?: string) {
    const isUpdate = !!audience.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/audiences/${audience.id}`
      : `/api/brand-brain/${brandId}/audiences`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers,
      body: JSON.stringify(audience)
    });
    return handleResponse(res);
  },

  async toggleArchiveAudience(brandId: string, audienceId: string, _userId?: string): Promise<{ audience: BrandAudience }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/audiences/${audienceId}/archive`, {
      method: "POST",
      headers
    });
    return handleResponse<{ audience: BrandAudience }>(res);
  },

  async saveVoiceProfile(brandId: string, profile: Partial<BrandVoiceProfile>, _userId?: string) {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`/api/brand-brain/${brandId}/voice`, {
      method: "PUT",
      headers,
      body: JSON.stringify(profile)
    });
    return handleResponse(res);
  },

  async addVoiceExample(brandId: string, example: Partial<BrandVoiceExample>, _userId?: string) {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`/api/brand-brain/${brandId}/voice-examples`, {
      method: "POST",
      headers,
      body: JSON.stringify(example)
    });
    return handleResponse(res);
  },

  async deleteVoiceExample(brandId: string, exampleId: string, _userId?: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/voice-examples/${exampleId}`, {
      method: "DELETE",
      headers
    });
    return handleResponse(res);
  },

  async saveTerminology(brandId: string, term: Partial<BrandTerminology>, _userId?: string) {
    const isUpdate = !!term.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/terminology/${term.id}`
      : `/api/brand-brain/${brandId}/terminology`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers,
      body: JSON.stringify(term)
    });
    return handleResponse(res);
  },

  async toggleArchiveTerminology(brandId: string, termId: string, _userId?: string): Promise<{ term: BrandTerminology }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/terminology/${termId}/archive`, {
      method: "POST",
      headers
    });
    return handleResponse<{ term: BrandTerminology }>(res);
  },

  async savePolicy(brandId: string, policy: Partial<BrandPolicy>, _userId?: string) {
    const isUpdate = !!policy.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/policies/${policy.id}`
      : `/api/brand-brain/${brandId}/policies`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers,
      body: JSON.stringify(policy)
    });
    return handleResponse(res);
  },

  async toggleArchivePolicy(brandId: string, policyId: string, _userId?: string): Promise<{ policy: BrandPolicy }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/policies/${policyId}/archive`, {
      method: "POST",
      headers
    });
    return handleResponse<{ policy: BrandPolicy }>(res);
  },

  async saveCompetitor(brandId: string, competitor: Partial<BrandCompetitor>, _userId?: string) {
    const isUpdate = !!competitor.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/competitors/${competitor.id}`
      : `/api/brand-brain/${brandId}/competitors`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers,
      body: JSON.stringify(competitor)
    });
    return handleResponse(res);
  },

  async toggleArchiveCompetitor(brandId: string, competitorId: string, _userId?: string): Promise<{ competitor: BrandCompetitor }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/brand-brain/${brandId}/competitors/${competitorId}/archive`, {
      method: "POST",
      headers
    });
    return handleResponse<{ competitor: BrandCompetitor }>(res);
  },

  async uploadFile(brandId: string, formData: FormData): Promise<any> {
    const res = await authenticatedFetch(`/api/brand-brain/${brandId}/upload`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(res);
  },

  async ingestContent(brandId: string, payload: {
    sourceType: string;
    sourceName: string;
    sourceUrl?: string;
    fileType: string;
    content: string;
    trustLevel: string;
    classification: string;
  }): Promise<any> {
    const res = await authenticatedFetch(`/api/brand-brain/${brandId}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getChunks(brandId: string, documentId: string): Promise<{ chunks: KnowledgeChunk[] }> {
    const res = await authenticatedFetch(`/api/brand-brain/${brandId}/chunks?documentId=${encodeURIComponent(documentId)}`);
    return handleResponse<{ chunks: KnowledgeChunk[] }>(res);
  },

  async deleteDocument(brandId: string, documentId: string): Promise<any> {
    const res = await authenticatedFetch(`/api/brand-brain/${brandId}/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  async search(brandId: string, query: string, topK = 4, minSimilarity = 0.1): Promise<{ results: SemanticSearchResult[] }> {
    const res = await authenticatedFetch(`/api/brand-brain/${brandId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK, minSimilarity }),
    });
    return handleResponse<{ results: SemanticSearchResult[] }>(res);
  }
};
