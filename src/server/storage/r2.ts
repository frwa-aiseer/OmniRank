import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "../env.ts";

export interface StorageUploadResult {
  key: string;
  bucket: string;
  sizeBytes: number;
  contentType: string;
  etag?: string;
  publicUrl?: string;
  adapter: "live_cloudflare_r2" | "local_dev_storage";
}

export interface StorageObjectResult {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  sizeBytes: number;
}

/**
 * LocalDevStorageAdapter
 * Clearly labeled in-memory object storage adapter for local development and testing
 * when Cloudflare R2 credentials are not provided.
 */
export class LocalDevStorageAdapter {
  private store: Map<string, { body: Buffer; contentType: string; metadata?: Record<string, string> }> = new Map();

  async upload(params: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<StorageUploadResult> {
    const buffer = Buffer.isBuffer(params.body)
      ? params.body
      : typeof params.body === "string"
      ? Buffer.from(params.body, "utf-8")
      : Buffer.from(params.body);

    this.store.set(params.key, {
      body: buffer,
      contentType: params.contentType,
      metadata: params.metadata
    });

    return {
      key: params.key,
      bucket: "local-dev-bucket",
      sizeBytes: buffer.byteLength,
      contentType: params.contentType,
      etag: `local-etag-${params.key.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`,
      adapter: "local_dev_storage"
    };
  }

  async retrieve(key: string): Promise<StorageObjectResult> {
    const item = this.store.get(key);
    if (!item) {
      throw new Error(`[LocalDevStorage] Object not found for key: ${key}`);
    }
    return {
      key,
      body: item.body,
      contentType: item.contentType,
      metadata: item.metadata,
      sizeBytes: item.body.byteLength
    };
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async getSignedDownloadUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    if (!this.store.has(key)) {
      throw new Error(`[LocalDevStorage] Object not found for key: ${key}`);
    }
    return `/api/storage/local-file/${encodeURIComponent(key)}`;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * R2StorageService
 * S3-compatible Cloudflare R2 object storage adapter.
 * Uses AWS S3 client against Cloudflare R2 endpoint when credentials are configured,
 * with explicit fallback to LocalDevStorageAdapter when credentials are absent.
 */
export class R2StorageService {
  private accountId?: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;
  private bucketName: string;
  private s3Client: S3Client | null = null;
  private localAdapter: LocalDevStorageAdapter = new LocalDevStorageAdapter();

  constructor() {
    const env = getServerEnv();
    this.accountId = env.R2_ACCOUNT_ID;
    this.accessKeyId = env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    this.bucketName = env.R2_BUCKET_NAME || "omnirank-private-assets";

    if (this.isConfigured()) {
      this.s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.accessKeyId!,
          secretAccessKey: this.secretAccessKey!
        }
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.accountId !== "placeholder-r2-account"
    );
  }

  getAdapterName(): "live_cloudflare_r2" | "local_dev_storage" {
    return this.isConfigured() ? "live_cloudflare_r2" : "local_dev_storage";
  }

  async verifyLiveConnection(): Promise<{ verified: boolean; message: string }> {
    if (!this.isConfigured() || !this.s3Client) {
      return {
        verified: false,
        message: "Live Cloudflare R2 credentials not configured. Using local development storage adapter."
      };
    }

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      return {
        verified: true,
        message: `Successfully connected to live Cloudflare R2 bucket: ${this.bucketName}`
      };
    } catch (err: any) {
      return {
        verified: false,
        message: `Cloudflare R2 bucket head verification failed: ${err.message}`
      };
    }
  }

  async uploadObject(params: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<StorageUploadResult> {
    const buffer = Buffer.isBuffer(params.body)
      ? params.body
      : typeof params.body === "string"
      ? Buffer.from(params.body, "utf-8")
      : Buffer.from(params.body);

    if (!this.isConfigured() || !this.s3Client) {
      return await this.localAdapter.upload(params);
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: params.key,
        Body: buffer,
        ContentType: params.contentType,
        Metadata: params.metadata
      });

      const response = await this.s3Client.send(command);

      return {
        key: params.key,
        bucket: this.bucketName,
        sizeBytes: buffer.byteLength,
        contentType: params.contentType,
        etag: response.ETag,
        adapter: "live_cloudflare_r2"
      };
    } catch (err: any) {
      // If live R2 fails, log warning and do not pretend success
      throw new Error(`Failed to upload object to Cloudflare R2: ${err.message}`);
    }
  }

  async retrieveObject(key: string): Promise<StorageObjectResult> {
    if (!this.isConfigured() || !this.s3Client) {
      return await this.localAdapter.retrieve(key);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      const response = await this.s3Client.send(command);
      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      };

      const bodyBuffer = await streamToBuffer(response.Body);
      return {
        key,
        body: bodyBuffer,
        contentType: response.ContentType || "application/octet-stream",
        metadata: response.Metadata,
        sizeBytes: bodyBuffer.byteLength
      };
    } catch (err: any) {
      throw new Error(`Failed to retrieve object from Cloudflare R2: ${err.message}`);
    }
  }

  async deleteObject(key: string): Promise<boolean> {
    if (!this.isConfigured() || !this.s3Client) {
      return await this.localAdapter.delete(key);
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      await this.s3Client.send(command);
      return true;
    } catch (err: any) {
      throw new Error(`Failed to delete object from Cloudflare R2: ${err.message}`);
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.isConfigured() || !this.s3Client) {
      return await this.localAdapter.getSignedDownloadUrl(key, expiresInSeconds);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (err: any) {
      throw new Error(`Failed to generate signed URL for Cloudflare R2 object: ${err.message}`);
    }
  }
}

export const r2Storage = new R2StorageService();
