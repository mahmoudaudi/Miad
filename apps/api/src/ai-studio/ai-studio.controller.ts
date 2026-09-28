import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiGenerationCancelledError } from '../invitation-designs/ai-provider.types';
import {
  AiStudioService,
  type AiStudioAnalyzeResponse,
  type AiStudioResponse,
} from './ai-studio.service';
import { AnalyzeAiStudioDto } from './dto/analyze-ai-studio.dto';
import { CreateAiStudioDto } from './dto/create-ai-studio.dto';
import { RefineAiStudioDto } from './dto/refine-ai-studio.dto';
import {
  AiGenerationProgressService,
  type AiGenerationProgress,
} from './ai-generation-progress.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: ['ai-studio', 'ai'], version: '1' })
export class AiStudioController {
  constructor(
    private readonly studio: AiStudioService,
    private readonly progress: AiGenerationProgressService
  ) {}

  @Get('models')
  models() {
    return this.studio.getAiModels();
  }

  @Sse('generation-progress/:generationId')
  progressStream(
    @CurrentUser() user: AuthPayload,
    @Param('generationId', new ParseUUIDPipe()) generationId: string
  ): Observable<{ data: AiGenerationProgress; type: 'progress' }> {
    return new Observable((subscriber) => {
      const subscription = this.progress.observe(user.sub, generationId).subscribe({
        next: (data) => subscriber.next({ data, type: 'progress' }),
        error: (error: unknown) => subscriber.error(error),
      });
      return () => subscription.unsubscribe();
    });
  }

  /**
   * Smart Question Flow analysis. Runs before website generation: it decides
   * whether the prompt plus the gathered answers are already sufficient and, if
   * not, returns exactly one next question. Creates nothing and touches no
   * generation progress stream.
   */
  @Post('analyze')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async analyze(
    @CurrentUser() _user: AuthPayload,
    @Body() dto: AnalyzeAiStudioDto,
    @Req() req: Request
  ): Promise<AiStudioAnalyzeResponse | undefined> {
    const controller = new AbortController();
    const res = req.res;
    const onClose = () => {
      if (!res || !res.writableEnded) controller.abort();
    };
    res?.on('close', onClose);
    try {
      return await this.studio.analyze(dto, controller.signal);
    } catch (error) {
      if (
        error instanceof AiGenerationCancelledError &&
        (!res || res.writableEnded || res.destroyed)
      ) {
        return undefined;
      }
      throw error;
    } finally {
      res?.removeListener('close', onClose);
    }
  }

  @Post('generate')
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  async generate(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateAiStudioDto,
    @Req() req: Request
  ): Promise<AiStudioResponse | undefined> {
    // Real cancellation, scoped to this request only: when the client
    // disconnects (STOP button aborts its fetch), abort the provider call so
    // no design is generated or persisted afterwards.
    const controller = new AbortController();
    const res = req.res;
    const onClose = () => {
      if (!res || !res.writableEnded) controller.abort();
    };
    res?.on('close', onClose);
    try {
      return await this.studio.createFromPrompt(
        user.sub,
        dto.prompt,
        dto.generationId,
        controller.signal,
        dto.modelPreference ?? 'auto',
        dto.idempotencyKey,
        ...(dto.imageIds ? [dto.imageIds] : [])
      );
    } catch (error) {
      // A routine user cancellation with nobody left to answer: swallowing
      // avoids an Express write-after-end stack for a non-error.
      if (
        error instanceof AiGenerationCancelledError &&
        (!res || res.writableEnded || res.destroyed)
      ) {
        return undefined;
      }
      throw error;
    } finally {
      res?.removeListener('close', onClose);
    }
  }

  @Post('refine')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  async refine(
    @CurrentUser() user: AuthPayload,
    @Body() dto: RefineAiStudioDto,
    @Req() req: Request
  ) {
    const controller = new AbortController();
    const res = req.res;
    const onClose = () => {
      if (!res || !res.writableEnded) controller.abort();
    };
    res?.on('close', onClose);
    try {
      return await this.studio.refineGeneratedWebsite(
        user.sub,
        dto.invitationId,
        dto.prompt,
        controller.signal,
        dto.generationId,
        dto.modelPreference ?? 'auto',
        dto.idempotencyKey,
        ...(dto.imageIds ? [dto.imageIds] : [])
      );
    } catch (error) {
      if (
        error instanceof AiGenerationCancelledError &&
        (!res || res.writableEnded || res.destroyed)
      ) {
        return undefined;
      }
      throw error;
    } finally {
      res?.removeListener('close', onClose);
    }
  }
}
