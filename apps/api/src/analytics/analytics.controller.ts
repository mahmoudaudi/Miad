import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { RecordViewDto } from './dto/record-view.dto';

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('public/invitations/:slug/view')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  recordView(@Param('slug') slug: string, @Body() dto: RecordViewDto) {
    return this.analytics.recordPublicView(slug, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invitations/:id/analytics')
  findForOwner(
    @CurrentUser() user: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.analytics.findForOwner(user.sub, id);
  }
}
