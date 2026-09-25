import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { PublicRsvpsController } from './public-rsvps.controller';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [GuestsController, PublicRsvpsController],
  providers: [GuestsService],
})
export class GuestsModule {}
