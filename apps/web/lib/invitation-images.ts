import { authenticatedApiClient, ApiError } from './api-client';

export const MAX_IMAGE_FILE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_IMAGE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type InvitationImage = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  previewUrl: string | null;
};

export type ImageUploadTarget = {
  imageId: string;
  uploadUrl: string;
};

export type ImageUploadInput = {
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
export function validateImageFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'Choose a file larger than zero bytes.';
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) return 'File is too large. Maximum size is 6 MB.';
  if (!(ALLOWED_IMAGE_FILE_TYPES as readonly string[]).includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are supported.';
  }
  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  const expected = TYPE_BY_EXTENSION[extension];
  if (!expected) return 'Only JPEG, PNG, and WebP images are supported.';
  if (expected !== file.type) return 'File extension does not match the file type.';
  return null;
}

export const requestImageUpload = (invitationId: string, input: ImageUploadInput) =>
  authenticatedApiClient<ImageUploadTarget>(
    `/invitations/${encodeURIComponent(invitationId)}/images/uploads`,
    { method: 'POST', body: JSON.stringify(input) }
  );

export const completeImageUpload = (
  invitationId: string,
  imageId: string,
  input: ImageUploadInput
) =>
  authenticatedApiClient<InvitationImage>(
    `/invitations/${encodeURIComponent(invitationId)}/images/${encodeURIComponent(imageId)}/complete`,
    { method: 'POST', body: JSON.stringify(input) }
  );

export const requestPendingImageUpload = (input: ImageUploadInput) =>
  authenticatedApiClient<ImageUploadTarget>('/ai/images/uploads', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const completePendingImageUpload = (imageId: string, input: ImageUploadInput) =>
  authenticatedApiClient<InvitationImage>(`/ai/images/${encodeURIComponent(imageId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const removePendingImage = (imageId: string) =>
  authenticatedApiClient<{ removed: true }>(`/ai/images/${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
  });

export const removeInvitationImage = (invitationId: string, imageId: string) =>
  authenticatedApiClient<{ removed: true }>(
    `/invitations/${encodeURIComponent(invitationId)}/images/${encodeURIComponent(imageId)}`,
    { method: 'DELETE' }
  );

/**
 * Uploads file bytes directly from the browser to the signed Storage target
 * (never through Next.js or NestJS) with real progress events.
 */
export function uploadImageToSignedTarget(
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

export function isRetryableImageError(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}
