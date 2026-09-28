import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsService } from './credits.service';
import { FreeCreditsService } from './free-credits.service';

/**
 * Credit accounting without any auth dependency.
 *
 * Kept separate from BillingModule on purpose: BillingModule imports
 * AuthModule for its routes, so AuthModule cannot import BillingModule back
 * without a circular dependency. This module only needs Prisma, which lets both
 * the billing area and the auth flow reach the same CreditsService instance.
 */
@Module({
  imports: [PrismaModule],
  providers: [CreditsService, FreeCreditsService],
  exports: [CreditsService, FreeCreditsService],
})
export class CreditsModule {}
