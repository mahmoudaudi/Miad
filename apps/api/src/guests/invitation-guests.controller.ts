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
@Controller({ path: 'invitations/:invitationId/guests', version: '1' })
export class InvitationGuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) id: string
  ) {
    return this.guests.findAllForInvitation(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateGuestDto
  ) {
    return this.guests.createForInvitation(user.sub, id, dto);
  }

  @Get(':guestId')
  findOne(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) id: string,
    @Param('guestId', new ParseUUIDPipe()) guestId: string
  ) {
    return this.guests.findOneForInvitation(user.sub, id, guestId);
  }

  @Patch(':guestId')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) id: string,
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Body() dto: UpdateGuestDto
  ) {
    return this.guests.updateForInvitation(user.sub, id, guestId, dto);
  }

  @Delete(':guestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthPayload,
    @Param('invitationId', new ParseUUIDPipe()) id: string,
    @Param('guestId', new ParseUUIDPipe()) guestId: string
  ) {
    await this.guests.removeForInvitation(user.sub, id, guestId);
  }
}
