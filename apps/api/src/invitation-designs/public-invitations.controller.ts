import { Controller, Get, Header, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { htmlContentSecurityPolicy, renderHtmlDocument } from './html-artifact';
import { InvitationDesignsService } from './invitation-designs.service';
import { MediaService } from '../media/media.service';

@Controller({ path: 'public/invitations', version: '1' })
export class PublicInvitationsController {
  constructor(
    private readonly designs: InvitationDesignsService,
    private readonly media: MediaService
  ) {}

  @Get(':slug/render')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  async renderPublished(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    const artifact = await this.designs.findPublishedRenderable(slug);
    const nonce = randomBytes(18).toString('base64url');
    const document = renderHtmlDocument(artifact, nonce);
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': htmlContentSecurityPolicy(nonce),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy':
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
    });
    res.send(document);
  }

  @Get(':slug')
  findPublished(@Param('slug') slug: string, @Req() req: Request) {
    return this.designs.findPublished(slug, `${req.protocol}://${req.get('host')}`);
  }

  /**
   * Public photo bytes for published invitations. Long-lived cache is safe:
   * storage object paths are unique and never reused.
   */
  @Get(':slug/media/:mediaId/content')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Header('Cache-Control', 'public, max-age=3600')
  async servePublicMedia(
    @Param('slug') slug: string,
    @Param('mediaId') mediaId: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    const file = await this.media.downloadPublicMedia(slug, mediaId);
    if (!file) throw new NotFoundException('Media not found.');
    res.set('Content-Type', file.fileType);
    res.send(Buffer.from(file.bytes));
  }
}
