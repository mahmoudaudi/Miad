import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AiStudioModule } from './ai-studio/ai-studio.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommunityModule } from './community/community.module';
import { BillingModule } from './billing/billing.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { EventsModule } from './events/events.module';
import { GuestsModule } from './guests/guests.module';
import { HealthModule } from './health/health.module';
import { InvitationDesignsModule } from './invitation-designs/invitation-designs.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    AiStudioModule,
    AnalyticsModule,
    CommunityModule,
    BillingModule,
    EventsModule,
    GuestsModule,
    InvitationsModule,
    InvitationDesignsModule,
    MediaModule,
    NotificationsModule,
    TemplatesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
