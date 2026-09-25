import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteMediaUploadDto } from './dto/complete-media-upload.dto';
import { CreateMediaUploadDto } from './dto/create-media-upload.dto';
import { ListMediaQueryDto } from './dto/list-media-query.dto';
import { MediaService } from './media.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'invitations/:invitationId/media', version: '1' })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Query() query: ListMediaQueryDto
  ) {
    return this.media.list(user.sub, invitationId, query.cursor, query.limit);
  }

  @Post('uploads')
  requestUpload(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: CreateMediaUploadDto
  ) {
    return this.media.requestUpload(user.sub, invitationId, dto);
  }

  @Post(':mediaId/complete')
  completeUpload(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
    @Body() dto: CompleteMediaUploadDto
  ) {
    return this.media.completeUpload(user.sub, invitationId, mediaId, dto);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string
  ) {
    await this.media.remove(user.sub, invitationId, mediaId);
  }
}
