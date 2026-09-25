import { BadRequestException } from '@nestjs/common';
import {
  formatListCursor,
  matchesFileTypeSignature,
  parseListCursor,
  sanitizeFileName,
  storageKeyFor,
  storageKeyFromUrl,
  validateUploadMetadata,
} from './media-validation';

describe('media-validation', () => {
  it('accepts only matching JPEG/PNG/WebP metadata within the 6 MB cap', () => {
    expect(
      validateUploadMetadata({ fileName: 'photo.JPG', fileType: 'image/jpeg', fileSize: 1024 })
    ).toBeNull();
    expect(
      validateUploadMetadata({ fileName: 'a.png', fileType: 'image/png', fileSize: 6 * 1024 * 1024 })
    ).toBeNull();
    expect(
      validateUploadMetadata({ fileName: 'a.svg', fileType: 'image/svg+xml', fileSize: 10 })
    ).toBe('Only JPEG, PNG, and WebP images are supported.');
    expect(
      validateUploadMetadata({ fileName: 'a.png', fileType: 'image/jpeg', fileSize: 10 })
    ).toBe('File extension does not match the declared file type.');
    expect(
      validateUploadMetadata({ fileName: 'a.png', fileType: 'image/png', fileSize: 0 })
    ).toBe('File size must be greater than zero.');
    expect(
      validateUploadMetadata({
        fileName: 'a.png',
        fileType: 'image/png',
        fileSize: 6 * 1024 * 1024 + 1,
      })
    ).toBe('File is too large. Maximum size is 6 MB.');
    expect(
      validateUploadMetadata({ fileName: 'nope.exe', fileType: 'image/png', fileSize: 10 })
    ).toBe('Only JPEG, PNG, and WebP images are supported.');
  });

  it('sanitizes display names and never keeps path segments', () => {
    expect(sanitizeFileName('../../etc/passwd.png')).toBe('passwd.png');
    expect(sanitizeFileName('C:\\Users\\x\\shot.webp')).toBe('shot.webp');
    expect(sanitizeFileName('   ')).toBe('upload');
    expect(sanitizeFileName('my photo.png')).toBe('my photo.png');
    expect(sanitizeFileName(`bad\u0000name.png`)).toBe('badname.png');
    expect(sanitizeFileName(`${'x'.repeat(300)}.png`).length).toBeLessThanOrEqual(255);
  });

  it('builds a server-controlled key and round-trips stored fileUrl values', () => {
    const key = storageKeyFor({
      userId: 'user-1',
      invitationId: 'inv-1',
      mediaId: 'media-1',
      fileType: 'image/webp',
    });
    expect(key).toBe('user-1/inv-1/media-1.webp');
    expect(storageKeyFromUrl(`invitation-media/${key}`)).toBe(key);
    expect(storageKeyFromUrl('other-bucket/user/inv/a.png')).toBeNull();
    expect(storageKeyFromUrl('invitation-media/../escape.png')).toBeNull();
  });

  it('parses and formats list cursors safely', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const cursor = formatListCursor(new Date('2026-09-22T00:00:00.000Z'), id);
    expect(parseListCursor(cursor)).toEqual({
      createdAtMs: Date.parse('2026-09-22T00:00:00.000Z'),
      id,
    });
    expect(parseListCursor('nope')).toBeNull();
    expect(parseListCursor('123.not-a-uuid')).toBeNull();
    expect(parseListCursor('999999999999999999999.11111111-1111-4111-8111-111111111111')).toBeNull();
  });

  it('verifies server-observed image signatures', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(matchesFileTypeSignature('image/png', png)).toBe(true);
    expect(matchesFileTypeSignature('image/png', jpeg)).toBe(false);
    expect(matchesFileTypeSignature('image/jpeg', jpeg)).toBe(true);
    expect(matchesFileTypeSignature('image/webp', webp)).toBe(true);
    expect(matchesFileTypeSignature('image/webp', png)).toBe(false);
    expect(matchesFileTypeSignature('image/webp', new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('rejects an invalid cursor through the shared parser contract', () => {
    expect(() => {
      if (!parseListCursor('')) throw new BadRequestException('Invalid pagination cursor.');
    }).toThrow(BadRequestException);
  });
});
