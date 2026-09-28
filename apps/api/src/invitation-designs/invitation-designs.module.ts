import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { InvitationImagesModule } from '../invitation-images/invitation-images.module';
import { INVITATION_AI_PROVIDER } from './ai-provider.types';
import { InvitationDesignsController } from './invitation-designs.controller';
import { InvitationDesignsService } from './invitation-designs.service';
import { AiModelRoutingService } from './ai-model-routing.service';
import { OpenRouterInvitationAiProvider } from './openai-invitation-ai.provider';
import { PublicInvitationsController } from './public-invitations.controller';
import { StitchMcpService } from './stitch-mcp.service';

@Module({
  imports: [AuthModule, InvitationImagesModule, BillingModule],
  controllers: [InvitationDesignsController, PublicInvitationsController],
  providers: [
    InvitationDesignsService,
    AiModelRoutingService,
    StitchMcpService,
    OpenRouterInvitationAiProvider,
    { provide: INVITATION_AI_PROVIDER, useExisting: OpenRouterInvitationAiProvider },
  ],
  exports: [InvitationDesignsService, INVITATION_AI_PROVIDER, AiModelRoutingService],
})
export class InvitationDesignsModule {}
