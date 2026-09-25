import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ListNotificationsQueryDto,
  NotificationActionBodyDto,
} from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthPayload, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(user.sub, query.cursor, query.limit);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthPayload, @Body() _body: NotificationActionBodyDto) {
    return this.notifications.markAllRead(user.sub);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _body: NotificationActionBodyDto
  ) {
    return this.notifications.markRead(user.sub, id);
  }
}
