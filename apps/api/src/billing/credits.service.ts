import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreditTerminalStatus = 'FAILED' | 'CANCELLED';

export type CreditGrantInput = {
  userId: string;
  credits: number;
  idempotencyKey: string;
  reason?: string;
};

export type CreditReservationInput = {
  userId: string;
  invitationId: string;
  operationType: string;
  credits: number;
  idempotencyKey: string;
  provider?: string;
  model?: string;
};

export type CreditReservationResult = {
  usageId: string;
  idempotencyKey: string;
  status: string;
  creditsReserved: number;
  balance: number;
  duplicate: boolean;
};

export type CreditSettlementResult = CreditReservationResult & {
  creditsCharged: number;
  creditsRefunded: number;
};

/** Returned when an atomic reservation cannot debit the requested amount. */
export class InsufficientCreditsException extends HttpException {
  constructor() {
    super('Insufficient credits.', HttpStatus.PAYMENT_REQUIRED);
  }
}

export type CreditSummary = {
  balance: number;
  totalGranted: number;
  used: number;
};

export type CreditUsageEntry = {
  id: string;
  operationType: string;
  status: string;
  creditsConsumed: number;
  creditsReserved: number;
  creditsRefunded: number;
  invitationId: string | null;
  invitationTitle: string | null;
  createdAt: string;
  completedAt: string | null;
};

