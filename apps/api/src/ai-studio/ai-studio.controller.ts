import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiStudioService } from './ai-studio.service';
import { CreateAiStudioDto } from './dto/create-ai-studio.dto';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'ai-studio', version: '1' })
export class AiStudioController {
  constructor(private readonly studio: AiStudioService) {}

  @Post('generate')
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  generate(@CurrentUser() user: AuthPayload, @Body() dto: CreateAiStudioDto) {
    return this.studio.createFromPrompt(user.sub, dto.prompt);
  }
}
