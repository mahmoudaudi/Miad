import {
  matchesFileTypeSignature,
  sanitizeFileName,
  storageKeyFor,
  storageKeyFromUrl,
  validateUploadMetadata,
} from './invitation-image-validation';

describe('invitation image validation', () => {
  it('accepts only matching JPEG, PNG, and WebP metadata within the size limit', () => {
    expect(validateUploadMetadata({ fileName: 'photo.JPG', fileType: 'image/jpeg', fileSize: 1024 })).toBeNull();
    expect(validateUploadMetadata({ fileName: 'a.png', fileType: 'image/png', fileSize: 6 * 1024 * 1024 })).toBeNull();
    expect(validateUploadMetadata({ fileName: 'a.svg', fileType: 'image/svg+xml', fileSize: 10 })).toContain('Only JPEG');
    expect(validateUploadMetadata({ fileName: 'a.png', fileType: 'image/jpeg', fileSize: 10 })).toContain('extension');
    expect(validateUploadMetadata({ fileName: 'a.png', fileType: 'image/png', fileSize: 0 })).toContain('greater than zero');
    expect(validateUploadMetadata({ fileName: 'a.png', fileType: 'image/png', fileSize: 6 * 1024 * 1024 + 1 })).toContain('too large');
  });

  it('sanitizes image display names without retaining path segments', () => {
    expect(sanitizeFileName('../../etc/photo.png')).toBe('photo.png');
    expect(sanitizeFileName('C:\\Users\\x\\shot.webp')).toBe('shot.webp');
    expect(sanitizeFileName('   ')).toBe('upload');
  });

  it('keeps the existing object layout and bucket references readable', () => {
    const key = storageKeyFor({ userId: 'user-1', invitationId: 'inv-1', imageId: 'image-1', fileType: 'image/webp' });
    expect(key).toBe('user-1/inv-1/image-1.webp');
    expect(storageKeyFromUrl(`invitation-media/${key}`)).toBe(key);
    expect(storageKeyFromUrl('invitation-media/../escape.png')).toBeNull();
  });

  it('checks server-observed image signatures', () => {
    expect(matchesFileTypeSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesFileTypeSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(matchesFileTypeSignature('image/webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(true);
  });
});
