import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { INVITATION_AI_PROVIDER } from './ai-provider.types';
import { GroqInvitationAiProvider } from './groq-invitation-ai.provider';
import { InvitationDesignsController } from './invitation-designs.controller';
import { InvitationDesignsService } from './invitation-designs.service';
import { OpenAIInvitationAiProvider } from './openai-invitation-ai.provider';
import { PublicInvitationsController } from './public-invitations.controller';

@Module({
  imports: [AuthModule],
  controllers: [InvitationDesignsController, PublicInvitationsController],
  providers: [
    InvitationDesignsService,
    OpenAIInvitationAiProvider,
    GroqInvitationAiProvider,
    {
      provide: INVITATION_AI_PROVIDER,
      useFactory: (
        config: ConfigService,
        openai: OpenAIInvitationAiProvider,
        groq: GroqInvitationAiProvider
      ) => (config.get<string>('AI_PROVIDER') === 'groq' ? groq : openai),
      inject: [ConfigService, OpenAIInvitationAiProvider, GroqInvitationAiProvider],
    },
  ],
})
export class InvitationDesignsModule {}
