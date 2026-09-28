import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_FILE_BYTES, validateImageFile } from './invitation-images';

describe('invitation image validation', () => {
  it('accepts valid JPEG, PNG, and WebP selections', () => {
    expect(validateImageFile({ name: 'photo.jpg', type: 'image/jpeg', size: 2048 })).toBeNull();
    expect(validateImageFile({ name: 'photo.JPEG', type: 'image/jpeg', size: 2048 })).toBeNull();
    expect(
      validateImageFile({ name: 'shot.png', type: 'image/png', size: MAX_IMAGE_FILE_BYTES })
    ).toBeNull();
    expect(validateImageFile({ name: 'bg.webp', type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects disallowed types, mismatches, oversize, and empty files', () => {
    expect(validateImageFile({ name: 'x.svg', type: 'image/svg+xml', size: 10 })).toBe(
      'Only JPEG, PNG, and WebP images are supported.'
    );
    expect(validateImageFile({ name: 'x.png', type: 'image/jpeg', size: 10 })).toBe(
      'File extension does not match the file type.'
    );
    expect(
      validateImageFile({ name: 'x.png', type: 'image/png', size: MAX_IMAGE_FILE_BYTES + 1 })
    ).toBe('File is too large. Maximum size is 6 MB.');
    expect(validateImageFile({ name: 'x.png', type: 'image/png', size: 0 })).toBe(
      'Choose a file larger than zero bytes.'
    );
    expect(validateImageFile({ name: 'nope.exe', type: '', size: 10 })).toBe(
      'Only JPEG, PNG, and WebP images are supported.'
    );
  });

});
