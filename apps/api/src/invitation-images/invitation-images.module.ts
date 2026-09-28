import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationImagesController } from './invitation-images.controller';
import { InvitationImagesService } from './invitation-images.service';
import { InvitationImageStorageService } from './invitation-image-storage.service';
import { AiStudioImagesController } from './ai-studio-images.controller';

@Module({
  imports: [AuthModule],
  controllers: [InvitationImagesController, AiStudioImagesController],
  providers: [InvitationImagesService, InvitationImageStorageService],
  exports: [InvitationImagesService, InvitationImageStorageService],
})
export class InvitationImagesModule {}
