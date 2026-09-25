import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService } from './community.service';
import { ListCommunityQueryDto } from './dto/list-community-query.dto';
import { PublishCommunityDesignDto } from './dto/publish-community-design.dto';
import { UpdateCommunityPublicationDto } from './dto/update-community-publication.dto';

@Controller({ path: 'community', version: '1' })
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  list(@Query() query: ListCommunityQueryDto) {
    return this.community.list(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMine(@CurrentUser() user: AuthPayload) {
    return this.community.listMine(user.sub);
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  findPublic(@Param('slug') slug: string) {
    return this.community.findPublic(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:invitationId')
  publish(@CurrentUser() user: AuthPayload, @Param('invitationId', new ParseUUIDPipe()) invitationId: string, @Body() dto: PublishCommunityDesignDto) {
    return this.community.publish(user.sub, invitationId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/publication')
  updatePublication(@CurrentUser() user: AuthPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCommunityPublicationDto) {
    return this.community.updatePublication(user.sub, id, dto.published);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug/use/:invitationId')
  apply(@CurrentUser() user: AuthPayload, @Param('slug') slug: string, @Param('invitationId', new ParseUUIDPipe()) invitationId: string) {
    return this.community.apply(user.sub, slug, invitationId);
  }
}
