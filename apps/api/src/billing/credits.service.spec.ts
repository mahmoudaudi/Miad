import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CreditsService, InsufficientCreditsException } from './credits.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const INVITATION = '33333333-3333-4333-8333-333333333333';

/* eslint-disable @typescript-eslint/no-explicit-any */

type AccountRow = {
  id: string;
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
};

type LedgerRow = {
  id: string;
  creditAccountId: string;
  aiUsageId: string | null;
  idempotencyKey: string;
  entryType: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: Date;
};

type UsageRow = {
  id: string;
  userId: string;
  invitationId: string;
  operationType: string;
  status: string;
  idempotencyKey: string | null;
  creditsReserved: number;
  creditsCharged: number;
  creditsRefunded: number;
  provider: string | null;
  model: string | null;
  completedAt: Date | null;
  createdAt: Date;
};

/**
 * Stateful stand-in for the Prisma client that reproduces the two database
 * behaviours the credit path depends on: the conditional `balance >= credits`
 * update and the unique constraints on the idempotency keys.
 */
function createFakePrisma(seedBalances: Record<string, number> = {}) {
  const accounts = new Map<string, AccountRow>();
  const ledger = new Map<string, LedgerRow>();
  const usages = new Map<string, UsageRow>();
  const aiUsageRows: any[] = [];
  const ledgerMutations: string[] = [];
  let sequence = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

  for (const [userId, balance] of Object.entries(seedBalances)) {
    accounts.set(userId, {
      id: nextId(),
      userId,
      balance,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
    });

  // Each transaction keeps its own undo journal, so a rolled-back attempt only
  // reverses its own writes and never discards a concurrent committed debit.
  type Journal = {
    balances: Array<{ userId: string; before: number }>;
    usages: Array<{ key: string; before: UsageRow }>;
    createdAccounts: string[];
    createdLedger: string[];
    createdUsages: string[];
  };
  const journal = new AsyncLocalStorage<Journal>();
  const record = () => journal.getStore();

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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      accounts.set(row.userId, row);
      record()?.createdAccounts.push(row.userId);
      return { ...row };
    },
    async updateMany(args: any) {
      // Yield so concurrent callers interleave, then apply the guard against
      // the balance as it stands at mutation time, like a single UPDATE ... WHERE.
      await Promise.resolve();
      const row = accounts.get(args.where.userId);
      if (!row) return { count: 0 };
      const guard = args.where.balance?.gte;
      if (guard !== undefined && row.balance < guard) return { count: 0 };
      if (args.data.balance?.decrement !== undefined) {
        record()?.balances.push({ userId: row.userId, before: row.balance });
        row.balance -= args.data.balance.decrement;
      }
      return { count: 1 };
    },
    async findUnique(args: any) {
      const row = accounts.get(args.where.userId);
      return row ? { ...row } : null;
    },
    async findUniqueOrThrow(args: any) {
      const row = accounts.get(args.where.userId);
      if (!row) throw new NotFoundException('Credit account not found.');
      return { ...row };
    },
    async update(args: any) {
      const row = accounts.get(args.where.userId);
      if (!row) throw new NotFoundException('Credit account not found.');
      if (args.data.balance?.increment) {
        record()?.balances.push({ userId: row.userId, before: row.balance });
        row.balance += args.data.balance.increment;
      }
      return { ...row };
    },
  };

  const creditLedgerEntry = {
    async findUnique(args: any) {
      const row = ledger.get(args.where.idempotencyKey);
      if (!row) return null;
      // Ledger rows reference the account by id, while accounts are keyed by user.
      const owner = [...accounts.values()].find((account) => account.id === row.creditAccountId);
      return { ...row, creditAccount: { userId: owner?.userId ?? '' } };
    },
    async aggregate(args: any) {
      const ownerId = args.where?.creditAccount?.userId;
      const owner = ownerId
        ? [...accounts.values()].find((account) => account.userId === ownerId)
        : undefined;
      const total = [...ledger.values()]
        .filter((row) => row.entryType === args.where.entryType)
        .filter((row) => (owner ? row.creditAccountId === owner.id : true))
        .reduce((sum, row) => sum + row.amount, 0);
      return { _sum: { amount: total } };
    },
    async create(args: any) {
      const data = args.data;
      if (ledger.has(data.idempotencyKey)) throw uniqueViolation();
      const row: LedgerRow = {
        id: nextId(),
        creditAccountId: data.creditAccountId,
        aiUsageId: data.aiUsageId ?? null,
        idempotencyKey: data.idempotencyKey,
        entryType: data.entryType,
        amount: data.amount,
        balanceAfter: data.balanceAfter,
        reason: data.reason ?? null,
        createdAt: new Date(),
      };
      ledger.set(row.idempotencyKey, row);
      ledgerMutations.push('create');
      record()?.createdLedger.push(row.idempotencyKey);
      return { ...row };
    },
    async update() {
      ledgerMutations.push('update');
      throw new Error('credit_ledger_entries is append-only.');
    },
    async updateMany() {
      ledgerMutations.push('updateMany');
      throw new Error('credit_ledger_entries is append-only.');
    },
    async delete() {
      ledgerMutations.push('delete');
      throw new Error('credit_ledger_entries is append-only.');
    },
    async deleteMany() {
      ledgerMutations.push('deleteMany');
      throw new Error('credit_ledger_entries is append-only.');
    },
  };

  const aiUsage = {
    async findUnique(args: any) {
      const row = usages.get(args.where.idempotencyKey);
      return row ? { ...row } : null;
    },
    async findMany(args: any) {
      const userId = args.where?.userId;
      const take = args.take ?? aiUsageRows.length;
      return aiUsageRows
        .filter((row) => !userId || row.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, take)
        .map((row) => ({
          ...row,
          invitation: row.invitationId
            ? { id: row.invitationId, event: { title: `Event ${row.invitationId.slice(0, 4)}` } }
            : null,
        }));
    },
    async findUniqueOrThrow(args: any) {
      const row = [...usages.values()].find((usage) => usage.id === args.where.id);
      if (!row) throw new NotFoundException('AI usage not found.');
      return { ...row };
    },
    async create(args: any) {
      const data = args.data;
      if (data.idempotencyKey && usages.has(data.idempotencyKey)) throw uniqueViolation();
      const row: UsageRow = {
        id: nextId(),
        userId: data.userId,
        invitationId: data.invitationId,
        operationType: data.operationType,
        status: data.status ?? 'PENDING',
        idempotencyKey: data.idempotencyKey ?? null,
        creditsReserved: data.creditsReserved ?? 0,
        creditsCharged: 0,
        creditsRefunded: 0,
        provider: data.provider ?? null,
        model: data.model ?? null,
        completedAt: null,
        createdAt: new Date(),
      };
      usages.set(row.idempotencyKey as string, row);
      aiUsageRows.push(row);
      record()?.createdUsages.push(row.idempotencyKey as string);
      return { ...row };
    },
    async updateMany(args: any) {
      await Promise.resolve();
      const row = [...usages.values()].find((usage) => usage.id === args.where.id);
      if (!row) return { count: 0 };
      if (args.where.userId && row.userId !== args.where.userId) return { count: 0 };
      if (args.where.status && row.status !== args.where.status) return { count: 0 };
      const key = row.idempotencyKey as string;
      record()?.usages.push({ key, before: { ...row } });
      if (args.data.status !== undefined) row.status = args.data.status;
      if (args.data.creditsCharged !== undefined) row.creditsCharged = args.data.creditsCharged;
      if (args.data.creditsRefunded !== undefined) row.creditsRefunded = args.data.creditsRefunded;
      if (args.data.completedAt !== undefined) row.completedAt = args.data.completedAt;
      return { count: 1 };
    },
  };

  const prisma: any = {
    // Prisma rolls an interactive transaction back when the callback throws;
    // only that transaction's own writes are reversed.
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const log: Journal = {
        balances: [],
        usages: [],
        createdAccounts: [],
        createdLedger: [],
        createdUsages: [],
      };
      return journal.run(log, async () => {
        try {
          return await fn(prisma);
        } catch (error) {
          for (const entry of [...log.usages].reverse()) usages.set(entry.key, entry.before);
          for (const key of log.createdUsages) usages.delete(key);
          for (const key of log.createdLedger) ledger.delete(key);
          for (const { userId, before } of [...log.balances].reverse()) {
            const row = accounts.get(userId);
            if (row) row.balance = before;
          }
          for (const userId of log.createdAccounts) accounts.delete(userId);
          throw error;
        }
      });
    },
    creditAccount,
    creditLedgerEntry,
    aiUsage,
  };

  return { prisma, accounts, ledger, usages, aiUsageRows, ledgerMutations };
}

