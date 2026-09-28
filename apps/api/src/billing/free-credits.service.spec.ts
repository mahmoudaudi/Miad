import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CreditsService } from './credits.service';
import { DEFAULT_FREE_CREDITS, FreeCreditsService } from './free-credits.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const USER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';

type AccountRow = { id: string; userId: string; balance: number };
type LedgerRow = {
  id: string;
  creditAccountId: string;
  idempotencyKey: string;
  entryType: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
};

/**
 * Minimal stateful Prisma stand-in for the credit tables only. It reproduces
 * the two guarantees the grant depends on: the unique idempotency key on the
 * ledger and the interactive transaction rollback.
 */
function createFakePrisma() {
  const accounts = new Map<string, AccountRow>();
  const ledger = new Map<string, LedgerRow>();
  let sequence = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

  type Journal = {
    balances: Array<{ userId: string; before: number }>;
    createdAccounts: string[];
    createdLedger: string[];
  };
  const journal = new AsyncLocalStorage<Journal>();
  const record = () => journal.getStore();
  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
    });

  const creditAccount = {
    async upsert(args: any) {
      const existing = accounts.get(args.where.userId);
      if (existing) {
        if (args.update?.balance?.increment) {
          record()?.balances.push({ userId: existing.userId, before: existing.balance });
          existing.balance += args.update.balance.increment;
        }
        return { ...existing };
      }
      const row: AccountRow = {
        id: nextId(),
        userId: args.where.userId,
        balance: args.create.balance,
      };
      accounts.set(row.userId, row);
      record()?.createdAccounts.push(row.userId);
      return { ...row };
    },
    async findUniqueOrThrow(args: any) {
      const row = accounts.get(args.where.userId);
      if (!row) throw new NotFoundException('Credit account not found.');
      return { ...row };
    },
  };

  const creditLedgerEntry = {
    async findUnique(args: any) {
      const row = ledger.get(args.where.idempotencyKey);
      if (!row) return null;
      const owner = [...accounts.values()].find((a) => a.id === row.creditAccountId);
      return { ...row, creditAccount: { userId: owner?.userId ?? '' } };
    },
    async create(args: any) {
      const d = args.data;
      if (ledger.has(d.idempotencyKey)) throw uniqueViolation();
      const row: LedgerRow = {
        id: nextId(),
        creditAccountId: d.creditAccountId,
        idempotencyKey: d.idempotencyKey,
        entryType: d.entryType,
        amount: d.amount,
        balanceAfter: d.balanceAfter,
        reason: d.reason ?? null,
      };
      ledger.set(row.idempotencyKey, row);
      record()?.createdLedger.push(row.idempotencyKey);
      return { ...row };
    },
  };

  // A real unique-index conflict blocks competing writers until the first
  // transaction commits, so transactions are serialized here rather than
  // interleaved. The grant relies on that key, not on read-modify-write timing.
  let queue: Promise<unknown> = Promise.resolve();

  const prisma: any = {
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const run = queue.then(async () => {
        const log: Journal = { balances: [], createdAccounts: [], createdLedger: [] };
        return journal.run(log, async () => {
          try {
            return await fn(prisma);
          } catch (error) {
            for (const key of log.createdLedger) ledger.delete(key);
            for (const { userId, before } of [...log.balances].reverse()) {
              const row = accounts.get(userId);
              if (row) row.balance = before;
            }
            for (const id of log.createdAccounts) accounts.delete(id);
            throw error;
          }
        });
      });
      queue = run.catch(() => undefined);
      return run;
    },
    creditAccount,
    creditLedgerEntry,
  };

  return { prisma, accounts, ledger };
}

function build() {
  const fake = createFakePrisma();
  const credits = new CreditsService(fake.prisma as never);
  return { ...fake, service: new FreeCreditsService(credits, undefined) };
}

