import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AiCreditsGuard } from '../billing/ai-credits.guard';
import { CreditsService, InsufficientCreditsException } from '../billing/credits.service';
import { InvitationAiProviderError } from './ai-provider.types';
import { InvitationDesignsService } from './invitation-designs.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const INVITATION = '33333333-3333-4333-8333-333333333333';
const PROMPT = 'Create an elegant birthday invitation website';
const INSTRUCTION = 'Make the typography more elegant';

type AccountRow = { id: string; userId: string; balance: number };
type LedgerRow = {
  id: string;
  creditAccountId: string;
  aiUsageId: string | null;
  idempotencyKey: string;
  entryType: string;
  amount: number;
  balanceAfter: number;
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
  completedAt: Date | null;
};
/** The single credit reservation row a scenario is expected to have created. */
function onlyUsage(usages: Map<string, UsageRow>): UsageRow {
  const rows = [...usages.values()];
  const row = rows[0] as UsageRow | undefined;
  if (rows.length !== 1 || !row) {
    throw new Error(`expected exactly one credit reservation, got ${rows.length}`);
  }
  return row;
}

type DesignRow = {
  id: string;
  invitationId: string;
  version: number;
  designSpecification: any;
  sourceType: string;
  isActive: boolean;
  createdAt: Date;
};

const EVENT = {
  title: 'Birthday',
  eventType: 'Birthday',
  description: PROMPT,
  eventDate: new Date('2026-10-01T00:00:00.000Z'),
  startTime: null,
  endTime: null,
  venueName: 'Cairo',
  venueAddress: null,
};

const STITCH_ARTIFACT = {
  title: 'Birthday invite',
  description: 'An elegant invitation',
  body: '<main><h1>You are invited</h1></main>',
  css: 'body{margin:0}',
};

const EDITED_ARTIFACT = {
  title: 'Birthday invite',
  description: 'An elegant invitation',
  body: '<main><h1>You are warmly invited</h1></main>',
  css: 'body{margin:0;font-family:serif}',
};

const HTML_ENVELOPE = (body: string, css: string) => ({
  title: 'Birthday invite',
  description: 'An elegant invitation',
  body,
  css,
  format: 'html',
  version: 1,
  stitch: { projectId: 'project-1', screenId: 'screen-1' },
});

/** Structured (non-HTML) design used by the generateWithAi/refineWithAi paths. */
const STRUCTURED_SPEC = {
  theme: 'classic',
  content: {
    title: 'Garden Dinner',
    eyebrow: 'You are invited',
    dateLine: 'December 12, 2026',
    venueLine: 'The Garden Room',
  },
  colors: { background: '#FFFFFF', surface: '#FAFAFA', text: '#111111', accent: '#7D1128' },
  typography: { headingFamily: 'Inter', bodyFamily: 'Inter' },
  layout: { alignment: 'left', density: 'comfortable' },
  sections: [
    { id: 'story', type: 'story', title: 'Story', body: 'A polished note.', order: 1, visible: true },
  ],
  elements: [{ id: 'title', type: 'title', label: 'Garden Dinner', order: 0, visible: true }],
};

const GENERATED_SPEC = {
  design: {
    title: 'Garden Dinner',
    sections: [{ heading: 'Welcome', text: 'Join us for a wonderful evening together' }],
  },
};

/**
 * Stateful Prisma stand-in covering both the design tables and the Phase 1
 * credit tables, so the AI credit lifecycle is exercised end to end.
 */
