import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { copyInvitationLink, performInvitationShare, ShareButton } from './ShareButton';

describe('ShareButton', () => {
  it('renders copy, share, and success feedback affordances for a public URL', () => {
    const html = renderToStaticMarkup(
      <ShareButton url="/invite/garden-dinner" title="Garden Dinner" />
    );
    expect(html).toContain('Copy link');
    expect(html).toContain('Share');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('hover:-translate-y-px');
  });

  it('copies an absolute public URL successfully', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      copyInvitationLink('/invite/garden-dinner', { writeText }, 'https://miad.test')
    ).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('https://miad.test/invite/garden-dinner');
  });

  it('surfaces clipboard failures to the caller', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    await expect(
      copyInvitationLink('/invite/garden-dinner', { writeText }, 'https://miad.test')
    ).rejects.toThrow('permission denied');
  });

  it('uses native share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    await expect(
      performInvitationShare('/invite/garden-dinner', 'Garden Dinner', {
        origin: 'https://miad.test',
        clipboard: { writeText },
        share,
      })
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'Garden Dinner',
      url: 'https://miad.test/invite/garden-dinner',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copying when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      performInvitationShare('/invite/garden-dinner', 'Garden Dinner', {
        origin: 'https://miad.test',
        clipboard: { writeText },
      })
    ).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://miad.test/invite/garden-dinner');
  });

  it('does not render controls without a public URL', () => {
    expect(renderToStaticMarkup(<ShareButton url="" title="Draft" />)).toBe('');
  });
});
