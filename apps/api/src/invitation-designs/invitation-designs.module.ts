import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { INVITATION_AI_PROVIDER } from './ai-provider.types';
import { InvitationDesignsController } from './invitation-designs.controller';
import { InvitationDesignsService } from './invitation-designs.service';
import { OpenAIInvitationAiProvider } from './openai-invitation-ai.provider';
import { PublicInvitationsController } from './public-invitations.controller';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [InvitationDesignsController, PublicInvitationsController],
  providers: [
    InvitationDesignsService,
    OpenAIInvitationAiProvider,
    { provide: INVITATION_AI_PROVIDER, useExisting: OpenAIInvitationAiProvider },
  ],
  exports: [InvitationDesignsService, INVITATION_AI_PROVIDER],
})
export class InvitationDesignsModule {}