function createFakePrisma(options: { balance?: number; userId?: string } = {}) {
  const userId = options.userId ?? USER;
  const accounts = new Map<string, AccountRow>();
  const ledger = new Map<string, LedgerRow>();
  const usages = new Map<string, UsageRow>();
  const designs: DesignRow[] = [];
  const usageRows: Array<Record<string, any>> = [];
  const stitchCalls: string[] = [];
  let sequence = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

  accounts.set(userId, { id: nextId(), userId, balance: options.balance ?? 0 });

  type Journal = {
    balances: Array<{ userId: string; before: number }>;
    usages: Array<{ key: string; before: UsageRow }>;
    createdAccounts: string[];
    createdLedger: string[];
    createdUsages: string[];
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
    async updateMany(args: any) {
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
      const owner = [...accounts.values()].find((a) => a.id === row.creditAccountId);
      return { ...row, creditAccount: { userId: owner?.userId ?? '' } };
    },
    async create(args: any) {
      const d = args.data;
      if (ledger.has(d.idempotencyKey)) throw uniqueViolation();
      const row: LedgerRow = {
        id: nextId(),
        creditAccountId: d.creditAccountId,
        aiUsageId: d.aiUsageId ?? null,
        idempotencyKey: d.idempotencyKey,
        entryType: d.entryType,
        amount: d.amount,
        balanceAfter: d.balanceAfter,
      };
      ledger.set(row.idempotencyKey, row);
      record()?.createdLedger.push(row.idempotencyKey);
      return { ...row };
    },
    async update() {
      throw new Error('credit_ledger_entries is append-only.');
    },
    async delete() {
      throw new Error('credit_ledger_entries is append-only.');
    },
  };

  const aiUsage = {
    async findUnique(args: any) {
      const row = usages.get(args.where.idempotencyKey);
      return row ? { ...row } : null;
    },
    async findUniqueOrThrow(args: any) {
      const row = [...usages.values()].find((u) => u.id === args.where.id);
      if (!row) throw new NotFoundException('AI usage not found.');
      return { ...row };
    },
    async create(args: any) {
      const d = args.data;
      if (d.idempotencyKey && usages.has(d.idempotencyKey)) throw uniqueViolation();
      if (!d.idempotencyKey) {
        // Telemetry row written by the design service (no credit semantics).
        usageRows.push({ ...d });
        return { id: nextId() };
      }
      const key = d.idempotencyKey as string;
      const row: UsageRow = {
        id: nextId(),
        userId: d.userId,
        invitationId: d.invitationId,
        operationType: d.operationType,
        status: d.status ?? 'PENDING',
        idempotencyKey: key,
        creditsReserved: d.creditsReserved ?? 0,
        creditsCharged: 0,
        creditsRefunded: 0,
        completedAt: null,
      };
      usages.set(key, row);
      record()?.createdUsages.push(key);
      return { ...row };
    },
    async updateMany(args: any) {
      await Promise.resolve();
      const row = [...usages.values()].find((u) => u.id === args.where.id);
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

  const invitation = {
    async findFirst(args: any) {
      if (args.where.id !== INVITATION) return null;
      if (args.where.event?.userId && args.where.event.userId !== userId) return null;
      return {
        id: INVITATION,
        event: { ...EVENT },
        designs: designs
          .filter((d) => d.invitationId === INVITATION)
          .sort((a, b) => b.version - a.version),
      };
    },
  };

  const invitationDesign = {
    async updateMany() {
      for (const d of designs) d.isActive = false;
      return { count: 1 };
    },
    async create(args: any) {
      const row: DesignRow = {
        id: nextId(),
        invitationId: args.data.invitationId,
        version: args.data.version,
        designSpecification: args.data.designSpecification,
        sourceType: args.data.sourceType,
        isActive: args.data.isActive,
        createdAt: new Date(),
      };
      designs.push(row);
      return { ...row };
    },
  };

  const prisma: any = {
    // Supports both Prisma forms used by the code under test: the array form
    // for design persistence and the interactive form for credit settlement.
    $transaction: async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      const log: Journal = {
        balances: [],
        usages: [],
        createdAccounts: [],
        createdLedger: [],
        createdUsages: [],
      };
      return journal.run(log, async () => {
        try {
          return await arg(prisma);
        } catch (error) {
          for (const entry of [...log.usages].reverse()) usages.set(entry.key, entry.before);
          for (const key of log.createdUsages) usages.delete(key);
          for (const key of log.createdLedger) ledger.delete(key);
          for (const { userId: id, before } of [...log.balances].reverse()) {
            const row = accounts.get(id);
            if (row) row.balance = before;
          }
          for (const id of log.createdAccounts) accounts.delete(id);
          throw error;
        }
      });
    },
    invitation,
    invitationDesign,
    aiUsage,
    creditAccount,
    creditLedgerEntry,
  };

  const seedDesign = (body: string, css: string, version = 1) => {
    designs.push({
      id: nextId(),
      invitationId: INVITATION,
      version,
      designSpecification: HTML_ENVELOPE(body, css),
      sourceType: 'STITCH_GENERATED',
      isActive: true,
      createdAt: new Date(),
    });
  };

  const seedStructuredDesign = (version = 1) => {
    designs.push({
      id: nextId(),
      invitationId: INVITATION,
      version,
      designSpecification: STRUCTURED_SPEC,
      sourceType: 'MANUAL',
      isActive: true,
      createdAt: new Date(),
    });
  };

  return {
    prisma,
    accounts,
    ledger,
    usages,
    designs,
    usageRows,
    stitchCalls,
    seedDesign,
    seedStructuredDesign,
    userId,
  };
}

type Harness = ReturnType<typeof createFakePrisma> & {
  service: InvitationDesignsService;
  credits: CreditsService;
  balance: () => number;
  ledgerTypes: () => string[];
};

function buildHarness(
  options: {
    balance?: number;
    stitch?: { generateFails?: boolean; editFails?: boolean; sameResult?: boolean };
    withDesign?: boolean;
  } = {}
): Harness {
  const fake = createFakePrisma({ balance: options.balance ?? 10 });
  if (options.withDesign !== false) fake.seedDesign(STITCH_ARTIFACT.body, STITCH_ARTIFACT.css);

  const stitch = {
    async generateHtml() {
      fake.stitchCalls.push('generate');
      if (options.stitch?.generateFails) {
        throw new InvitationAiProviderError('Stitch failed', 'provider');
      }
      return {
        title: STITCH_ARTIFACT.title,
        description: STITCH_ARTIFACT.description,
        body: STITCH_ARTIFACT.body,
        css: STITCH_ARTIFACT.css,
        projectId: 'project-1',
        screenId: 'screen-1',
        modelId: 'gemini',
      };
    },
    async editHtml() {
      fake.stitchCalls.push('edit');
      if (options.stitch?.editFails) {
        throw new InvitationAiProviderError('Stitch failed', 'provider');
      }
      const same = options.stitch?.sameResult;
      const body = same ? STITCH_ARTIFACT.body : EDITED_ARTIFACT.body;
      const css = same ? STITCH_ARTIFACT.css : EDITED_ARTIFACT.css;
      return {
        title: STITCH_ARTIFACT.title,
        description: STITCH_ARTIFACT.description,
        body,
        css,
        projectId: 'project-1',
        screenId: 'screen-1',
      };
    },
    getModelOptions() {
      return [];
    },
  };

  const credits = new CreditsService(fake.prisma as never);
  const guard = new AiCreditsGuard(credits, undefined);
  const service = new InvitationDesignsService(
    fake.prisma as never,
    undefined,
    undefined,
    stitch as never,
    guard
  );

  return {
    ...fake,
    service,
    credits,
    balance: () => fake.accounts.get(fake.userId)?.balance ?? 0,
    ledgerTypes: () => [...fake.ledger.values()].map((e) => e.entryType).sort(),
  };
}

describe('Phase 2: generation credit flow', () => {
  it('charges credits only after a design version is created', async () => {
    const h = buildHarness({ balance: 10 });

    const design = await h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'gen-1');

    expect(design.version).toBe(2);
    expect(h.balance()).toBe(9);
    expect(h.ledgerTypes()).toEqual(['RESERVATION']);
    const usage = onlyUsage(h.usages);
    expect(usage.status).toBe('SUCCEEDED');
    expect(usage.creditsCharged).toBe(1);
    expect(usage.creditsRefunded).toBe(0);
    expect(h.stitchCalls).toEqual(['generate']);
  });

  it('refunds the reservation when Stitch fails', async () => {
    const h = buildHarness({ balance: 10, stitch: { generateFails: true } });

    await expect(
      h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'gen-2')
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(h.balance()).toBe(10);
    expect(h.ledgerTypes()).toEqual(['REFUND', 'RESERVATION']);
    const usage = onlyUsage(h.usages);
    expect(usage.status).toBe('FAILED');
    expect(usage.creditsRefunded).toBe(1);
    expect(h.designs.filter((d) => d.isActive)).toHaveLength(1);
  });

  it('refunds when the prompt is rejected after the hold is taken', async () => {
    const h = buildHarness({ balance: 10, stitch: { sameResult: true } });

    await expect(
      h.service.refineHtmlWithAi(USER, INVITATION, 'do nothing please', undefined, undefined, 'auto', 'edit-bad')
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(h.balance()).toBe(10);
    expect(h.ledgerTypes()).toEqual(['REFUND', 'RESERVATION']);
  });

  it('blocks the AI request entirely when the balance is too low', async () => {
    const h = buildHarness({ balance: 0 });

    await expect(
      h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'gen-3')
    ).rejects.toBeInstanceOf(InsufficientCreditsException);

    // The provider must never be contacted and nothing may be persisted.
    expect(h.stitchCalls).toEqual([]);
    expect(h.ledgerTypes()).toEqual([]);
    expect(h.usages.size).toBe(0);
    expect(h.balance()).toBe(0);
  });
});

