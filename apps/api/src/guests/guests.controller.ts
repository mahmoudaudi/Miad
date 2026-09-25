import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'events/:eventId/guests', version: '1' })
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthPayload,
    @Param('eventId', new ParseUUIDPipe()) eventId: string
  ) {
    return this.guests.findAll(user.sub, eventId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthPayload,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: CreateGuestDto
  ) {
    return this.guests.create(user.sub, eventId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthPayload,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.guests.findOne(user.sub, eventId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGuestDto
  ) {
    return this.guests.update(user.sub, eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthPayload,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    await this.guests.remove(user.sub, eventId, id);
  }
}
