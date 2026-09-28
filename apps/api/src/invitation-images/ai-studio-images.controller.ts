import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteImageUploadDto } from './dto/complete-image-upload.dto';
import { CreateImageUploadDto } from './dto/create-image-upload.dto';
import { InvitationImagesService } from './invitation-images.service';

/** Owner-scoped uploads created before AI Studio has created an invitation. */
@UseGuards(JwtAuthGuard)
@Controller({ path: 'ai/images', version: '1' })
export class AiStudioImagesController {
  constructor(private readonly images: InvitationImagesService) {}

  @Post('uploads')
  requestUpload(@CurrentUser() user: AuthPayload, @Body() dto: CreateImageUploadDto) {
    return this.images.requestPendingUpload(user.sub, dto);
  }

  @Post(':imageId/complete')
  completeUpload(
    @CurrentUser() user: AuthPayload,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Body() dto: CompleteImageUploadDto
  ) {
    return this.images.completePendingUpload(user.sub, imageId, dto);
  }

  @Delete(':imageId')
  remove(@CurrentUser() user: AuthPayload, @Param('imageId', new ParseUUIDPipe()) imageId: string) {
    return this.images.removeImage(user.sub, imageId, null);
  }
}
