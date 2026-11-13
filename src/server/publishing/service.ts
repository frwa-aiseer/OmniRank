/**
 * OR-P10 — Publishing Service
 *
 * Coordinates CMS publishing jobs with idempotency, sanitized HTML serialization,
 * and protected credential handling.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { serializeDocumentToWordPressHtml } from "./html-serializer.ts";
import { WordPressClient, WordPressCredentials } from "./wordpress-client.ts";
import { ArticleBlock } from "../../types/article.ts";

export interface PublishArticleOptions {
  articleId: string;
  versionId: string;
  brandId: string;
  organizationId: string;
  integrationId: string;
  status?: "draft" | "publish" | "future";
  scheduledFor?: string;
  categories?: number[];
}

export class PublishingService {
  constructor(
    private userClient: SupabaseClient,
    private adminClient: SupabaseClient
  ) {}

  /**
   * Save or update WordPress integration with protected credentials.
   * Credentials stored in protected_credentials table.
   */
  async saveWordPressIntegration(params: {
    brandId: string;
    organizationId: string;
    websiteId?: string;
    name: string;
    endpointUrl: string;
    username: string;
    appPassword: string;
  }): Promise<{ id: string; name: string; endpointUrl: string }> {
    // 1. Insert or update integration
    const { data: integration, error: intErr } = await this.userClient
      .from("integrations")
      .insert({
        brand_id: params.brandId,
        organization_id: params.organizationId,
        website_id: params.websiteId ?? null,
        type: "wordpress",
        name: params.name,
        status: "active",
        config: { site_url: params.endpointUrl },
      })
      .select()
      .single();

    if (intErr) throw intErr;

    // 2. Store protected credentials (admin client or authorized user client)
    const { error: credErr } = await this.adminClient
      .from("protected_credentials")
      .upsert({
        integration_id: integration.id,
        organization_id: params.organizationId,
        brand_id: params.brandId,
        endpoint_url: params.endpointUrl,
        username: params.username,
        app_password: params.appPassword,
        auth_type: "application_password",
      });

    if (credErr) throw credErr;

    return {
      id: integration.id,
      name: integration.name,
      endpointUrl: params.endpointUrl,
    };
  }

  /**
   * Test integration connection without returning secrets.
   */
  async testIntegration(integrationId: string, brandId: string): Promise<{ success: boolean; message?: string }> {
    const { data: creds, error } = await this.adminClient
      .from("protected_credentials")
      .select("endpoint_url, username, app_password")
      .eq("integration_id", integrationId)
      .eq("brand_id", brandId)
      .single();

    if (error || !creds) throw new Error("Integration credentials not found");

    const client = new WordPressClient({
      endpointUrl: creds.endpoint_url,
      username: creds.username,
      appPassword: creds.app_password,
    });

    const result = await client.testConnection();

    // Record test status
    await this.adminClient
      .from("protected_credentials")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: result.success ? "success" : "failed",
        last_test_error: result.error ?? null,
      })
      .eq("integration_id", integrationId);

    return {
      success: result.success,
      message: result.success ? `Connected as ${result.user?.name}` : result.error,
    };
  }

  /**
   * Publish an article version to WordPress with idempotency.
   */
  async publishArticle(options: PublishArticleOptions): Promise<{
    remotePostId: string;
    remoteUrl: string;
    status: string;
    idempotent: boolean;
  }> {
    const idempotencyKey = `${options.articleId}:${options.versionId}:${options.integrationId}`;

    // 1. Check if already published with this idempotency key
    const { data: existingJob } = await this.userClient
      .from("publishing_jobs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "completed")
      .maybeSingle();

    if (existingJob) {
      const { data: mapping } = await this.userClient
        .from("cms_content_mappings")
        .select("*")
        .eq("article_id", options.articleId)
        .eq("integration_id", options.integrationId)
        .maybeSingle();

      if (mapping) {
        return {
          remotePostId: mapping.remote_post_id,
          remoteUrl: mapping.remote_url ?? "",
          status: mapping.remote_status,
          idempotent: true,
        };
      }
    }

    // 2. Fetch article version content
    const { data: version, error: vErr } = await this.userClient
      .from("article_versions")
      .select("content, article_id")
      .eq("id", options.versionId)
      .eq("brand_id", options.brandId)
      .single();

    if (vErr || !version) throw new Error("Article version not found");

    const blocks: ArticleBlock[] = version.content?.document?.blocks ?? [];
    const title: string = version.content?.title ?? "Untitled Article";
    const slug: string = version.content?.slug ?? "";

    // 3. Render sanitized HTML
    const sanitizedHtml = serializeDocumentToWordPressHtml(blocks);

    // 4. Fetch protected credentials
    const { data: creds, error: credErr } = await this.adminClient
      .from("protected_credentials")
      .select("endpoint_url, username, app_password")
      .eq("integration_id", options.integrationId)
      .eq("brand_id", options.brandId)
      .single();

    if (credErr || !creds) throw new Error("Integration credentials not configured");

    const wpClient = new WordPressClient({
      endpointUrl: creds.endpoint_url,
      username: creds.username,
      appPassword: creds.app_password,
    });

    const targetStatus = options.status ?? "draft";

    // 5. Check if mapping already exists (update vs create)
    const { data: existingMapping } = await this.userClient
      .from("cms_content_mappings")
      .select("remote_post_id")
      .eq("article_id", options.articleId)
      .eq("integration_id", options.integrationId)
      .maybeSingle();

    let remotePost: any;
    if (existingMapping?.remote_post_id) {
      remotePost = await wpClient.updatePost(existingMapping.remote_post_id, {
        title,
        content: sanitizedHtml,
        status: targetStatus,
        slug,
        categories: options.categories,
      });
    } else {
      remotePost = await wpClient.createPost({
        title,
        content: sanitizedHtml,
        status: targetStatus,
        slug,
        categories: options.categories,
      });
    }

    const remotePostId = String(remotePost.id);
    const remoteUrl = remotePost.link ?? "";

    // 6. Record CMS Content Mapping
    await this.userClient.from("cms_content_mappings").upsert({
      organization_id: options.organizationId,
      brand_id: options.brandId,
      article_id: options.articleId,
      version_id: options.versionId,
      integration_id: options.integrationId,
      remote_post_id: remotePostId,
      remote_url: remoteUrl,
      remote_status: targetStatus,
      last_published_at: targetStatus === "publish" ? new Date().toISOString() : null,
      metadata: { wp_date: remotePost.date },
    });

    // 7. Record completed publishing job
    await this.userClient.from("publishing_jobs").upsert({
      organization_id: options.organizationId,
      brand_id: options.brandId,
      article_id: options.articleId,
      version_id: options.versionId,
      integration_id: options.integrationId,
      action: targetStatus === "publish" ? "publish" : "create_draft",
      status: "completed",
      idempotency_key: idempotencyKey,
      attempts: 1,
      completed_at: new Date().toISOString(),
    });

    // 8. If published, update article status
    if (targetStatus === "publish") {
      await this.userClient
        .from("articles")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("id", options.articleId)
        .eq("brand_id", options.brandId);
    }

    return {
      remotePostId,
      remoteUrl,
      status: targetStatus,
      idempotent: false,
    };
  }
}
