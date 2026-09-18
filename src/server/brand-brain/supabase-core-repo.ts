import { SupabaseClient } from "@supabase/supabase-js";
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
} from "../../types/index.ts";
import { createScopedUserSupabaseClient, getAdminSupabaseClient } from "../supabase/client.ts";

export class SupabaseBrandBrainCoreRepository {
  private getClient(accessToken?: string): SupabaseClient {
    if (accessToken) {
      return createScopedUserSupabaseClient(accessToken);
    }
    return getAdminSupabaseClient();
  }

  // 1. Completeness Calculator
  public calculateCompleteness(
    profile?: BrandProfileDetails,
    products: BrandProduct[] = [],
    audiences: BrandAudience[] = [],
    voiceProfile?: BrandVoiceProfile,
    voiceExamples: BrandVoiceExample[] = [],
    terminology: BrandTerminology[] = [],
    policies: BrandPolicy[] = [],
    competitors: BrandCompetitor[] = []
  ): number {
    let score = 0;
    if (profile && profile.mission && profile.positioningStatement) score += 20;

    const activeProducts = products.filter((p) => p.status === "active");
    if (activeProducts.length >= 1) score += 15;
    if (activeProducts.length >= 3) score += 5;

    const activeAudiences = audiences.filter((a) => a.status === "active");
    if (activeAudiences.length >= 1) score += 15;
    if (activeAudiences.length >= 2) score += 5;

    if (voiceProfile && voiceProfile.archetype && voiceProfile.primaryToneTraits?.length >= 3) score += 10;
    if (voiceExamples.length >= 3) score += 10;
    if (terminology.length >= 3) score += 5;

    const activePolicies = policies.filter((p) => p.status === "active");
    if (activePolicies.length >= 1) score += 10;
    if (activePolicies.some((p) => p.severity === "blocking")) score += 5;

    const activeCompetitors = competitors.filter((c) => c.status === "active");
    if (activeCompetitors.length >= 1) score += 5;

    return Math.min(100, score);
  }