describe('Phase 2: edit credit flow', () => {
  it('charges credits only after the edited version is created', async () => {
    const h = buildHarness({ balance: 10 });

    const design = await h.service.refineHtmlWithAi(USER, INVITATION, INSTRUCTION, undefined, undefined, 'auto', 'edit-1');

    expect(design.version).toBe(2);
    expect(h.balance()).toBe(9);
    const usage = onlyUsage(h.usages);
    expect(usage.status).toBe('SUCCEEDED');
    expect(usage.creditsCharged).toBe(1);
    expect(h.stitchCalls).toEqual(['edit']);
  });

  it('refunds the reservation when the Stitch edit fails', async () => {
    const h = buildHarness({ balance: 10, stitch: { editFails: true } });

    await expect(
      h.service.refineHtmlWithAi(USER, INVITATION, INSTRUCTION, undefined, undefined, 'auto', 'edit-2')
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(h.balance()).toBe(10);
    expect(h.ledgerTypes()).toEqual(['REFUND', 'RESERVATION']);
    const usage = onlyUsage(h.usages);
    expect(usage.status).toBe('FAILED');
    expect(usage.creditsRefunded).toBe(1);
    // The previously published design survives an unsuccessful edit.
    expect(h.designs.filter((d) => d.isActive)).toHaveLength(1);
  });

  it('refunds a cancelled edit and never persists the partial result', async () => {
    const h = buildHarness({ balance: 10 });
    const controller = new AbortController();
    controller.abort();

    await expect(
      h.service.refineHtmlWithAi(USER, INVITATION, INSTRUCTION, controller.signal, undefined, 'auto', 'edit-3')
    ).rejects.toBeTruthy();

    expect(h.balance()).toBe(10);
    const usage = onlyUsage(h.usages);
    expect(usage.status).toBe('CANCELLED');
    expect(usage.creditsRefunded).toBe(1);
  });

  it('does not charge an edit that is refused before any AI work', async () => {
    const h = buildHarness({ balance: 10 });
    // A refinement with no existing design fails the precondition check.
    const fresh = buildHarness({ balance: 10, withDesign: false });
    await expect(
      fresh.service.refineHtmlWithAi(USER, INVITATION, INSTRUCTION, undefined, undefined, 'auto', 'edit-4')
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fresh.balance()).toBe(10);
    expect(fresh.ledgerTypes()).toEqual([]);
    expect(fresh.stitchCalls).toEqual([]);
    expect(h.balance()).toBe(10);
  });
});

describe('Phase 2: idempotency and concurrency', () => {
  it('does not double-charge a duplicated generation request', async () => {
    const h = buildHarness({ balance: 10 });

    await h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'same-key');
    await h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'same-key');

    // One reservation, one charge, no matter how many times the client retries.
    expect(h.balance()).toBe(9);
    expect(h.ledgerTypes()).toEqual(['RESERVATION']);
    expect(h.usages.size).toBe(1);
    expect(onlyUsage(h.usages).creditsCharged).toBe(1);
  });

  it('rejects a reused key that changes the operation, without charging', async () => {
    const h = buildHarness({ balance: 10 });
    await h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'shared');

    await expect(
      h.service.refineHtmlWithAi(USER, INVITATION, INSTRUCTION, undefined, undefined, 'auto', 'shared')
    ).rejects.toBeInstanceOf(ConflictException);

    expect(h.balance()).toBe(9);
  });

  it('never lets concurrent generations overdraw the balance', async () => {
    const h = buildHarness({ balance: 2 });

    const results = await Promise.allSettled([
      h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'c1'),
      h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'c2'),
      h.service.generateHtmlWithAi(USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'c3'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientCreditsException
    );
    expect(h.balance()).toBe(0);
    // The request that could not pay never reached the provider.
    expect(h.stitchCalls).toHaveLength(2);
  });
});