function serviceWith(fake: ReturnType<typeof createFakePrisma>) {
  return new CreditsService(fake.prisma as never);
}

const reservation = (overrides: Record<string, unknown> = {}) => ({
  userId: USER,
  invitationId: INVITATION,
  operationType: 'GENERATE_DESIGN',
  credits: 8,
  idempotencyKey: 'req-1',
  ...overrides,
});

describe('CreditsService balance protection', () => {
  it('debits the balance and records a matching RESERVATION ledger entry', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const result = await serviceWith(fake).reserve(reservation());

    expect(result).toMatchObject({
      idempotencyKey: 'req-1',
      status: 'PENDING',
      creditsReserved: 8,
      balance: 12,
      duplicate: false,
    });
    expect(fake.accounts.get(USER)?.balance).toBe(12);
    const entry = fake.ledger.get('reserve:req-1');
    expect(entry).toMatchObject({ entryType: 'RESERVATION', amount: -8, balanceAfter: 12 });
    expect(entry?.aiUsageId).toBe(result.usageId);
  });

  it('rejects an insufficient balance without writing usage or ledger rows', async () => {
    const fake = createFakePrisma({ [USER]: 3 });
    const service = serviceWith(fake);

    await expect(service.reserve(reservation())).rejects.toBeInstanceOf(InsufficientCreditsException);
    expect(fake.accounts.get(USER)?.balance).toBe(3);
    expect(fake.usages.size).toBe(0);
    expect(fake.ledger.size).toBe(0);
  });

  it('rejects a reservation when the account has never been granted credits', async () => {
    const fake = createFakePrisma();
    await expect(serviceWith(fake).reserve(reservation())).rejects.toBeInstanceOf(
      InsufficientCreditsException
    );
    expect(fake.usages.size).toBe(0);
  });

  it('never lets concurrent reservations overdraw the balance', async () => {
    const fake = createFakePrisma({ [USER]: 10 });
    const service = serviceWith(fake);

    const results = await Promise.allSettled([
      service.reserve(reservation({ idempotencyKey: 'req-a' })),
      service.reserve(reservation({ idempotencyKey: 'req-b' })),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsException);
    expect(fake.accounts.get(USER)?.balance).toBe(2);
    expect(fake.usages.size).toBe(1);
  });

  it('rejects non-positive and non-integer credit amounts', async () => {
    const service = serviceWith(createFakePrisma({ [USER]: 10 }));
    await expect(service.reserve(reservation({ credits: 0 }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reserve(reservation({ credits: -5 }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reserve(reservation({ credits: 1.5 }))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('requires a valid idempotency key and reservation details', async () => {
    const service = serviceWith(createFakePrisma({ [USER]: 10 }));
    await expect(service.reserve(reservation({ idempotencyKey: '' }))).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.reserve(reservation({ invitationId: '' }))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('CreditsService idempotency', () => {
  it('returns the original reservation for a duplicate request without double-charging', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);

    const first = await service.reserve(reservation());
    const second = await service.reserve(reservation());

    expect(second.duplicate).toBe(true);
    expect(second.usageId).toBe(first.usageId);
    expect(second.balance).toBe(12);
    expect(fake.accounts.get(USER)?.balance).toBe(12);
    expect(fake.usages.size).toBe(1);
    expect(fake.ledger.size).toBe(1);
  });

  it('rejects reuse of a reservation key with different parameters', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);

    await service.reserve(reservation());
    await expect(service.reserve(reservation({ credits: 4 }))).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(fake.accounts.get(USER)?.balance).toBe(12);
  });

  it('recovers from a concurrent insert race without double-debiting', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);

    await service.reserve(reservation({ idempotencyKey: 'race' }));
    // Model the pre-check racing past a row that committed a moment earlier:
    // only the first lookup misses, so the insert collides and the recovery
    // read (which must not be intercepted) finds the committed row.
    const original = fake.prisma.aiUsage.findUnique;
    let missedOnce = false;
    fake.prisma.aiUsage.findUnique = (async (args: any) => {
      if (!missedOnce && args?.where?.idempotencyKey === 'race') {
        missedOnce = true;
        return null;
      }
      return original(args);
    }) as never;

    const raced = await service.reserve(reservation({ idempotencyKey: 'race' }));

    expect(raced.duplicate).toBe(true);
    expect(fake.accounts.get(USER)?.balance).toBe(12);
    expect(fake.usages.size).toBe(1);
  });

  it('keeps grants idempotent and rejects a key reused for a different amount', async () => {
    const fake = createFakePrisma();
    const service = serviceWith(fake);

    const first = await service.grant({ userId: USER, credits: 10, idempotencyKey: 'grant-1' });
    const repeat = await service.grant({ userId: USER, credits: 10, idempotencyKey: 'grant-1' });

    expect(first).toEqual({ balance: 10, duplicate: false });
    expect(repeat).toEqual({ balance: 10, duplicate: true });
    expect(fake.accounts.get(USER)?.balance).toBe(10);
    expect(fake.ledger.get('grant:grant-1')).toMatchObject({ entryType: 'GRANT', amount: 10 });

    await expect(
      service.grant({ userId: USER, credits: 25, idempotencyKey: 'grant-1' })
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.grant({ userId: OTHER_USER, credits: 10, idempotencyKey: 'grant-1' })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fake.accounts.get(USER)?.balance).toBe(10);
  });});

describe('CreditsService settlement', () => {
  it('charges a reservation exactly once and reports the charged amount', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());

    const settled = await service.charge(USER, 'req-1');
    expect(settled).toMatchObject({
      status: 'SUCCEEDED',
      creditsReserved: 8,
      creditsCharged: 8,
      creditsRefunded: 0,
      balance: 12,
      duplicate: false,
    });

    const repeated = await service.charge(USER, 'req-1');
    expect(repeated.duplicate).toBe(true);
    expect(fake.accounts.get(USER)?.balance).toBe(12);
  });

  it('refunds a failed reservation and records a compensating REFUND entry', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());

    const refunded = await service.refund(USER, 'req-1', 'FAILED');
    expect(refunded).toMatchObject({
      status: 'FAILED',
      creditsCharged: 0,
      creditsRefunded: 8,
      balance: 20,
      duplicate: false,
    });
    expect(fake.accounts.get(USER)?.balance).toBe(20);
    expect(fake.ledger.get('refund:req-1')).toMatchObject({
      entryType: 'REFUND',
      amount: 8,
      balanceAfter: 20,
    });
  });

  it('is idempotent across repeated refunds and concurrent refunds', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());

    const concurrent = await Promise.all([
      service.refund(USER, 'req-1', 'FAILED'),
      service.refund(USER, 'req-1', 'FAILED'),
    ]);
    const serial = await service.refund(USER, 'req-1', 'FAILED');

    expect(fake.accounts.get(USER)?.balance).toBe(20);
    expect(fake.ledger.size).toBe(2);
    expect(concurrent.every((r) => r.balance === 20)).toBe(true);
    expect(serial.duplicate).toBe(true);
  });

  it('refuses to refund a reservation that was already charged', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());
    await service.charge(USER, 'req-1');

    await expect(service.refund(USER, 'req-1', 'FAILED')).rejects.toBeInstanceOf(ConflictException);
    expect(fake.accounts.get(USER)?.balance).toBe(12);
  });

  it('refuses to charge a reservation that was already refunded', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());
    await service.refund(USER, 'req-1', 'CANCELLED');

    await expect(service.charge(USER, 'req-1')).rejects.toBeInstanceOf(ConflictException);
    expect(fake.accounts.get(USER)?.balance).toBe(20);
  });

  it('hides another account’s reservation from settlement', async () => {
    const fake = createFakePrisma({ [USER]: 20, [OTHER_USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());

    await expect(service.charge(OTHER_USER, 'req-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.refund(OTHER_USER, 'req-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(fake.accounts.get(USER)?.balance).toBe(12);
    expect(fake.accounts.get(OTHER_USER)?.balance).toBe(20);
  });
});

describe('CreditsService ledger immutability', () => {
  it('only ever appends to the ledger across the full lifecycle', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());
    await service.charge(USER, 'req-1');
    await service.grant({ userId: USER, credits: 5, idempotencyKey: 'grant-2' });
    await service.reserve(reservation({ idempotencyKey: 'req-2' }));
    await service.refund(USER, 'req-2', 'FAILED');

    expect(new Set(fake.ledgerMutations)).toEqual(new Set(['create']));
    expect([...fake.ledger.values()].map((e) => e.entryType).sort()).toEqual([
      'GRANT',
      'REFUND',
      'RESERVATION',
      'RESERVATION',
    ]);
  });
});

