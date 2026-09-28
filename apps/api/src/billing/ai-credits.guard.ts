import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from './credits.service';

/**
 * Phase 2 bridge between the AI flows and the Phase 1 credit ledger.
 *
 * Only two operations ever cost credits:
 *   - GENERATE_DESIGN: generating a new invitation design
 *   - EDIT_DESIGN: an AI edit/regeneration of the current design
 *
 * Everything else in the product (Smart Questions, manual design editing,
 * image uploads, publishing) is deliberately free and must not route through
 * this guard.
 *
 * The lifecycle is always: reserve -> perform the AI work -> charge on
 * success, or refund on any failure/cancellation. A reservation is a hold, so
 * a failed provider call, a thrown validation error, or a client cancellation
 * all return the credits to the balance.
 */
export const AI_CREDIT_OPERATION = {
  GENERATE: 'GENERATE_DESIGN',
  EDIT: 'EDIT_DESIGN',
} as const;

export type AiCreditOperation = (typeof AI_CREDIT_OPERATION)[keyof typeof AI_CREDIT_OPERATION];

export type AiCreditReservation = {
  userId: string;
  invitationId: string;
  operationType: AiCreditOperation;
  /** Stable across client retries of the same logical request. */
  idempotencyKey: string;
  provider?: string;
  model?: string;
};

@Injectable()
export class AiCreditsGuard {
  private readonly logger = new Logger(AiCreditsGuard.name);

  constructor(
    private readonly credits: CreditsService,
    private readonly config?: ConfigService
  ) {}

  /**
   * Credits held for one operation. Reserved before the provider is called so
   * an over-budget request never reaches Stitch or the AI provider.
   */
  reserve(input: AiCreditReservation): Promise<unknown> {
    return this.credits.reserve({ ...input, credits: this.costFor(input.operationType) });
  }

  /** Converts the hold into a real charge. Only call after the work succeeded. */
  charge(userId: string, idempotencyKey: string): Promise<unknown> {
    return this.credits.charge(userId, idempotencyKey);
  }

  /**
   * Releases a hold. Never throws: a failed refund must not mask the original
   * provider/validation error that triggered it.
   */
  async refundAfterFailure(
    userId: string,
    idempotencyKey: string,
    options: { cancellation: boolean }
  ): Promise<void> {
    try {
      await this.credits.refund(userId, idempotencyKey, options.cancellation ? 'CANCELLED' : 'FAILED');
    } catch (error) {
      this.logger.error(
        `Credit refund failed for ${idempotencyKey}: ${error instanceof Error ? error.name : typeof error}`
      );
    }
  }

  costFor(operationType: AiCreditOperation): number {
    const configured =
      operationType === AI_CREDIT_OPERATION.EDIT
        ? this.config?.get<number>('aiCreditCostEdit') ??
          this.config?.get<string>('AI_CREDIT_COST_EDIT')
        : this.config?.get<number>('aiCreditCostGeneration') ??
          this.config?.get<string>('AI_CREDIT_COST_GENERATION');
    const parsed = typeof configured === 'string' ? Number.parseInt(configured, 10) : configured;
    return typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  }
}
