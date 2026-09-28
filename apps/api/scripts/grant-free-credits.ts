/**
 * One-off, re-runnable backfill for accounts that already existed before the
 * Free plan welcome grant was introduced.
 *
 * Safe to run any number of times: the grant is keyed on the user id, so an
 * account that already has the grant (or already has a CreditAccount) is left
 * alone. Admins are skipped entirely.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/grant-free-credits.ts
 *   npm run credits:grant-free --workspace=apps/api
 */
import { PrismaClient } from '@prisma/client';
import { CreditsService } from '../src/billing/credits.service';
import { FreeCreditsService } from '../src/billing/free-credits.service';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const freeCredits = new FreeCreditsService(new CreditsService(prisma as never));

    // Only accounts with no credit account at all are candidates. Users who
    // already have one keep whatever balance they have.
    const candidates = await prisma.user.findMany({
      where: { role: { name: { not: 'admin' } }, creditAccount: null },
      select: { id: true, email: true },
    });

    let granted = 0;
    let skipped = 0;
    let failed = 0;
    for (const user of candidates) {
      try {
        const result = await freeCredits.grantFreeCredits(user.id, 'user');
        if (result.granted) {
          granted += 1;
          process.stdout.write(`  granted ${freeCredits.amount()} -> ${user.email}\n`);
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        process.stdout.write(
          `  FAILED ${user.email}: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    }

    const accounts = await prisma.creditAccount.count();
    const ledger = await prisma.creditLedgerEntry.count();
    process.stdout.write(
      `\ncandidates=${candidates.length} granted=${granted} skipped=${skipped} failed=${failed}\n` +
        `credit_accounts=${accounts} credit_ledger_entries=${ledger}\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
