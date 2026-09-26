import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  GenerateInvitationDesignDto,
  RefineInvitationDesignDto,
} from './dto/ai-invitation-design.dto';
import { SetInvitationDesignDto } from './dto/set-invitation-design.dto';
import { UpdateInvitationDesignDto } from './dto/update-invitation-design.dto';
import { htmlContentSecurityPolicy, renderHtmlDocument } from './html-artifact';
import { InvitationDesignsService } from './invitation-designs.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'invitations/:invitationId/design', version: '1' })
export class InvitationDesignsController {
  constructor(private readonly designs: InvitationDesignsService) {}

  @Get()
  findCurrent(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string
  ) {
    return this.designs.findCurrent(user.sub, invitationId);
  }

  @Get('render')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  async renderOwned(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Res() res: Response
  ): Promise<void> {
    const artifact = await this.designs.findOwnedRenderable(user.sub, invitationId);
    const nonce = randomBytes(18).toString('base64url');
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
      'Cache-Control': 'no-store',
    });
    res.send(renderHtmlDocument(artifact, nonce));
  }

  @Post()
  create(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: SetInvitationDesignDto
  ) {
    return this.designs.create(user.sub, invitationId, dto.theme);
  }

  @Post('ai/generate')
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  generateWithAi(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: GenerateInvitationDesignDto
  ) {
    return this.designs.generateWithAi(user.sub, invitationId, dto);
  }

  @Post('ai/generate-html')
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  generateHtmlWithAi(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: GenerateInvitationDesignDto
  ) {
    return this.designs.generateHtmlWithAi(user.sub, invitationId, dto.prompt);
  }

  @Post('ai/refine')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  refineWithAi(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: RefineInvitationDesignDto
  ) {
    return this.designs.refineWithAi(user.sub, invitationId, dto);
  }

  @Post('ai/refine-html')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  refineHtmlWithAi(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: RefineInvitationDesignDto
  ) {
    return this.designs.refineHtmlWithAi(user.sub, invitationId, dto.instruction);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: UpdateInvitationDesignDto
  ) {
    return this.designs.update(user.sub, invitationId, dto);
  }
}
