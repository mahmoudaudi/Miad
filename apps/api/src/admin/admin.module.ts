import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { InvitationDesignsModule } from '../invitation-designs/invitation-designs.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { AdminAiTelemetryService } from './admin-ai-telemetry.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminCommunityService } from './admin-community.service';
import { AdminInvitationsService } from './admin-invitations.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, AnalyticsModule, InvitationsModule, InvitationDesignsModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminUsersService,
    AdminInvitationsService,
    AdminAiTelemetryService,
    AdminBillingService,
    AdminCommunityService,
    AdminAnalyticsService,
  ],
})
export class AdminModule {}
