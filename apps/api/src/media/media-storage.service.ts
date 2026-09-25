import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageClient } from '@supabase/storage-js';
import {
  ALLOWED_MEDIA_FILE_TYPES,
  INVITATION_MEDIA_BUCKET,
  MAX_MEDIA_FILE_BYTES,
} from './media-validation';

export type SignedUploadTarget = { uploadUrl: string; token: string };
export type ObjectInfo = { size: number; mimetype: string | null };

/**
 * Server-only Supabase Storage adapter for the private `invitation-media`
 * bucket. The service-role key never leaves this process.
 */
@Injectable()
export class MediaStorageService {
  private readonly client: StorageClient | null;
  private bucketReady: Promise<void> | null = null;

  constructor(config: ConfigService) {
    const supabaseUrl = config.get<string>('supabaseUrl') ?? '';
    const serviceKey = config.get<string>('supabaseServiceRoleKey') ?? '';
    this.client =
      supabaseUrl && serviceKey
        ? new StorageClient(`${supabaseUrl.replace(/\/$/, '')}/storage/v1`, {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          })
        : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  /** Creates the private bucket on first use (idempotent, race-safe). */
  async ensureBucket(): Promise<void> {
    const client = this.requireClient();
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const existing = await client.getBucket(INVITATION_MEDIA_BUCKET);
        if (existing.error === null && existing.data) return;
        const created = await client.createBucket(INVITATION_MEDIA_BUCKET, {
          public: false,
          fileSizeLimit: MAX_MEDIA_FILE_BYTES,
          allowedMimeTypes: [...ALLOWED_MEDIA_FILE_TYPES],
        });
        if (created.error) {
          // Another worker may have created it concurrently — re-check once.
          const retried = await client.getBucket(INVITATION_MEDIA_BUCKET);
          if (retried.error === null && retried.data) return;
          throw new Error('bucket-create-failed');
        }
      })().catch((error: unknown) => {
        this.bucketReady = null;
        throw error;
      });
    }
    return this.bucketReady;
  }

  /** Signs a single server-generated object path for a direct browser upload. */
  async createSignedUploadUrl(objectKey: string): Promise<SignedUploadTarget> {
    await this.ensureBucket();
    const bucket = this.requireBucket();
    const { data, error } = await bucket.createSignedUploadUrl(objectKey);
    if (error || !data?.token || !data.signedUrl) throw new Error('sign-upload-failed');
    return { uploadUrl: data.signedUrl, token: data.token };
  }

  /** Batch-signs short-lived preview URLs for one page of objects. */
  async createSignedPreviewUrls(objectKeys: string[], expiresIn: number): Promise<(string | null)[]> {
    if (objectKeys.length === 0) return [];
    const bucket = this.requireBucket();
    const { data, error } = await bucket.createSignedUrls(objectKeys, expiresIn);
    if (error) throw new Error('sign-previews-failed');
    return (data ?? []).map((entry) => entry.signedUrl ?? null);
  }

  /** Returns object metadata (exists/size/mimetype) or null when missing. */
  async getObjectInfo(objectKey: string): Promise<ObjectInfo | null> {
    const bucket = this.requireBucket();
    const { data, error } = await bucket.info(objectKey);
    if (error) {
      if (error.status === 404) return null;
      throw new Error('object-info-failed');
    }
    if (!data) return null;
    const size = typeof data.size === 'number' ? data.size : Number(data.size ?? 0);
    const mimetype =
      typeof data.contentType === 'string' && data.contentType.length > 0
        ? data.contentType
        : null;
    return { size, mimetype };
  }

  /** Downloads the stored bytes for server-side signature verification. */
  async downloadObject(objectKey: string): Promise<Uint8Array | null> {
    const bucket = this.requireBucket();
    const { data, error } = await bucket.download(objectKey);
    if (error) {
      if (error.status === 404) return null;
      throw new Error('download-object-failed');
    }
    if (!data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  /** Deletes an object; missing objects are treated as success (retry-safe). */
  async removeObject(objectKey: string): Promise<void> {
    const bucket = this.requireBucket();
    const { error } = await bucket.remove([objectKey]);
    if (error && error.status !== 404) throw new Error('remove-object-failed');
  }

  private requireClient(): StorageClient {
    if (!this.client) {
      throw new ServiceUnavailableException('Media storage is unavailable.');
    }
    return this.client;
  }

  private requireBucket() {
    return this.requireClient().from(INVITATION_MEDIA_BUCKET);
  }
}
