import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from './credits.service';

/**
 * Phase 2.5: the Free plan welcome grant.
 *
 * Purpose is manual testing only: a normal account must be able to try an AI
 * generation without a payment provider. It deliberately:
 *   - grants nothing to admin accounts (they never consume credits),
 *   - derives its idempotency key from the user id, so a user can never be
 *     granted twice no matter how often this runs,
 *   - writes through the existing Phase 1 ledger (GRANT entry + balance), so
 *     the money trail is the same one reservations and charges use.
 *
 * No subscriptions, no payments, no plan upgrades.
 */
export const DEFAULT_FREE_CREDITS = 10;
export const ADMIN_ROLE = 'admin';
export const FREE_CREDITS_REASON = 'Free plan welcome credits';

@Injectable()
export class FreeCreditsService {
  private readonly logger = new Logger(FreeCreditsService.name);

  constructor(
    private readonly credits: CreditsService,
    private readonly config?: ConfigService
  ) {}

  amount(): number {
    const configured =
      this.config?.get<number>('freeCreditsAmount') ?? this.config?.get<string>('FREE_CREDITS_AMOUNT');
    const parsed = typeof configured === 'string' ? Number.parseInt(configured, 10) : configured;
    return typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_FREE_CREDITS;
  }

  /**
   * Deterministic per user. The Phase 1 ledger has a unique constraint on this
   * key, which is what makes "grant exactly once" a database guarantee rather
   * than a convention.
   */
  idempotencyKey(userId: string): string {
    return `free-credits:${userId}`;
  }

  /** Admins do not need credits, so they are never granted any. */
  isEligible(role: string | null | undefined): boolean {
    return role !== ADMIN_ROLE;
  }

  async grantFreeCredits(
    userId: string,
    role: string | null | undefined
  ): Promise<{ granted: boolean; balance: number }> {
    if (!this.isEligible(role)) return { granted: false, balance: 0 };
    const result = await this.credits.grant({
      userId,
      credits: this.amount(),
      idempotencyKey: this.idempotencyKey(userId),
      reason: FREE_CREDITS_REASON,
    });
    return { granted: !result.duplicate, balance: result.balance };
  }

  /**
   * Registration and sign-in must never fail because of a billing problem, so
   * this swallows (and logs) grant errors. A user who misses the grant can be
   * provisioned later by re-running the idempotent backfill.
   */
  async grantFreeCreditsSafely(userId: string, role: string | null | undefined): Promise<void> {
    try {
      await this.grantFreeCredits(userId, role);
    } catch (error) {
      this.logger.error(
        `Free credits grant failed for ${userId}: ${error instanceof Error ? error.name : typeof error}`
      );
    }
  }
}
