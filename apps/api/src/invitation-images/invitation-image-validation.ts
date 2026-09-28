import { randomUUID } from 'node:crypto';

/** Keep the historical bucket name so existing uploaded images remain addressable. */
export const INVITATION_IMAGE_BUCKET = 'invitation-media';
export const MAX_IMAGE_FILE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_IMAGE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_FILE_TYPES)[number];

const EXTENSION_BY_TYPE: Record<AllowedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TYPE_BY_EXTENSION: Record<string, AllowedImageType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_FILE_TYPES as readonly string[]).includes(value);
}

export function extensionForFileType(fileType: AllowedImageType): string {
  return EXTENSION_BY_TYPE[fileType];
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** Strips any path segments/control characters; never used as an object path. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'upload';
  if (cleaned.length <= 255) return cleaned;
  const extension = fileExtension(cleaned);
  const suffix = extension ? `.${extension}` : '';
  return `${cleaned.slice(0, 255 - suffix.length)}${suffix}`;
}

/**
 * Server-side metadata validation: extension, declared MIME consistency,
 * and byte-size bounds. Returns a user-safe error message or null.
 */
export function validateUploadMetadata(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
}): string | null {
  const { fileName, fileType, fileSize } = input;
  if (!Number.isInteger(fileSize) || fileSize <= 0) return 'File size must be greater than zero.';
  if (fileSize > MAX_IMAGE_FILE_BYTES) return 'File is too large. Maximum size is 6 MB.';
  if (!isAllowedImageType(fileType)) return 'Only JPEG, PNG, and WebP images are supported.';
  const extension = fileExtension(fileName);
  const expected = TYPE_BY_EXTENSION[extension];
  if (!expected) return 'Only JPEG, PNG, and WebP images are supported.';
  if (expected !== fileType) return 'File extension does not match the declared file type.';
  return null;
}

export function newImageId(): string {
  return randomUUID();
}

/**
 * Server-controlled object key inside the fixed bucket:
 * `{userId}/{invitationId}/{imageId}.{ext}` — never derived from client input.
 */
export function storageKeyFor(input: {
  userId: string;
  invitationId: string;
  imageId: string;
  fileType: AllowedImageType;
}): string {
  return `${input.userId}/${input.invitationId}/${input.imageId}.${extensionForFileType(input.fileType)}`;
}

/** Server-controlled staging key for an upload made before an invitation exists. */
export function pendingStorageKeyFor(input: {
  userId: string;
  imageId: string;
  fileType: AllowedImageType;
}): string {
  return `${input.userId}/pending/${input.imageId}.${extensionForFileType(input.fileType)}`;
}

/** Parses a stored `fileUrl` back into a bucket-relative key (bucket must match). */
export function storageKeyFromUrl(fileUrl: string): string | null {
  const prefix = `${INVITATION_IMAGE_BUCKET}/`;
  if (!fileUrl.startsWith(prefix)) return null;
  const key = fileUrl.slice(prefix.length);
  if (!key || key.includes('..') || key.startsWith('/')) return null;
  return key;
}

/** Server-observed file signature check (JPEG / PNG / WebP magic bytes). */
export function matchesFileTypeSignature(fileType: AllowedImageType, bytes: Uint8Array): boolean {
  if (fileType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }
  if (fileType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (bytes.length < 12) return false;
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...Array.from(bytes.slice(start, end)));
  return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
}
