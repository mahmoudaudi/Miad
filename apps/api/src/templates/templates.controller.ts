import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TemplatesService } from './templates.service';

@Controller({ path: 'templates', version: '1' })
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  list() {
    return this.templates.list();
  }
}
