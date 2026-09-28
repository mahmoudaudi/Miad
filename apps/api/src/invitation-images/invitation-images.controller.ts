import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteImageUploadDto } from './dto/complete-image-upload.dto';
import { CreateImageUploadDto } from './dto/create-image-upload.dto';
import { InvitationImagesService } from './invitation-images.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'invitations/:invitationId/images', version: '1' })
export class InvitationImagesController {
  constructor(private readonly images: InvitationImagesService) {}
  @Post('uploads')
  requestUpload(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Body() dto: CreateImageUploadDto
  ) {
    return this.images.requestUpload(user.sub, invitationId, dto);
  }

  @Post(':imageId/complete')
  completeUpload(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Body() dto: CompleteImageUploadDto
  ) {
    return this.images.completeUpload(user.sub, invitationId, imageId, dto);
  }

  @Delete(':imageId')
  remove(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string
  ) {
    return this.images.removeImage(user.sub, imageId, invitationId);
  }

  @Get(':imageId/content')
  async content(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.images.downloadOwnedImage(user.sub, invitationId, imageId);
    res.set({
      'Content-Type': file.fileType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(file.bytes));
  }
}
