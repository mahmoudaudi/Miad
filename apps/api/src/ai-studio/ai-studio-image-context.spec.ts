import { explicitlyRequestsUploadedImages } from './ai-studio-image-context';

describe('explicit AI Studio image requests', () => {
  it.each([
    'Use this photo for the couple.',
    'Please include my uploaded images in the invitation.',
    'Feature these pictures in a gallery.',
  ])('recognizes an explicit request: %s', (prompt) => {
    expect(explicitlyRequestsUploadedImages(prompt)).toBe(true);
  });

  it.each([
    'Create a wedding invitation for Ahmad and Sara.',
    'Use beautiful cinematic photography.',
    'Make an image-rich floral design.',
  ])('does not infer upload usage: %s', (prompt) => {
    expect(explicitlyRequestsUploadedImages(prompt)).toBe(false);
  });
});