describe('Phase 2: structured design generation and edits', () => {
  function structuredHarness(options: { balance?: number; fail?: boolean } = {}) {
    const fake = createFakePrisma({ balance: options.balance ?? 10 });
    fake.seedStructuredDesign();
    const credits = new CreditsService(fake.prisma as never);
    const guard = new AiCreditsGuard(credits, undefined);
    const provider = {
      async generateDesign() {
        if (options.fail) {
          throw new InvitationAiProviderError('provider exploded', 'provider');
        }
        return { specification: GENERATED_SPEC, tokensUsed: 12 };
      },
    };
    const service = new InvitationDesignsService(
      fake.prisma as never,
      provider as never,
      undefined,
      undefined,
      guard
    );
    return {
      service,
      balance: () => fake.accounts.get(fake.userId)?.balance ?? 0,
      ledgerTypes: () => [...fake.ledger.values()].map((e) => e.entryType).sort(),
      usages: fake.usages,
      designs: fake.designs,
    };
  }

  it('charges a structured AI generation once its version is created', async () => {
    const h = structuredHarness();

    const design = await h.service.generateWithAi(USER, INVITATION, {
      prompt: 'Create a garden invitation',
      idempotencyKey: 'struct-gen',
    } as never);

    expect(design.version).toBe(2);
    expect(h.balance()).toBe(9);
    expect(h.ledgerTypes()).toEqual(['RESERVATION']);
    expect(onlyUsage(h.usages)).toMatchObject({
      status: 'SUCCEEDED',
      creditsCharged: 1,
    });
  });

  it('refunds a structured generation when the provider fails', async () => {
    const h = structuredHarness({ fail: true });

    await expect(
      h.service.generateWithAi(USER, INVITATION, {
        prompt: 'Create a garden invitation',
        idempotencyKey: 'struct-gen-fail',
      } as never)
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(h.balance()).toBe(10);
    expect(h.ledgerTypes()).toEqual(['REFUND', 'RESERVATION']);
    expect(onlyUsage(h.usages)).toMatchObject({
      status: 'FAILED',
      creditsRefunded: 1,
    });
    expect(h.designs.filter((d) => d.isActive)).toHaveLength(1);
  });

  it('charges a structured AI edit once its version is created', async () => {
    const h = structuredHarness();

    const design = await h.service.refineWithAi(USER, INVITATION, {
      instruction: 'Make it warmer and friendlier',
      idempotencyKey: 'struct-edit',
    } as never);

    expect(design.version).toBe(2);
    expect(h.balance()).toBe(9);
    expect(onlyUsage(h.usages)).toMatchObject({
      status: 'SUCCEEDED',
      creditsCharged: 1,
    });
  });

  it('blocks a structured generation that cannot pay', async () => {
    const h = structuredHarness({ balance: 0 });

    await expect(
      h.service.generateWithAi(USER, INVITATION, {
        prompt: 'Create a garden invitation',
        idempotencyKey: 'struct-broke',
      } as never)
    ).rejects.toBeInstanceOf(InsufficientCreditsException);

    expect(h.ledgerTypes()).toEqual([]);
    expect(h.designs.filter((d) => d.isActive)).toHaveLength(1);
  });
});

describe('Phase 2: ownership is still enforced', () => {
  it('rejects a non-owner before any credits are held or spent', async () => {
    // The harness owner owns the invitation; OTHER_USER does not.
    const fake = createFakePrisma({ balance: 10, userId: USER });
    fake.seedDesign(STITCH_ARTIFACT.body, STITCH_ARTIFACT.css);
    const credits = new CreditsService(fake.prisma as never);
    const stitchCalls: string[] = [];
    const service = new InvitationDesignsService(
      fake.prisma as never,
      undefined,
      undefined,
      {
        async generateHtml() {
          stitchCalls.push('generate');
          return { ...STITCH_ARTIFACT, projectId: 'p', screenId: 's' };
        },
      } as never,
      new AiCreditsGuard(credits, undefined)
    );

    await expect(
      service.generateHtmlWithAi(OTHER_USER, INVITATION, PROMPT, undefined, undefined, 'auto', 'steal')
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(stitchCalls).toEqual([]);
    expect(fake.accounts.get(USER)?.balance).toBe(10);
    expect(fake.ledger.size).toBe(0);
    expect(fake.usages.size).toBe(0);
  });
});

describe('Phase 2: free operations', () => {
  it('charges nothing for a manual design edit', async () => {    const fake = createFakePrisma({ balance: 10 });
    fake.seedStructuredDesign();
    const credits = new CreditsService(fake.prisma as never);
    const service = new InvitationDesignsService(
      fake.prisma as never,
      undefined,
      undefined,
      undefined,
      new AiCreditsGuard(credits, undefined)
    );

    const design = await service.update(USER, INVITATION, {
      content: { ...STRUCTURED_SPEC.content, title: 'A Manually Retitled Dinner' },
    } as never);

    expect(design.version).toBe(2);
    expect(design.sourceType).toBe('MANUAL');
    // Manual editing is free: no hold, no charge, no ledger entry at all.
    expect(fake.accounts.get(fake.userId)?.balance).toBe(10);
    expect(fake.ledger.size).toBe(0);
    expect(fake.usages.size).toBe(0);
  });

  it('charges nothing for a Smart Question analysis', async () => {
    const h = buildHarness({ balance: 10 });
    const analyzeDetails = jest.fn(async () => ({
      status: 'QUESTION',
      collectedData: { eventType: 'Birthday' },
      question: {
        id: 'event-date',
        text: 'What is the date of the event?',
        type: 'text',
      },
    }));
    const { AiStudioService } = jest.requireActual('./../ai-studio/ai-studio.service') as {
      AiStudioService: new (...args: any[]) => any;
    };
    const studio = new AiStudioService(
      h.prisma as never,
      h.service as never,
      { analyzeDetails } as never
    );

    const analysis = await studio.analyze({ prompt: PROMPT, collectedData: {} } as never);

    expect(analysis).toMatchObject({ status: 'QUESTION' });
    expect(h.balance()).toBe(10);
    expect(h.ledgerTypes()).toEqual([]);
    expect(h.usages.size).toBe(0);
  });
});
