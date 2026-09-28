import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationImagesModule } from '../invitation-images/invitation-images.module';
import { InvitationDesignsModule } from '../invitation-designs/invitation-designs.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, InvitationImagesModule, InvitationDesignsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
