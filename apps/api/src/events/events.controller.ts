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
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthPayload) {
    return this.events.findAll(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthPayload, @Body() dto: CreateEventDto) {
    return this.events.create(user.sub, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.events.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventDto
  ) {
    return this.events.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.events.remove(user.sub, id);
  }
}
