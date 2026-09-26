import { firstValueFrom, take } from 'rxjs';
import { AiGenerationProgressService } from './ai-generation-progress.service';

const userId = 'user-1';
const generationId = '11111111-1111-4111-8111-111111111111';

describe('AiGenerationProgressService', () => {
  it('replays only actual backend stage transitions to the owner', async () => {
    const service = new AiGenerationProgressService();
    const observed = firstValueFrom(service.observe(userId, generationId).pipe(take(1)));
    service.begin(userId, generationId);
    await expect(observed).resolves.toMatchObject({
      generationId,
      stage: 'REQUEST_RECEIVED',
      status: 'ACTIVE',
    });

    service.advance(userId, generationId, 'GENERATING_WEBSITE');
    await expect(
      firstValueFrom(service.observe(userId, generationId).pipe(take(1)))
    ).resolves.toMatchObject({
      stage: 'GENERATING_WEBSITE',
      status: 'ACTIVE',
    });
  });

  it('marks the real current stage as failed without fabricating completion', async () => {
    const service = new AiGenerationProgressService();
    service.begin(userId, generationId);
    service.advance(userId, generationId, 'PARSING_RESPONSE');
    service.fail(userId, generationId, 'The website could not be generated. Please try again.');
    await expect(
      firstValueFrom(service.observe(userId, generationId).pipe(take(1)))
    ).resolves.toMatchObject({
      stage: 'PARSING_RESPONSE',
      status: 'FAILED',
    });
  });

  it.each([
    ['provider timeout', 'GENERATING_WEBSITE'],
    ['response parsing failure', 'PARSING_RESPONSE'],
    ['website validation failure', 'VALIDATING_WEBSITE'],
  ] as const)('keeps %s attached to its actual stage', async (_scenario, stage) => {
    const service = new AiGenerationProgressService();
    service.begin(userId, generationId);
    service.advance(userId, generationId, stage);
    service.fail(userId, generationId, 'The website could not be generated. Please try again.');

    await expect(
      firstValueFrom(service.observe(userId, generationId).pipe(take(1)))
    ).resolves.toMatchObject({
      stage,
      status: 'FAILED',
    });
  });

  it('reports saving and completion only after a successful save', async () => {
    const service = new AiGenerationProgressService();
    service.begin(userId, generationId);
    service.advance(userId, generationId, 'SAVING_WEBSITE');
    service.complete(userId, generationId);

    await expect(
      firstValueFrom(service.observe(userId, generationId).pipe(take(1)))
    ).resolves.toMatchObject({
      stage: 'COMPLETED',
      status: 'COMPLETED',
    });
  });
});
