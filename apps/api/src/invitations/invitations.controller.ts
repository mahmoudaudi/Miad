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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { ListInvitationsQueryDto } from './dto/list-invitations-query.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { InvitationsService } from './invitations.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthPayload, @Query() query: ListInvitationsQueryDto) {
    return this.invitations.findAll(user.sub, query.eventId);
  }

  @Post()
  create(@CurrentUser() user: AuthPayload, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(user.sub, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invitations.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInvitationDto
  ) {
    return this.invitations.update(user.sub, id, dto);
  }

  @Patch(':id/publication')
  updatePublication(
    @CurrentUser() user: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePublicationDto
  ) {
    return this.invitations.updatePublication(user.sub, id, dto.published);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.invitations.remove(user.sub, id);
  }
}
