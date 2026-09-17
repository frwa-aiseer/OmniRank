import {
  BrandBrainKnowledge,
  BrandProduct,
  BrandAudience,
  BrandVoiceProfile,
  BrandVoiceExample,
  BrandTerminology,
  BrandPolicy,
  BrandCompetitor
} from "../types/index.ts";

export const brandBrainApi = {
  async getKnowledge(brandId: string, userId: string): Promise<BrandBrainKnowledge | null> {
    try {
      const res = await fetch(`/api/brand-brain/${brandId}`, {
        headers: { "x-user-id": userId }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.knowledge;
    } catch {
      return null;
    }
  },

  async saveProduct(brandId: string, product: Partial<BrandProduct>, userId: string) {
    const isUpdate = !!product.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/products/${product.id}`
      : `/api/brand-brain/${brandId}/products`;
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(product)
    });
    return res.json();
  },

  async toggleArchiveProduct(brandId: string, productId: string, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/products/${productId}/archive`, {
      method: "POST",
      headers: { "x-user-id": userId }
    });
    return res.json();
  },

  async saveAudience(brandId: string, audience: Partial<BrandAudience>, userId: string) {
    const isUpdate = !!audience.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/audiences/${audience.id}`
      : `/api/brand-brain/${brandId}/audiences`;
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(audience)
    });
    return res.json();
  },

  async toggleArchiveAudience(brandId: string, audienceId: string, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/audiences/${audienceId}/archive`, {
      method: "POST",
      headers: { "x-user-id": userId }
    });
    return res.json();
  },

  async saveVoiceProfile(brandId: string, profile: Partial<BrandVoiceProfile>, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/voice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(profile)
    });
    return res.json();
  },

  async addVoiceExample(brandId: string, example: Partial<BrandVoiceExample>, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/voice-examples`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(example)
    });
    return res.json();
  },

  async deleteVoiceExample(brandId: string, exampleId: string, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/voice-examples/${exampleId}`, {
      method: "DELETE",
      headers: { "x-user-id": userId }
    });
    return res.json();
  },

  async saveTerminology(brandId: string, term: Partial<BrandTerminology>, userId: string) {
    const isUpdate = !!term.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/terminology/${term.id}`
      : `/api/brand-brain/${brandId}/terminology`;
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(term)
    });
    return res.json();
  },

  async toggleArchiveTerminology(brandId: string, termId: string, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/terminology/${termId}/archive`, {
      method: "POST",
      headers: { "x-user-id": userId }
    });
    return res.json();
  },

  async savePolicy(brandId: string, policy: Partial<BrandPolicy>, userId: string) {
    const isUpdate = !!policy.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/policies/${policy.id}`
      : `/api/brand-brain/${brandId}/policies`;
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(policy)
    });
    return res.json();
  },

  async toggleArchivePolicy(brandId: string, policyId: string, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/policies/${policyId}/archive`, {
      method: "POST",
      headers: { "x-user-id": userId }
    });
    return res.json();
  },

  async saveCompetitor(brandId: string, competitor: Partial<BrandCompetitor>, userId: string) {
    const isUpdate = !!competitor.id;
    const url = isUpdate
      ? `/api/brand-brain/${brandId}/competitors/${competitor.id}`
      : `/api/brand-brain/${brandId}/competitors`;
    const res = await fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(competitor)
    });
    return res.json();
  },

  async toggleArchiveCompetitor(brandId: string, competitorId: string, userId: string) {
    const res = await fetch(`/api/brand-brain/${brandId}/competitors/${competitorId}/archive`, {
      method: "POST",
      headers: { "x-user-id": userId }
    });
    return res.json();
  }
};
