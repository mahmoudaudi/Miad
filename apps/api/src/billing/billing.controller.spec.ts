import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CreditsService } from './credits.service';

type Summary = { balance: number; totalGranted: number; used: number };

function makeController(options: {
  summary?: Summary;
  usage?: unknown[];
  plans?: unknown[];
  subscription?: unknown;
} = {}) {
  const billing = {
    listPlans: jest.fn(async () => options.plans ?? []),
    currentSubscription: jest.fn(async () => options.subscription ?? null),
  } as unknown as BillingService;
  const credits = {
    summary: jest.fn(async () => options.summary ?? { balance: 0, totalGranted: 0, used: 0 }),
    recentUsage: jest.fn(async () => options.usage ?? []),
  } as unknown as CreditsService;
  const controller = new BillingController(billing, credits);
  const user = { sub: 'user-1' } as never;
  return { controller, credits: credits as unknown as Record<string, jest.Mock>, user };
}

describe('BillingController credit endpoints', () => {
  it('returns the credit summary for the signed-in account', async () => {
    const summary = { balance: 7, totalGranted: 10, used: 3 };
    const { controller, credits, user } = makeController({ summary });

    await expect(controller.creditSummary(user)).resolves.toEqual(summary);
    // Always scoped to the caller, never an id from the request.
    expect(credits.summary).toHaveBeenCalledWith('user-1');
  });

  it('returns recent usage for the signed-in account', async () => {
    const usage = [{ id: 'u-1' }];
    const { controller, credits, user } = makeController({ usage });

    await expect(controller.creditUsage(user, undefined)).resolves.toEqual(usage);
    expect(credits.recentUsage).toHaveBeenCalledWith('user-1', 20);
  });

  it('forwards a valid limit and ignores a malformed one', async () => {
    const { controller, credits, user } = makeController();
    await controller.creditUsage(user, '5');
    expect(credits.recentUsage).toHaveBeenLastCalledWith('user-1', 5);

    await controller.creditUsage(user, 'not-a-number');
    expect(credits.recentUsage).toHaveBeenLastCalledWith('user-1', 20);

    await controller.creditUsage(user, undefined);
    expect(credits.recentUsage).toHaveBeenLastCalledWith('user-1', 20);
  });
});