describe('FreeCreditsService', () => {
  it('defaults to 10 credits and honours a configured amount', () => {
    const { service } = build();
    expect(service.amount()).toBe(DEFAULT_FREE_CREDITS);
    expect(service.amount()).toBe(10);

    const configured = new FreeCreditsService({} as never, { get: () => 25 } as never);
    expect(configured.amount()).toBe(25);

    // A nonsense value falls back to the default rather than granting nothing.
    const broken = new FreeCreditsService({} as never, { get: () => 'abc' } as never);
    expect(broken.amount()).toBe(10);
  });

  it('grants 10 credits to a new normal user and records a GRANT entry', async () => {
    const f = build();

    const result = await f.service.grantFreeCredits(USER, 'user');

    expect(result).toEqual({ granted: true, balance: 10 });
    expect(f.accounts.get(USER)?.balance).toBe(10);
    expect(f.ledger.size).toBe(1);
    const entry = f.ledger.get(`grant:free-credits:${USER}`);
    expect(entry).toMatchObject({
      entryType: 'GRANT',
      amount: 10,
      balanceAfter: 10,
      reason: 'Free plan welcome credits',
    });
  });

  it('never grants credits to an admin', async () => {
    const f = build();

    const result = await f.service.grantFreeCredits(ADMIN, 'admin');

    expect(result).toEqual({ granted: false, balance: 0 });
    expect(f.accounts.has(ADMIN)).toBe(false);
    expect(f.ledger.size).toBe(0);
  });

  it('does not grant the same user twice', async () => {
    const f = build();

    const first = await f.service.grantFreeCredits(USER, 'user');
    const second = await f.service.grantFreeCredits(USER, 'user');
    const third = await f.service.grantFreeCredits(USER, 'user');

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect(third.granted).toBe(false);
    // Still 10, not 30: the balance never moved again.
    expect(f.accounts.get(USER)?.balance).toBe(10);
    expect(f.ledger.size).toBe(1);
  });

  it('survives concurrent grant attempts for the same user', async () => {
    const f = build();

    const results = await Promise.all([
      f.service.grantFreeCredits(USER, 'user'),
      f.service.grantFreeCredits(USER, 'user'),
      f.service.grantFreeCredits(USER, 'user'),
    ]);

    expect(results.filter((r) => r.granted)).toHaveLength(1);
    expect(f.accounts.get(USER)?.balance).toBe(10);
    expect(f.ledger.size).toBe(1);
  });

  it('provisions a user that has no credit account exactly once', async () => {
    const f = build();
    // Simulates the backfill candidate: a pre-existing account row in the DB.
    expect(f.accounts.has(USER)).toBe(false);

    const first = await f.service.grantFreeCredits(USER, 'user');
    expect(first).toEqual({ granted: true, balance: 10 });

    const second = await f.service.grantFreeCredits(USER, 'user');
    expect(second.granted).toBe(false);
    expect(f.accounts.get(USER)?.balance).toBe(10);
    expect(f.ledger.size).toBe(1);
  });

  it('keeps a balance that already exists instead of resetting it', async () => {
    const f = build();
    f.accounts.set(USER, { id: 'existing-account', userId: USER, balance: 42 });

    const result = await f.service.grantFreeCredits(USER, 'user');

    expect(result.granted).toBe(true);
    // Incremented, not replaced: a user who already spent credits is not reset.
    expect(f.accounts.get(USER)?.balance).toBe(52);
  });

  it('does not throw when the grant fails, so registration is never blocked', async () => {
    const failing = new FreeCreditsService(
      {
        grant: async () => {
          throw new Error('database unavailable');
        },
      } as never,
      undefined
    );

    await expect(failing.grantFreeCreditsSafely(USER, 'user')).resolves.toBeUndefined();
  });

  it('uses a per-user idempotency key so keys are never shared', () => {
    const { service } = build();
    expect(service.idempotencyKey(USER)).toBe(`free-credits:${USER}`);
    expect(service.idempotencyKey(USER)).not.toBe(service.idempotencyKey(ADMIN));
  });
});
