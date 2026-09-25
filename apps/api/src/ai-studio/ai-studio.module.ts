import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationDesignsModule } from '../invitation-designs/invitation-designs.module';
import { AiStudioController } from './ai-studio.controller';
import { AiStudioService } from './ai-studio.service';

@Module({
  imports: [AuthModule, InvitationDesignsModule],
  controllers: [AiStudioController],
  providers: [AiStudioService],
})
export class AiStudioModule {}
