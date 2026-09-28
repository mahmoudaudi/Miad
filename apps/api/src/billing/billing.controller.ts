import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreditsService } from './credits.service';

@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly credits: CreditsService
  ) {}

  @Get('plans')
  listPlans() {
    return this.billing.listPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  currentSubscription(@CurrentUser() user: AuthPayload) {
    return this.billing.currentSubscription(user.sub);
  }

  /** Credit balance, lifetime grant total, and the derived amount consumed. */
  @UseGuards(JwtAuthGuard)
  @Get('credits')
  creditSummary(@CurrentUser() user: AuthPayload) {
    return this.credits.summary(user.sub);
  }

  /** Recent AI operations for the signed-in account only. */
  @UseGuards(JwtAuthGuard)
  @Get('credits/usage')
  creditUsage(
    @CurrentUser() user: AuthPayload,
    @Query('limit') limit?: string
  ) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.credits.recentUsage(user.sub, Number.isNaN(parsed) ? 20 : parsed);
  }
}
