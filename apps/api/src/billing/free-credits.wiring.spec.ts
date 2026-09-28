import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from './credits.module';
import { CreditsService } from './credits.service';
import { FreeCreditsService } from './free-credits.service';

/**
 * The auth flow depends on FreeCreditsService being injectable. If the module
 * graph ever stops providing it, accounts would silently be created with no
 * credits (and 402 on their first generation), so assert the wiring explicitly.
 */
describe('Free credits module wiring', () => {
  it('exposes the credit services without importing AuthModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), CreditsModule],
    }).compile();
    expect(moduleRef.get(CreditsService, { strict: false })).toBeInstanceOf(CreditsService);
    expect(moduleRef.get(FreeCreditsService, { strict: false })).toBeInstanceOf(FreeCreditsService);
    await moduleRef.close();
  });

  it('injects the free credits service into the auth service', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AuthModule],
    }).compile();
    const authService = moduleRef.get<unknown>(
      // Resolve by the concrete class registered in AuthModule.
      (await import('../auth/auth.service')).AuthService as never,
      { strict: false }
    );
    const injected = (authService as { freeCredits?: unknown }).freeCredits;
    expect(injected).toBeInstanceOf(FreeCreditsService);
    await moduleRef.close();
  });
});