  // 2. Full Brand Brain Aggregate
  async getBrandBrain(brandId: string, accessToken?: string): Promise<BrandBrainKnowledge> {
    const client = this.getClient(accessToken);

    const [
      profileRes,
      productsRes,
      audiencesRes,
      voiceProfileRes,
      voiceExamplesRes,
      terminologyRes,
      policiesRes,
      competitorsRes,
      auditLogsRes,
    ] = await Promise.all([
      client.from("brand_profiles").select("*").eq("brand_id", brandId).maybeSingle(),
      client.from("brand_products").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
      client.from("brand_audiences").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
      client.from("brand_voice_profiles").select("*").eq("brand_id", brandId).maybeSingle(),
      client.from("brand_voice_examples").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
      client.from("brand_terminology").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
      client.from("brand_policies").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
      client.from("brand_competitors").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
      client.from("brand_audit_logs").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(50),
    ]);

    if (profileRes.error) throw new Error(`[Supabase Core Repo] getBrandBrain profile error: ${profileRes.error.message}`);
    if (productsRes.error) throw new Error(`[Supabase Core Repo] getBrandBrain products error: ${productsRes.error.message}`);
    if (audiencesRes.error) throw new Error(`[Supabase Core Repo] getBrandBrain audiences error: ${audiencesRes.error.message}`);

    const profile: BrandProfileDetails = profileRes.data
      ? {
          id: profileRes.data.id,
          brandId: profileRes.data.brand_id,
          mission: profileRes.data.mission,
          positioningStatement: profileRes.data.positioning_statement,
          targetMarket: profileRes.data.target_market,
          valueProposition: profileRes.data.value_proposition,
          toneKeywords: profileRes.data.tone_keywords || [],
          createdAt: profileRes.data.created_at,
          updatedAt: profileRes.data.updated_at,
        }
      : {
          id: `profile-${brandId}`,
          brandId,
          mission: "",
          positioningStatement: "",
          targetMarket: "",
          valueProposition: "",
          toneKeywords: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    const products: BrandProduct[] = (productsRes.data || []).map((p) => ({
      id: p.id,
      brandId: p.brand_id,
      name: p.name,
      category: p.category,
      valueProposition: p.value_proposition,
      keyFeatures: p.key_features || [],
      targetAudience: p.target_audience,
      pricingSummary: p.pricing_summary,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const audiences: BrandAudience[] = (audiencesRes.data || []).map((a) => ({
      id: a.id,
      brandId: a.brand_id,
      name: a.name,
      jobTitle: a.job_title,
      painPoints: a.pain_points || [],
      goals: a.goals || [],
      objections: a.objections || [],
      preferredChannels: a.preferred_channels || [],
      status: a.status,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

    const voiceProfile: BrandVoiceProfile = voiceProfileRes.data
      ? {
          id: voiceProfileRes.data.id,
          brandId: voiceProfileRes.data.brand_id,
          archetype: voiceProfileRes.data.archetype,
          formalityScore: voiceProfileRes.data.formality_score,
          enthusiasmScore: voiceProfileRes.data.enthusiasm_score,
          technicalDepthScore: voiceProfileRes.data.technical_depth_score,
          humorScore: voiceProfileRes.data.humor_score,
          readingGradeLevel: voiceProfileRes.data.reading_grade_level,
          primaryToneTraits: voiceProfileRes.data.primary_tone_traits || [],
          styleGuidelines: voiceProfileRes.data.style_guidelines,
          createdAt: voiceProfileRes.data.created_at,
          updatedAt: voiceProfileRes.data.updated_at,
        }
      : {
          id: `voice-${brandId}`,
          brandId,
          archetype: "The Pragmatic Expert",
          formalityScore: 3,
          enthusiasmScore: 3,
          technicalDepthScore: 4,
          humorScore: 2,
          readingGradeLevel: "Professional / Grade 10-12",
          primaryToneTraits: ["authoritative", "clear", "evidence-driven"],
          styleGuidelines: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    const voiceExamples: BrandVoiceExample[] = (voiceExamplesRes.data || []).map((ve) => ({
      id: ve.id,
      brandId: ve.brand_id,
      type: ve.type,
      title: ve.title,
      snippet: ve.snippet,
      explanation: ve.explanation,
      category: ve.category,
      createdAt: ve.created_at,
    }));

    const terminology: BrandTerminology[] = (terminologyRes.data || []).map((t) => ({
      id: t.id,
      brandId: t.brand_id,
      type: t.type,
      term: t.term,
      replacement: t.replacement,
      reason: t.reason,
      caseSensitive: t.case_sensitive,
      status: t.status,
      createdAt: t.created_at,
    }));

    const policies: BrandPolicy[] = (policiesRes.data || []).map((pol) => ({
      id: pol.id,
      brandId: pol.brand_id,
      title: pol.title,
      description: pol.description,
      category: pol.category,
      severity: pol.severity,
      enforcementAction: pol.enforcement_action,
      status: pol.status,
      createdAt: pol.created_at,
      updatedAt: pol.updated_at,
    }));

    const competitors: BrandCompetitor[] = (competitorsRes.data || []).map((c) => ({
      id: c.id,
      brandId: c.brand_id,
      name: c.name,
      domain: c.domain,
      positioning: c.positioning,
      keyStrengths: c.key_strengths || [],
      keyWeaknesses: c.key_weaknesses || [],
      differentiator: c.differentiator,
      notes: c.notes,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    const recentAuditLogs: BrandAuditLog[] = (auditLogsRes.data || []).map((al) => ({
      id: al.id,
      brandId: al.brand_id,
      userId: al.user_id,
      userName: al.user_name,
      entityType: al.entity_type,
      entityId: al.entity_id,
      action: al.action,
      summary: al.summary,
      details: al.details,
      createdAt: al.created_at,
    }));

    const completenessScore = this.calculateCompleteness(
      profile,
      products,
      audiences,
      voiceProfile,
      voiceExamples,
      terminology,
      policies,
      competitors
    );

    const { brandBrainIngestion } = await import("./ingestion-service.ts");
    const sources = brandBrainIngestion.getSources(brandId);
    const documents = brandBrainIngestion.getDocuments(brandId);
    const evidenceClaims = brandBrainIngestion.getEvidenceClaims(brandId);
    const evidenceSources = brandBrainIngestion.getEvidenceSources(brandId);

    return {
      completenessScore,
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
    };
  }

  // 3. Profile Mutation
  async updateProfile(
    brandId: string,
    profileUpdate: Partial<BrandProfileDetails>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProfileDetails> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_profiles")
      .upsert({
        brand_id: brandId,
        mission: profileUpdate.mission,
        positioning_statement: profileUpdate.positioningStatement,
        target_market: profileUpdate.targetMarket,
        value_proposition: profileUpdate.valueProposition,
        tone_keywords: profileUpdate.toneKeywords,
        updated_at: new Date().toISOString(),
      }, { onConflict: "brand_id" })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] updateProfile failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "profile",
      data.id,
      "update",
      `Updated Brand Brain core profile and positioning statement.`,
      profileUpdate
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      mission: data.mission,
      positioningStatement: data.positioning_statement,
      targetMarket: data.target_market,
      valueProposition: data.value_proposition,
      toneKeywords: data.tone_keywords || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // 4. Products
  async createProduct(
    brandId: string,
    input: Omit<BrandProduct, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProduct> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_products")
      .insert({
        brand_id: brandId,
        name: input.name,
        category: input.category,
        value_proposition: input.valueProposition,
        key_features: input.keyFeatures,
        target_audience: input.targetAudience,
        pricing_summary: input.pricingSummary,
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] createProduct failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "product",
      data.id,
      "create",
      `Added product '${data.name}' in category '${data.category}'.`,
      { name: data.name }
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      category: data.category,
      valueProposition: data.value_proposition,
      keyFeatures: data.key_features || [],
      targetAudience: data.target_audience,
      pricingSummary: data.pricing_summary,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateProduct(
    brandId: string,
    productId: string,
    input: Partial<BrandProduct>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProduct> {
    const client = this.getClient(accessToken);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.category !== undefined) updatePayload.category = input.category;
    if (input.valueProposition !== undefined) updatePayload.value_proposition = input.valueProposition;
    if (input.keyFeatures !== undefined) updatePayload.key_features = input.keyFeatures;
    if (input.targetAudience !== undefined) updatePayload.target_audience = input.targetAudience;
    if (input.pricingSummary !== undefined) updatePayload.pricing_summary = input.pricingSummary;
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data, error } = await client
      .from("brand_products")
      .update(updatePayload)
      .eq("id", productId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] updateProduct failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "product",
      productId,
      "update",
      `Updated product specifications for '${data.name}'.`,
      input
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      category: data.category,
      valueProposition: data.value_proposition,
      keyFeatures: data.key_features || [],
      targetAudience: data.target_audience,
      pricingSummary: data.pricing_summary,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async toggleArchiveProduct(
    brandId: string,
    productId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandProduct> {
    const client = this.getClient(accessToken);

    const { data: existing, error: fetchErr } = await client
      .from("brand_products")
      .select("status, name")
      .eq("id", productId)
      .eq("brand_id", brandId)
      .single();

    if (fetchErr) throw new Error(`[Supabase Core Repo] toggleArchiveProduct fetch error: ${fetchErr.message}`);

    const newStatus = existing.status === "active" ? "archived" : "active";
    const { data, error } = await client
      .from("brand_products")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] toggleArchiveProduct failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "product",
      productId,
      newStatus === "archived" ? "archive" : "unarchive",
      `${newStatus === "archived" ? "Archived" : "Restored"} product '${data.name}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      category: data.category,
      valueProposition: data.value_proposition,
      keyFeatures: data.key_features || [],
      targetAudience: data.target_audience,
      pricingSummary: data.pricing_summary,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteProduct(
    brandId: string,
    productId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getClient(accessToken);
    const { error } = await client
      .from("brand_products")
      .delete()
      .eq("id", productId)
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Core Repo] deleteProduct failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "product",
      productId,
      "delete",
      `Deleted product entity '${productId}'.`
    );

    return true;
  }

  // 5. Audiences
  async createAudience(
    brandId: string,
    input: Omit<BrandAudience, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandAudience> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_audiences")
      .insert({
        brand_id: brandId,
        name: input.name,
        job_title: input.jobTitle,
        pain_points: input.painPoints,
        goals: input.goals,
        objections: input.objections,
        preferred_channels: input.preferredChannels,
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] createAudience failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "audience",
      data.id,
      "create",
      `Created ICP persona profile '${data.name}' (${data.job_title}).`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      jobTitle: data.job_title,
      painPoints: data.pain_points || [],
      goals: data.goals || [],
      objections: data.objections || [],
      preferredChannels: data.preferred_channels || [],
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateAudience(
    brandId: string,
    audienceId: string,
    input: Partial<BrandAudience>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandAudience> {
    const client = this.getClient(accessToken);

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) payload.name = input.name;
    if (input.jobTitle !== undefined) payload.job_title = input.jobTitle;
    if (input.painPoints !== undefined) payload.pain_points = input.painPoints;
    if (input.goals !== undefined) payload.goals = input.goals;
    if (input.objections !== undefined) payload.objections = input.objections;
    if (input.preferredChannels !== undefined) payload.preferred_channels = input.preferredChannels;
    if (input.status !== undefined) payload.status = input.status;

    const { data, error } = await client
      .from("brand_audiences")
      .update(payload)
      .eq("id", audienceId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] updateAudience failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "audience",
      audienceId,
      "update",
      `Updated persona attributes for '${data.name}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      jobTitle: data.job_title,
      painPoints: data.pain_points || [],
      goals: data.goals || [],
      objections: data.objections || [],
      preferredChannels: data.preferred_channels || [],
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async toggleArchiveAudience(
    brandId: string,
    audienceId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandAudience> {
    const client = this.getClient(accessToken);

    const { data: existing, error: fetchErr } = await client
      .from("brand_audiences")
      .select("status, name")
      .eq("id", audienceId)
      .eq("brand_id", brandId)
      .single();

    if (fetchErr) throw new Error(`[Supabase Core Repo] toggleArchiveAudience fetch error: ${fetchErr.message}`);

    const newStatus = existing.status === "active" ? "archived" : "active";
    const { data, error } = await client
      .from("brand_audiences")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", audienceId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] toggleArchiveAudience failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "audience",
      audienceId,
      newStatus === "archived" ? "archive" : "unarchive",
      `${newStatus === "archived" ? "Archived" : "Restored"} audience persona '${data.name}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      jobTitle: data.job_title,
      painPoints: data.pain_points || [],
      goals: data.goals || [],
      objections: data.objections || [],
      preferredChannels: data.preferred_channels || [],
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteAudience(
    brandId: string,
    audienceId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getClient(accessToken);
    const { error } = await client
      .from("brand_audiences")
      .delete()
      .eq("id", audienceId)
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Core Repo] deleteAudience failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "audience",
      audienceId,
      "delete",
      `Deleted audience entity '${audienceId}'.`
    );

    return true;
  }

  // 6. Voice Profile
  async updateVoiceProfile(
    brandId: string,
    input: Partial<BrandVoiceProfile>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandVoiceProfile> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_voice_profiles")
      .upsert({
        brand_id: brandId,
        archetype: input.archetype,
        formality_score: input.formalityScore,
        enthusiasm_score: input.enthusiasmScore,
        technical_depth_score: input.technicalDepthScore,
        humor_score: input.humorScore,
        reading_grade_level: input.readingGradeLevel,
        primary_tone_traits: input.primaryToneTraits,
        style_guidelines: input.styleGuidelines,
        updated_at: new Date().toISOString(),
      }, { onConflict: "brand_id" })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] updateVoiceProfile failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "voice",
      data.id,
      "update",
      `Updated brand voice archetype to '${data.archetype}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      archetype: data.archetype,
      formalityScore: data.formality_score,
      enthusiasmScore: data.enthusiasm_score,
      technicalDepthScore: data.technical_depth_score,
      humorScore: data.humor_score,
      readingGradeLevel: data.reading_grade_level,
      primaryToneTraits: data.primary_tone_traits || [],
      styleGuidelines: data.style_guidelines,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // 7. Voice Examples
  async createVoiceExample(
    brandId: string,
    input: Omit<BrandVoiceExample, "id" | "brandId" | "createdAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandVoiceExample> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_voice_examples")
      .insert({
        brand_id: brandId,
        type: input.type,
        title: input.title,
        snippet: input.snippet,
        explanation: input.explanation,
        category: input.category || "General",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] createVoiceExample failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "voice",
      data.id,
      "create",
      `Added voice example [${data.type.toUpperCase()}] '${data.title}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      type: data.type,
      title: data.title,
      snippet: data.snippet,
      explanation: data.explanation,
      category: data.category,
      createdAt: data.created_at,
    };
  }

  async deleteVoiceExample(
    brandId: string,
    exampleId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getClient(accessToken);
    const { error } = await client
      .from("brand_voice_examples")
      .delete()
      .eq("id", exampleId)
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Core Repo] deleteVoiceExample failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "voice",
      exampleId,
      "delete",
      `Deleted voice example '${exampleId}'.`
    );

    return true;
  }

  // 8. Terminology
  async createTerminology(
    brandId: string,
    input: Omit<BrandTerminology, "id" | "brandId" | "createdAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandTerminology> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_terminology")
      .insert({
        brand_id: brandId,
        type: input.type,
        term: input.term,
        replacement: input.replacement,
        reason: input.reason || "",
        case_sensitive: input.caseSensitive || false,
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] createTerminology failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "terminology",
      data.id,
      "create",
      `Added terminology rule [${data.type.toUpperCase()}]: '${data.term}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      type: data.type,
      term: data.term,
      replacement: data.replacement,
      reason: data.reason,
      caseSensitive: data.case_sensitive,
      status: data.status,
      createdAt: data.created_at,
    };
  }

  async deleteTerminology(
    brandId: string,
    termId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<boolean> {
    const client = this.getClient(accessToken);
    const { error } = await client
      .from("brand_terminology")
      .delete()
      .eq("id", termId)
      .eq("brand_id", brandId);

    if (error) throw new Error(`[Supabase Core Repo] deleteTerminology failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "terminology",
      termId,
      "delete",
      `Deleted terminology rule '${termId}'.`
    );

    return true;
  }

  // 9. Policies
  async createPolicy(
    brandId: string,
    input: Omit<BrandPolicy, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandPolicy> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_policies")
      .insert({
        brand_id: brandId,
        title: input.title,
        description: input.description,
        category: input.category,
        severity: input.severity,
        enforcement_action: input.enforcementAction || "",
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] createPolicy failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "policy",
      data.id,
      "create",
      `Created brand guardrail policy '${data.title}' [Severity: ${data.severity}].`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity,
      enforcementAction: data.enforcement_action,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updatePolicy(
    brandId: string,
    policyId: string,
    input: Partial<BrandPolicy>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandPolicy> {
    const client = this.getClient(accessToken);

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.category !== undefined) payload.category = input.category;
    if (input.severity !== undefined) payload.severity = input.severity;
    if (input.enforcementAction !== undefined) payload.enforcement_action = input.enforcementAction;
    if (input.status !== undefined) payload.status = input.status;

    const { data, error } = await client
      .from("brand_policies")
      .update(payload)
      .eq("id", policyId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] updatePolicy failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "policy",
      policyId,
      "update",
      `Updated policy guardrail '${data.title}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity,
      enforcementAction: data.enforcement_action,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async toggleArchivePolicy(
    brandId: string,
    policyId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandPolicy> {
    const client = this.getClient(accessToken);

    const { data: existing, error: fetchErr } = await client
      .from("brand_policies")
      .select("status, title")
      .eq("id", policyId)
      .eq("brand_id", brandId)
      .single();

    if (fetchErr) throw new Error(`[Supabase Core Repo] toggleArchivePolicy fetch error: ${fetchErr.message}`);

    const newStatus = existing.status === "active" ? "archived" : "active";
    const { data, error } = await client
      .from("brand_policies")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", policyId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] toggleArchivePolicy failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "policy",
      policyId,
      newStatus === "archived" ? "archive" : "unarchive",
      `${newStatus === "archived" ? "Archived" : "Restored"} policy guardrail '${data.title}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      title: data.title,
      description: data.description,
      category: data.category,
      severity: data.severity,
      enforcementAction: data.enforcement_action,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // 10. Competitors
  async createCompetitor(
    brandId: string,
    input: Omit<BrandCompetitor, "id" | "brandId" | "createdAt" | "updatedAt">,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandCompetitor> {
    const client = this.getClient(accessToken);

    const { data, error } = await client
      .from("brand_competitors")
      .insert({
        brand_id: brandId,
        name: input.name,
        domain: input.domain,
        positioning: input.positioning,
        key_strengths: input.keyStrengths,
        key_weaknesses: input.keyWeaknesses,
        differentiator: input.differentiator,
        notes: input.notes,
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] createCompetitor failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "competitor",
      data.id,
      "create",
      `Tracked competitor '${data.name}' (${data.domain}).`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      domain: data.domain,
      positioning: data.positioning,
      keyStrengths: data.key_strengths || [],
      keyWeaknesses: data.key_weaknesses || [],
      differentiator: data.differentiator,
      notes: data.notes,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateCompetitor(
    brandId: string,
    competitorId: string,
    input: Partial<BrandCompetitor>,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandCompetitor> {
    const client = this.getClient(accessToken);

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) payload.name = input.name;
    if (input.domain !== undefined) payload.domain = input.domain;
    if (input.positioning !== undefined) payload.positioning = input.positioning;
    if (input.keyStrengths !== undefined) payload.key_strengths = input.keyStrengths;
    if (input.keyWeaknesses !== undefined) payload.key_weaknesses = input.keyWeaknesses;
    if (input.differentiator !== undefined) payload.differentiator = input.differentiator;
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.status !== undefined) payload.status = input.status;

    const { data, error } = await client
      .from("brand_competitors")
      .update(payload)
      .eq("id", competitorId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] updateCompetitor failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "competitor",
      competitorId,
      "update",
      `Updated competitor intelligence for '${data.name}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      domain: data.domain,
      positioning: data.positioning,
      keyStrengths: data.key_strengths || [],
      keyWeaknesses: data.key_weaknesses || [],
      differentiator: data.differentiator,
      notes: data.notes,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async toggleArchiveCompetitor(
    brandId: string,
    competitorId: string,
    user: { id: string; name: string },
    accessToken?: string
  ): Promise<BrandCompetitor> {
    const client = this.getClient(accessToken);

    const { data: existing, error: fetchErr } = await client
      .from("brand_competitors")
      .select("status, name")
      .eq("id", competitorId)
      .eq("brand_id", brandId)
      .single();

    if (fetchErr) throw new Error(`[Supabase Core Repo] toggleArchiveCompetitor fetch error: ${fetchErr.message}`);

    const newStatus = existing.status === "active" ? "archived" : "active";
    const { data, error } = await client
      .from("brand_competitors")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", competitorId)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] toggleArchiveCompetitor failed: ${error.message}`);

    await this.logAudit(
      brandId,
      user,
      "competitor",
      competitorId,
      newStatus === "archived" ? "archive" : "unarchive",
      `${newStatus === "archived" ? "Archived" : "Restored"} competitor tracking for '${data.name}'.`
    );

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      domain: data.domain,
      positioning: data.positioning,
      keyStrengths: data.key_strengths || [],
      keyWeaknesses: data.key_weaknesses || [],
      differentiator: data.differentiator,
      notes: data.notes,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // 11. Audit Logging (Non-repudiation)
  async logAudit(
    brandId: string,
    user: { id: string; name: string },
    entityType: "profile" | "product" | "audience" | "voice" | "terminology" | "policy" | "competitor",
    entityId: string,
    action: "create" | "update" | "archive" | "unarchive" | "delete",
    summary: string,
    details: Record<string, unknown> = {}
  ): Promise<BrandAuditLog> {
    const adminClient = getAdminSupabaseClient();
    const { data, error } = await adminClient
      .from("brand_audit_logs")
      .insert({
        brand_id: brandId,
        user_id: user.id,
        user_name: user.name,
        entity_type: entityType,
        entity_id: entityId,
        action,
        summary,
        details,
      })
      .select()
      .single();

    if (error) throw new Error(`[Supabase Core Repo] logAudit failed: ${error.message}`);

    return {
      id: data.id,
      brandId: data.brand_id,
      userId: data.user_id,
      userName: data.user_name,
      entityType: data.entity_type,
      entityId: data.entity_id,
      action: data.action,
      summary: data.summary,
      details: data.details,
      createdAt: data.created_at,
    };
  }

  async getAuditHistory(brandId: string, accessToken?: string): Promise<BrandAuditLog[]> {
    const client = this.getClient(accessToken);
    const { data, error } = await client
      .from("brand_audit_logs")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`[Supabase Core Repo] getAuditHistory failed: ${error.message}`);

    return (data || []).map((al) => ({
      id: al.id,
      brandId: al.brand_id,
      userId: al.user_id,
      userName: al.user_name,
      entityType: al.entity_type,
      entityId: al.entity_id,
      action: al.action,
      summary: al.summary,
      details: al.details,
      createdAt: al.created_at,
    }));
  }
}

export const supabaseBrandBrainCoreRepo = new SupabaseBrandBrainCoreRepository();
