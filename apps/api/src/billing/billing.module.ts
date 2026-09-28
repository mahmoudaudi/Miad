import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiCreditsGuard } from './ai-credits.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CreditsModule } from './credits.module';

@Module({
  imports: [AuthModule, PrismaModule, CreditsModule],
  controllers: [BillingController],
  providers: [BillingService, AiCreditsGuard],
  // Re-export the module so consumers get CreditsService and FreeCreditsService
  // from the same instance the billing area uses.
  exports: [CreditsModule, AiCreditsGuard],
})
export class BillingModule {}
