import { describe, expect, it } from 'vitest';
import { formatFileSize, MAX_MEDIA_FILE_BYTES, validateMediaFile } from './media';

describe('media validation', () => {
  it('accepts valid JPEG, PNG, and WebP selections', () => {
    expect(validateMediaFile({ name: 'photo.jpg', type: 'image/jpeg', size: 2048 })).toBeNull();
    expect(validateMediaFile({ name: 'photo.JPEG', type: 'image/jpeg', size: 2048 })).toBeNull();
    expect(
      validateMediaFile({ name: 'shot.png', type: 'image/png', size: MAX_MEDIA_FILE_BYTES })
    ).toBeNull();
    expect(validateMediaFile({ name: 'bg.webp', type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects disallowed types, mismatches, oversize, and empty files', () => {
    expect(validateMediaFile({ name: 'x.svg', type: 'image/svg+xml', size: 10 })).toBe(
      'Only JPEG, PNG, and WebP images are supported.'
    );
    expect(validateMediaFile({ name: 'x.png', type: 'image/jpeg', size: 10 })).toBe(
      'File extension does not match the file type.'
    );
    expect(
      validateMediaFile({ name: 'x.png', type: 'image/png', size: MAX_MEDIA_FILE_BYTES + 1 })
    ).toBe('File is too large. Maximum size is 6 MB.');
    expect(validateMediaFile({ name: 'x.png', type: 'image/png', size: 0 })).toBe(
      'Choose a file larger than zero bytes.'
    );
    expect(validateMediaFile({ name: 'nope.exe', type: '', size: 10 })).toBe(
      'Only JPEG, PNG, and WebP images are supported.'
    );
  });

  it('formats byte sizes for display', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(MAX_MEDIA_FILE_BYTES)).toBe('6.0 MB');
  });
});
