import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInvitationDesign, refineInvitationDesign } from './invitation-designs';

/**
 * Stop used to be a no-op on the structured design branch because these two
 * callers never forwarded an AbortSignal, so `controller.abort()` could not
 * reach the request. These lock the signal plumbing in place.
 */
describe('structured design requests are cancellable', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'design-1', version: 2 }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const initOf = (index = 0) => fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;

  it('forwards the abort signal when generating a structured design', async () => {
    const controller = new AbortController();
    await generateInvitationDesign(
      'inv-1',
      { prompt: 'Create a garden invitation', mode: 'generate' },
      controller.signal
    );
    expect(initOf()?.signal).toBe(controller.signal);
  });

  it('forwards the abort signal when refining a structured design', async () => {
    const controller = new AbortController();
    await refineInvitationDesign('inv-1', 'Make it warmer', 'auto', controller.signal);
    expect(initOf()?.signal).toBe(controller.signal);
  });

  it('omits the signal entirely when the caller has none', async () => {
    await generateInvitationDesign('inv-1', { prompt: 'Create a garden invitation' });
    expect(initOf()?.signal).toBeUndefined();
  });

  it('actually cancels the in-flight request when aborted', async () => {
    const controller = new AbortController();
    // Never resolves, so only a real abort can settle the promise.
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );

    const pending = generateInvitationDesign(
      'inv-1',
      { prompt: 'Create a garden invitation' },
      controller.signal
    );
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