/**
 * Phase 1 credit accounting. The account is the current balance projection;
 * append-only ledger rows are the financial source of truth.
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only balance projection for the billing screen.
   *
   * `totalGranted` is the sum of GRANT ledger entries, so `used` is derived
   * from the append-only history rather than a second stored counter that could
   * drift. An account that has never been granted reports zeroes.
   */
  async summary(userId: string): Promise<CreditSummary> {
    const [account, granted] = await Promise.all([
      this.prisma.creditAccount.findUnique({
        where: { userId },
        select: { balance: true },
      }),
      this.prisma.creditLedgerEntry.aggregate({
        where: { entryType: 'GRANT', creditAccount: { userId } },
        _sum: { amount: true },
      }),
    ]);
    const balance = account?.balance ?? 0;
    const totalGranted = granted._sum.amount ?? 0;
    return { balance, totalGranted, used: Math.max(0, totalGranted - balance) };
  }

  /**
   * Recent AI operations for one account, newest first. Scoped by `userId` so
   * a user can only ever read their own history. A reservation that was
   * refunded (failed or cancelled) is reported as zero consumed, because the
   * hold was returned in full.
   */
  async recentUsage(userId: string, limit = 20): Promise<CreditUsageEntry[]> {
    const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
    const rows = await this.prisma.aiUsage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        operationType: true,
        status: true,
        creditsReserved: true,
        creditsCharged: true,
        creditsRefunded: true,
        createdAt: true,
        completedAt: true,
        invitation: { select: { id: true, event: { select: { title: true } } } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      operationType: row.operationType,
      status: row.status,
      creditsConsumed: row.status === 'SUCCEEDED' ? row.creditsCharged : 0,
      creditsReserved: row.creditsReserved,
      creditsRefunded: row.creditsRefunded,
      invitationId: row.invitation?.id ?? null,
      invitationTitle: row.invitation?.event.title ?? null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  async grant(input: CreditGrantInput): Promise<{ balance: number; duplicate: boolean }> {
    this.validateMutation(input.credits, input.idempotencyKey);
    const ledgerKey = this.ledgerKey('grant', input.idempotencyKey);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.creditLedgerEntry.findUnique({
          where: { idempotencyKey: ledgerKey },
          select: {
            amount: true,
            balanceAfter: true,
            entryType: true,
            creditAccount: { select: { userId: true } },
          },
        });
        if (existing) return this.existingGrant(existing, input);

        const account = await tx.creditAccount.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId, balance: input.credits },
          update: { balance: { increment: input.credits } },
          select: { id: true, balance: true },
        });
        await tx.creditLedgerEntry.create({
          data: {
            creditAccountId: account.id,
            idempotencyKey: ledgerKey,
            entryType: 'GRANT',
            amount: input.credits,
            balanceAfter: account.balance,
            reason: input.reason?.trim() || null,
          },
          select: { id: true },
        });
        return { balance: account.balance, duplicate: false };
      });
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
      const existing = await this.prisma.creditLedgerEntry.findUnique({
        where: { idempotencyKey: ledgerKey },
        select: {
          amount: true,
          balanceAfter: true,
          entryType: true,
          creditAccount: { select: { userId: true } },
        },
      });
      if (!existing) throw error;
      return this.existingGrant(existing, input);
    }
  }

  async reserve(input: CreditReservationInput): Promise<CreditReservationResult> {
    this.validateReservation(input);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.aiUsage.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return this.existingReservation(tx, existing, input);

        await tx.creditAccount.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId, balance: 0 },
          update: {},
          select: { id: true },
        });
        const debit = await tx.creditAccount.updateMany({
          where: { userId: input.userId, balance: { gte: input.credits } },
          data: { balance: { decrement: input.credits } },
        });
        if (debit.count !== 1) throw new InsufficientCreditsException();

        const account = await tx.creditAccount.findUniqueOrThrow({
          where: { userId: input.userId },
          select: { id: true, balance: true },
        });
        const usage = await tx.aiUsage.create({
          data: {
            userId: input.userId,
            invitationId: input.invitationId,
            operationType: input.operationType,
            status: 'PENDING',
            idempotencyKey: input.idempotencyKey,
            creditsReserved: input.credits,
            provider: input.provider?.trim() || null,
            model: input.model?.trim() || null,
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            creditsReserved: true,
          },
        });
        await tx.creditLedgerEntry.create({
          data: {
            creditAccountId: account.id,
            aiUsageId: usage.id,
            idempotencyKey: this.ledgerKey('reserve', input.idempotencyKey),
            entryType: 'RESERVATION',
            amount: -input.credits,
            balanceAfter: account.balance,
            reason: input.operationType,
          },
          select: { id: true },
        });
        return {
          usageId: usage.id,
          idempotencyKey: usage.idempotencyKey as string,
          status: usage.status,
          creditsReserved: usage.creditsReserved,
          balance: account.balance,
          duplicate: false,
        };
      });
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
      const existing = await this.prisma.aiUsage.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (!existing) throw error;
      return this.existingReservation(this.prisma, existing, input);
    }
  }

  async charge(userId: string, idempotencyKey: string): Promise<CreditSettlementResult> {
    this.validateIdempotencyKey(idempotencyKey);
    return this.prisma.$transaction(async (tx) => {
      const usage = await tx.aiUsage.findUnique({ where: { idempotencyKey } });
      this.assertOwnedUsage(usage, userId);
      if (usage.status === 'SUCCEEDED') return this.settlement(tx, usage, true);
      if (usage.status !== 'PENDING') {
        throw new ConflictException('The credit reservation is already finalized.');
      }

      const completedAt = new Date();
      const transition = await tx.aiUsage.updateMany({
        where: { id: usage.id, userId, status: 'PENDING' },
        data: {
          status: 'SUCCEEDED',
          creditsCharged: usage.creditsReserved,
          completedAt,
        },
      });
      if (transition.count !== 1) {
        const current = await tx.aiUsage.findUniqueOrThrow({ where: { id: usage.id } });
        if (current.status === 'SUCCEEDED') return this.settlement(tx, current, true);
        throw new ConflictException('The credit reservation is already finalized.');
      }
      const charged = await tx.aiUsage.findUniqueOrThrow({ where: { id: usage.id } });
      return this.settlement(tx, charged, false);
    });
  }

  async refund(
    userId: string,
    idempotencyKey: string,
    status: CreditTerminalStatus = 'FAILED'
  ): Promise<CreditSettlementResult> {
    this.validateIdempotencyKey(idempotencyKey);
    return this.prisma.$transaction(async (tx) => {
      const usage = await tx.aiUsage.findUnique({ where: { idempotencyKey } });
      this.assertOwnedUsage(usage, userId);
      if (usage.status === status && usage.creditsRefunded === usage.creditsReserved) {
        return this.settlement(tx, usage, true);
      }
      if (usage.status !== 'PENDING') {
        throw new ConflictException('The credit reservation is already finalized.');
      }

      const transition = await tx.aiUsage.updateMany({
        where: { id: usage.id, userId, status: 'PENDING' },
        data: {
          status,
          creditsRefunded: usage.creditsReserved,
          completedAt: new Date(),
        },
      });
      if (transition.count !== 1) {
        const current = await tx.aiUsage.findUniqueOrThrow({ where: { id: usage.id } });
        if (current.status === status && current.creditsRefunded === current.creditsReserved) {
          return this.settlement(tx, current, true);
        }
        throw new ConflictException('The credit reservation is already finalized.');
      }

      const account = await tx.creditAccount.update({
        where: { userId },
        data: { balance: { increment: usage.creditsReserved } },
        select: { id: true, balance: true },
      });
      await tx.creditLedgerEntry.create({
        data: {
          creditAccountId: account.id,
          aiUsageId: usage.id,
          idempotencyKey: this.ledgerKey('refund', idempotencyKey),
          entryType: 'REFUND',
          amount: usage.creditsReserved,
          balanceAfter: account.balance,
          reason: status,
        },
        select: { id: true },
      });
      const refunded = await tx.aiUsage.findUniqueOrThrow({ where: { id: usage.id } });
      return this.toSettlement(refunded, account.balance, false);
    });
  }

  private validateReservation(input: CreditReservationInput): void {
    this.validateMutation(input.credits, input.idempotencyKey);
    if (!input.userId || !input.invitationId || !input.operationType.trim()) {
      throw new BadRequestException('Credit reservation details are required.');
    }
    if ((input.provider?.length ?? 0) > 50 || (input.model?.length ?? 0) > 120) {
      throw new BadRequestException('Credit reservation provider details are invalid.');
    }
  }

  private validateMutation(credits: number, idempotencyKey: string): void {
    this.validateIdempotencyKey(idempotencyKey);
    if (!Number.isSafeInteger(credits) || credits <= 0) {
      throw new BadRequestException('Credits must be a positive integer.');
    }
  }

  private validateIdempotencyKey(idempotencyKey: string): void {
    if (!idempotencyKey || idempotencyKey.length > 120) {
      throw new BadRequestException('A valid idempotency key is required.');
    }
  }

  private ledgerKey(kind: 'grant' | 'reserve' | 'refund', idempotencyKey: string): string {
    return `${kind}:${idempotencyKey}`;
  }

  private existingGrant(
    existing: {
      amount: number;
      balanceAfter: number;
      entryType: string;
      creditAccount: { userId: string };
    },
    input: CreditGrantInput
  ): { balance: number; duplicate: boolean } {
    if (
      existing.entryType !== 'GRANT' ||
      existing.creditAccount.userId !== input.userId ||
      existing.amount !== input.credits
    ) {
      throw new ConflictException('The idempotency key was already used for another credit grant.');
    }
    return { balance: existing.balanceAfter, duplicate: true };
  }

  private async existingReservation(
    client: Prisma.TransactionClient | PrismaService,
    usage: {
      id: string;
      userId: string;
      invitationId: string;
      operationType: string;
      status: string;
      idempotencyKey: string | null;
      creditsReserved: number;
    },
    input: CreditReservationInput
  ): Promise<CreditReservationResult> {
    if (
      usage.userId !== input.userId ||
      usage.invitationId !== input.invitationId ||
      usage.operationType !== input.operationType ||
      usage.creditsReserved !== input.credits
    ) {
      throw new ConflictException('The idempotency key was already used for another AI request.');
    }
    const account = await client.creditAccount.findUniqueOrThrow({
      where: { userId: input.userId },
      select: { balance: true },
    });
    return {
      usageId: usage.id,
      idempotencyKey: usage.idempotencyKey as string,
      status: usage.status,
      creditsReserved: usage.creditsReserved,
      balance: account.balance,
      duplicate: true,
    };
  }

  private assertOwnedUsage<T extends { userId: string }>(usage: T | null, userId: string): asserts usage is T {
    if (!usage || usage.userId !== userId) throw new NotFoundException('Credit reservation not found.');
  }

  private async settlement(
    client: Prisma.TransactionClient,
    usage: {
      id: string;
      idempotencyKey: string | null;
      status: string;
      creditsReserved: number;
      creditsCharged: number;
      creditsRefunded: number;
      userId: string;
    },
    duplicate: boolean
  ): Promise<CreditSettlementResult> {
    const account = await client.creditAccount.findUniqueOrThrow({
      where: { userId: usage.userId },
      select: { balance: true },
    });
    return this.toSettlement(usage, account.balance, duplicate);
  }

  private toSettlement(
    usage: {
      id: string;
      idempotencyKey: string | null;
      status: string;
      creditsReserved: number;
      creditsCharged: number;
      creditsRefunded: number;
    },
    balance: number,
    duplicate: boolean
  ): CreditSettlementResult {
    return {
      usageId: usage.id,
      idempotencyKey: usage.idempotencyKey as string,
      status: usage.status,
      creditsReserved: usage.creditsReserved,
      creditsCharged: usage.creditsCharged,
      creditsRefunded: usage.creditsRefunded,
      balance,
      duplicate,
    };
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
