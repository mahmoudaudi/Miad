import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MediaLibraryView } from './MediaLibraryView';

const noop = () => undefined;
const media = {
  id: 'media-1',
  fileName: 'venue.jpg',
  fileType: 'image/jpeg',
  fileSize: 2048,
  createdAt: '2026-09-22T00:00:00.000Z',
  previewUrl: 'https://example.supabase.co/storage/v1/object/sign/venue.jpg?token=t',
};

function render(overrides: Partial<React.ComponentProps<typeof MediaLibraryView>> = {}) {
  return renderToStaticMarkup(
    <MediaLibraryView
      invitationId="invitation-1"
      state={{ status: 'ready', items: [media], nextCursor: null }}
      upload={{ status: 'idle' }}
      loadingMore={false}
      loadMoreError={null}
      onRetryLoad={noop}
      onFileSelected={noop}
      onRetryUpload={noop}
      onLoadMore={noop}
      onDelete={noop}
      {...overrides}
    />
  );
}

describe('media library view', () => {
  it('renders loading, not-found, and error states with a real retry action', () => {
    expect(render({ state: { status: 'loading' } })).toContain('aria-busy="true"');
    const notFound = render({ state: { status: 'not-found' } });
    expect(notFound).toContain('Invitation not found');
    expect(notFound).toContain('/dashboard/events');
    const error = render({ state: { status: 'error', message: 'Offline' } });
    expect(error).toContain('Offline');
    expect(error).toContain('Try again');
  });

  it('renders the empty state with format constraints', () => {
    const html = render({ state: { status: 'ready', items: [], nextCursor: null } });
    expect(html).toContain('No media yet');
    expect(html).toContain('up to 6');
    expect(html).toContain('Choose image');
  });

  it('renders lazy previews with file metadata, delete, pagination, and upload control', () => {
    const html = render({
      state: { status: 'ready', items: [media], nextCursor: '1758508800000.media-1' },
    });
    expect(html).toContain('venue.jpg');
    expect(html).toContain('2 KB');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('https://example.supabase.co/storage/v1/object/sign/venue.jpg');
    expect(html).toContain('Delete');
    expect(html).toContain('Load more');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
  });

  it('hides pagination when there is no next page and shows load-more failures', () => {
    const noCursor = render({ state: { status: 'ready', items: [media], nextCursor: null } });
    expect(noCursor).not.toContain('Load more');
    const failed = render({
      state: { status: 'ready', items: [media], nextCursor: 'cursor' },
      loadMoreError: 'We could not load more media. Please try again.',
    });
    expect(failed).toContain('We could not load more media. Please try again.');
  });

  it('renders real upload progress, finalizing, success, and retryable error states', () => {
    const uploading = render({ upload: { status: 'uploading', fileName: 'venue.jpg', progress: 42 } });
    expect(uploading).toContain('role="progressbar"');
    expect(uploading).toContain('aria-valuenow="42"');
    expect(uploading).toContain('42%');
    expect(render({ upload: { status: 'finalizing', fileName: 'venue.jpg' } })).toContain(
      'Saving “venue.jpg”'
    );
    expect(render({ upload: { status: 'success', message: '“venue.jpg” was uploaded.' } })).toContain(
      'was uploaded'
    );
    const retryable = render({
      upload: { status: 'error', message: 'Storage hiccup', retryable: true },
    });
    expect(retryable).toContain('role="alert"');
    expect(retryable).toContain('Retry upload');
    const fatal = render({
      upload: { status: 'error', message: 'Only JPEG, PNG, and WebP images are supported.', retryable: false },
    });
    expect(fatal).toContain('Only JPEG, PNG, and WebP images are supported.');
    expect(fatal).not.toContain('Retry upload');
  });

  it('disables the file input while an upload is in flight', () => {
    const html = render({ upload: { status: 'uploading', fileName: 'venue.jpg', progress: 10 } });
    expect(html).toContain('disabled=""');
    expect(html).toContain('Uploading…');
  });

  it('renders a back link to the owning invitation', () => {
    expect(render()).toContain('/dashboard/invitations/invitation-1');
    expect(render()).toContain('Back to Invitation');
  });
});
