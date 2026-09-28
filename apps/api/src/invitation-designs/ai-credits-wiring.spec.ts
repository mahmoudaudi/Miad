import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AiCreditsGuard } from '../billing/ai-credits.guard';
import { BillingModule } from '../billing/billing.module';
import { InvitationDesignsModule } from '../invitation-designs/invitation-designs.module';
import { InvitationDesignsService } from '../invitation-designs/invitation-designs.service';

/**
 * Guards the one real risk in this integration: the credit guard is an
 * @Optional() dependency, so a wiring mistake would silently make every AI
 * operation free. These tests fail if that ever happens.
 */
describe('Phase 2 module wiring', () => {
  it('resolves the AI credit guard in the application billing module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), BillingModule],
    }).compile();
    expect(moduleRef.get(AiCreditsGuard, { strict: false })).toBeInstanceOf(AiCreditsGuard);
    await moduleRef.close();
  });

  it('injects the credit guard into the invitation designs service', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), InvitationDesignsModule],
    }).compile();
    const service = moduleRef.get(InvitationDesignsService, { strict: false });
    // The service keeps the guard private; reaching it proves DI provided it.
    const guard = (service as unknown as { credits?: unknown }).credits;
    expect(guard).toBeInstanceOf(AiCreditsGuard);
    await moduleRef.close();
  });
});
