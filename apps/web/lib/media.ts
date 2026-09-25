import { authenticatedApiClient, ApiError } from './api-client';

export const MAX_MEDIA_FILE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_MEDIA_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type MediaRecord = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  previewUrl: string | null;
};

export type MediaListResponse = {
  items: MediaRecord[];
  nextCursor: string | null;
};

export type MediaUploadTarget = {
  mediaId: string;
  uploadUrl: string;
};

export type MediaUploadInput = {
  fileName: string;
  fileType: string;
  fileSize: number;
};

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Client-side pre-check mirroring the server rules (server re-validates). */
export function validateMediaFile(file: { name: string; type: string; size: number }): string | null {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'Choose a file larger than zero bytes.';
  }
  if (file.size > MAX_MEDIA_FILE_BYTES) return 'File is too large. Maximum size is 6 MB.';
  if (!(ALLOWED_MEDIA_FILE_TYPES as readonly string[]).includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are supported.';
  }
  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  const expected = TYPE_BY_EXTENSION[extension];
  if (!expected) return 'Only JPEG, PNG, and WebP images are supported.';
  if (expected !== file.type) return 'File extension does not match the file type.';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const listMedia = (invitationId: string, cursor?: string) =>
  authenticatedApiClient<MediaListResponse>(
    `/invitations/${encodeURIComponent(invitationId)}/media${
      cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    }`
  );

export const requestMediaUpload = (invitationId: string, input: MediaUploadInput) =>
  authenticatedApiClient<MediaUploadTarget>(
    `/invitations/${encodeURIComponent(invitationId)}/media/uploads`,
    { method: 'POST', body: JSON.stringify(input) }
  );

export const completeMediaUpload = (
  invitationId: string,
  mediaId: string,
  input: MediaUploadInput
) =>
  authenticatedApiClient<MediaRecord>(
    `/invitations/${encodeURIComponent(invitationId)}/media/${encodeURIComponent(mediaId)}/complete`,
    { method: 'POST', body: JSON.stringify(input) }
  );

export const deleteMediaAsset = (invitationId: string, mediaId: string) =>
  authenticatedApiClient<void>(
    `/invitations/${encodeURIComponent(invitationId)}/media/${encodeURIComponent(mediaId)}`,
    { method: 'DELETE' }
  );

/**
 * Uploads file bytes directly from the browser to the signed Storage target
 * (never through Next.js or NestJS) with real progress events.
 */
export function uploadToSignedTarget(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error('The upload failed. Check your connection.'));
    request.onabort = () => reject(new Error('The upload was interrupted.'));
    request.send(file);
  });
}

export function isRetryableMediaError(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}
