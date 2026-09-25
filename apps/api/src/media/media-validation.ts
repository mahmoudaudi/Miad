import { randomUUID } from 'node:crypto';

/** One private bucket for all invitation media. */
export const INVITATION_MEDIA_BUCKET = 'invitation-media';
/** 6 MB hard cap per file (Feature 9 scope). */
export const MAX_MEDIA_FILE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_MEDIA_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMediaType = (typeof ALLOWED_MEDIA_FILE_TYPES)[number];

const EXTENSION_BY_TYPE: Record<AllowedMediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TYPE_BY_EXTENSION: Record<string, AllowedMediaType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_PATTERN = /^(\d{1,15})\.([0-9a-f-]{36})$/i;

export function isAllowedMediaType(value: string): value is AllowedMediaType {
  return (ALLOWED_MEDIA_FILE_TYPES as readonly string[]).includes(value);
}

export function extensionForFileType(fileType: AllowedMediaType): string {
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
  if (fileSize > MAX_MEDIA_FILE_BYTES) return 'File is too large. Maximum size is 6 MB.';
  if (!isAllowedMediaType(fileType)) return 'Only JPEG, PNG, and WebP images are supported.';
  const extension = fileExtension(fileName);
  const expected = TYPE_BY_EXTENSION[extension];
  if (!expected) return 'Only JPEG, PNG, and WebP images are supported.';
  if (expected !== fileType) return 'File extension does not match the declared file type.';
  return null;
}

export function newMediaId(): string {
  return randomUUID();
}

/**
 * Server-controlled object key inside the fixed bucket:
 * `{userId}/{invitationId}/{mediaId}.{ext}` — never derived from client input.
 */
export function storageKeyFor(input: {
  userId: string;
  invitationId: string;
  mediaId: string;
  fileType: AllowedMediaType;
}): string {
  return `${input.userId}/${input.invitationId}/${input.mediaId}.${extensionForFileType(input.fileType)}`;
}

/** Parses a stored `fileUrl` back into a bucket-relative key (bucket must match). */
export function storageKeyFromUrl(fileUrl: string): string | null {
  const prefix = `${INVITATION_MEDIA_BUCKET}/`;
  if (!fileUrl.startsWith(prefix)) return null;
  const key = fileUrl.slice(prefix.length);
  if (!key || key.includes('..') || key.startsWith('/')) return null;
  return key;
}

/** Parses a list cursor (`{createdAtMs}.{uuid}`) or returns null. */
export function parseListCursor(cursor: string): { createdAtMs: number; id: string } | null {
  const match = CURSOR_PATTERN.exec(cursor);
  if (!match) return null;
  const createdAtMs = Number(match[1]);
  const id = match[2] ?? '';
  if (!Number.isSafeInteger(createdAtMs) || !UUID_PATTERN.test(id)) return null;
  return { createdAtMs, id };
}

export function formatListCursor(createdAt: Date, id: string): string {
  return `${createdAt.getTime()}.${id}`;
}

/** Server-observed file signature check (JPEG / PNG / WebP magic bytes). */
export function matchesFileTypeSignature(fileType: AllowedMediaType, bytes: Uint8Array): boolean {
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
