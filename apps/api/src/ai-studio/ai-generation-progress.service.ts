import { Injectable, NotFoundException } from '@nestjs/common';
import { ReplaySubject, type Observable } from 'rxjs';

export const AI_GENERATION_STAGES = [
  'REQUEST_RECEIVED',
  'ANALYZING_EVENT',
  'GENERATING_WEBSITE',
  'PARSING_RESPONSE',
  'VALIDATING_WEBSITE',
  'SAVING_WEBSITE',
  'COMPLETED',
] as const;

export type AiGenerationStage = (typeof AI_GENERATION_STAGES)[number];
export type AiGenerationProgress = {
  generationId: string;
  stage: AiGenerationStage;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  occurredAt: string;
  errorMessage?: string;
};

type ProgressRecord = {
  userId: string;
  stream: ReplaySubject<AiGenerationProgress>;
  terminalAt?: number;
  last?: AiGenerationProgress;
};

/** In-memory, per-user progress stream. It intentionally stores no prompt, project, or provider output. */
@Injectable()
export class AiGenerationProgressService {
  private readonly records = new Map<string, ProgressRecord>();

  observe(userId: string, generationId: string): Observable<AiGenerationProgress> {
    this.prune();
    const record = this.records.get(generationId);
    if (record && record.userId !== userId) throw new NotFoundException('Generation not found.');
    if (record) return record.stream.asObservable();
    const pending: ProgressRecord = { userId, stream: new ReplaySubject<AiGenerationProgress>(1) };
    this.records.set(generationId, pending);
    return pending.stream.asObservable();
  }

  begin(userId: string, generationId: string): void {
    this.emit(userId, generationId, 'REQUEST_RECEIVED', 'ACTIVE');
  }

  advance(
    userId: string,
    generationId: string,
    stage: Exclude<AiGenerationStage, 'COMPLETED'>
  ): void {
    this.emit(userId, generationId, stage, 'ACTIVE');
  }

  complete(userId: string, generationId: string): void {
    this.emit(userId, generationId, 'COMPLETED', 'COMPLETED');
  }

  fail(userId: string, generationId: string, errorMessage: string): void {
    const record = this.requireRecord(userId, generationId);
    const stage = record.last?.stage ?? 'REQUEST_RECEIVED';
    this.emit(userId, generationId, stage, 'FAILED', errorMessage);
  }

  private emit(
    userId: string,
    generationId: string,
    stage: AiGenerationStage,
    status: AiGenerationProgress['status'],
    errorMessage?: string
  ): void {
    const record = this.requireRecord(userId, generationId);
    const progress: AiGenerationProgress = {
      generationId,
      stage,
      status,
      occurredAt: new Date().toISOString(),
      ...(errorMessage ? { errorMessage } : {}),
    };
    record.last = progress;
    if (status !== 'ACTIVE') record.terminalAt = Date.now();
    record.stream.next(progress);
  }

  private requireRecord(userId: string, generationId: string): ProgressRecord {
    const existing = this.records.get(generationId);
    if (existing && existing.userId === userId) return existing;
    if (existing) throw new NotFoundException('Generation not found.');
    const record: ProgressRecord = { userId, stream: new ReplaySubject<AiGenerationProgress>(1) };
    this.records.set(generationId, record);
    return record;
  }

  private prune(): void {
    const oldestAllowed = Date.now() - 10 * 60_000;
    for (const [generationId, record] of this.records) {
      if (record.terminalAt && record.terminalAt < oldestAllowed) this.records.delete(generationId);
    }
  }
}
