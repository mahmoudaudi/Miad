import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationImagesModule } from '../invitation-images/invitation-images.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [AuthModule, PrismaModule, InvitationImagesModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
