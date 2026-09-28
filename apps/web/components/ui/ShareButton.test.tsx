import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  copyInvitationLink,
  invitationShareHref,
  performInstagramShare,
  performInvitationShare,
  ShareButton,
} from './ShareButton';

describe('ShareButton', () => {
  it('renders a single public invitation share trigger', () => {
    const html = renderToStaticMarkup(
      <ShareButton url="/invite/garden-dinner" title="Garden Dinner" />
    );
    expect(html).toContain('aria-label="Share invitation"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('>Share</span>');
    expect(html).not.toContain('Garden Dinner');
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

  it('builds platform-specific links without inventing an Instagram share URL', () => {
    expect(invitationShareHref('whatsapp', '/invite/garden', 'Garden Dinner', 'https://miad.test'))
      .toContain('https://wa.me/?text=');
    expect(invitationShareHref('facebook', '/invite/garden', 'Garden Dinner', 'https://miad.test'))
      .toContain('https://www.facebook.com/sharer/sharer.php?u=');
    expect(invitationShareHref('x', '/invite/garden', 'Garden Dinner', 'https://miad.test'))
      .toContain('https://twitter.com/intent/tweet?');
    expect(invitationShareHref('telegram', '/invite/garden', 'Garden Dinner', 'https://miad.test'))
      .toContain('https://t.me/share/url?');
    expect(invitationShareHref('email', '/invite/garden', 'Garden Dinner', 'https://miad.test'))
      .toContain('mailto:?subject=');
    expect(invitationShareHref('instagram', '/invite/garden', 'Garden Dinner', 'https://miad.test'))
      .toBeNull();
  });

  it('uses native sharing for Instagram when available and copies the link otherwise', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(performInstagramShare('/invite/garden', 'Garden Dinner', {
      origin: 'https://miad.test', clipboard: { writeText }, share,
    })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Garden Dinner', url: 'https://miad.test/invite/garden' });
    expect(writeText).not.toHaveBeenCalled();

    await expect(performInstagramShare('/invite/garden', 'Garden Dinner', {
      origin: 'https://miad.test', clipboard: { writeText },
    })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://miad.test/invite/garden');
  });

  it('keeps motion preference support in the share overlay styles', () => {
    const styles = readFileSync(new URL('./ShareButton.module.css', import.meta.url), 'utf8');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('share-dialog-out');
  });

  it('does not render controls without a public URL', () => {
    expect(renderToStaticMarkup(<ShareButton url="" title="Draft" />)).toBe('');
  });
});