describe('CreditsService read projections (Phase 3 billing UI)', () => {
  it('reports zeroes for an account that was never granted credits', async () => {
    const fake = createFakePrisma();
    await expect(serviceWith(fake).summary(USER)).resolves.toEqual({
      balance: 0,
      totalGranted: 0,
      used: 0,
    });
  });

  it('derives used credits from the ledger rather than a stored counter', async () => {
    const fake = createFakePrisma();
    const service = serviceWith(fake);
    await service.grant({ userId: USER, credits: 20, idempotencyKey: 'g1' });
    await service.reserve(reservation({ credits: 8 }));
    await service.charge(USER, 'req-1');
    await service.reserve(reservation({ credits: 5, idempotencyKey: 'req-2' }));
    await service.refund(USER, 'req-2');

    // 20 granted, 8 spent by the charged request; the refunded one cost nothing.
    await expect(service.summary(USER)).resolves.toEqual({
      balance: 12,
      totalGranted: 20,
      used: 8,
    });
  });

  it('returns recent usage newest first and scoped to one user', async () => {
    const fake = createFakePrisma({ [USER]: 20, [OTHER_USER]: 20 });
    fake.aiUsageRows.push(
      {
        id: 'u-old',
        userId: USER,
        invitationId: INVITATION,
        operationType: 'GENERATE_DESIGN',
        status: 'SUCCEEDED',
        creditsReserved: 8,
        creditsCharged: 1,
        creditsRefunded: 0,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        completedAt: new Date('2026-01-01T10:00:05.000Z'),
      },
      {
        id: 'u-new',
        userId: USER,
        invitationId: INVITATION,
        operationType: 'EDIT_DESIGN',
        status: 'SUCCEEDED',
        creditsReserved: 3,
        creditsCharged: 1,
        creditsRefunded: 0,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
        completedAt: new Date('2026-02-01T10:00:05.000Z'),
      },
      {
        id: 'other',
        userId: OTHER_USER,
        invitationId: INVITATION,
        operationType: 'GENERATE_DESIGN',
        status: 'SUCCEEDED',
        creditsReserved: 1,
        creditsCharged: 1,
        creditsRefunded: 0,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        completedAt: null,
      }
    );

    const rows = await serviceWith(fake).recentUsage(USER, 20);

    expect(rows.map((row) => row.id)).toEqual(['u-new', 'u-old']);
    expect(rows[0]).toMatchObject({
      operationType: 'EDIT_DESIGN',
      creditsConsumed: 1,
      createdAt: '2026-02-01T10:00:00.000Z',
    });
    expect((rows[0] as { invitationTitle: string | null }).invitationTitle).toBeTruthy();
  });

  it('reports a refunded operation as zero consumed', async () => {
    const fake = createFakePrisma({ [USER]: 20 });
    const service = serviceWith(fake);
    await service.reserve(reservation());
    await service.refund(USER, 'req-1', 'FAILED');
    fake.aiUsageRows.push({
      id: 'pending',
      userId: USER,
      invitationId: INVITATION,
      operationType: 'GENERATE_DESIGN',
      status: 'PENDING',
      creditsReserved: 5,
      creditsCharged: 0,
      creditsRefunded: 0,
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
      completedAt: null,
    });

    const rows = await service.recentUsage(USER, 20);
    const refunded = rows.find((row) => row.status === 'FAILED');
    const pending = rows.find((row) => row.status === 'PENDING');
    expect(refunded?.creditsConsumed).toBe(0);
    expect((refunded as { creditsRefunded: number }).creditsRefunded).toBe(8);
    expect(pending?.creditsConsumed).toBe(0);
  });

  it('returns an empty list for an account with no history', async () => {
    const fake = createFakePrisma({ [USER]: 10 });
    await expect(serviceWith(fake).recentUsage(USER, 20)).resolves.toEqual([]);
  });

  it('clamps the usage limit to a sane range', async () => {
    const fake = createFakePrisma({ [USER]: 10 });
    const service = serviceWith(fake);
    // Neither an absurd count nor a negative/NaN limit is forwarded verbatim.
    for (const limit of [0, -5, Number.NaN, 1e9]) {
      await expect(service.recentUsage(USER, limit)).resolves.toEqual([]);
    }
  });
});
