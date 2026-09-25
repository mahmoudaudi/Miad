import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateRsvpDto } from './dto/create-rsvp.dto';
import { GuestsService } from './guests.service';

@Controller({ path: 'public/invitations', version: '1' })
export class PublicRsvpsController {
  constructor(private readonly guests: GuestsService) {}

  @Post(':slug/rsvp')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Param('slug') slug: string, @Body() dto: CreateRsvpDto) {
    return this.guests.createPublicRsvp(slug, dto);
  }
}
