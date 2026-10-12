import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { environment: 'test' } } },
}));
import {
  ApiError,
  apiRequest,
  cancelRoundup,
  createCryptoCard,
  fetchOnchainSpendingPreview,
  fetchSession,
  isApiUrlAllowed,
  sessionRetryDelay,
  shouldRetrySession,
  timeoutSignal,
} from './api';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://test.roundups.invalid');
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe('authenticated frontend API client', () => {
  it('uses fresh tokens for each request and preserves idempotency headers', async () => {
    const token = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiRequest(token, '/v1/portfolio/sell', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'same-sale-key' },
      body: '{}',
    });
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiRequest(token, '/v1/overview');
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({
      Authorization: 'Bearer first',
      'Idempotency-Key': 'same-sale-key',
    });
    expect(fetchMock.mock.calls[1]?.[1].headers.Authorization).toBe('Bearer second');
  });
  it('cancels a roundup through its purchase-scoped endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'roundup-id', status: 'cancelled' }), { status: 200 }),
    );

    await expect(cancelRoundup(async () => 'token', 'purchase/id')).resolves.toEqual({
      id: 'roundup-id',
      status: 'cancelled',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.roundups.invalid/v1/transactions/purchase%2Fid/roundup/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('never sends an unauthenticated or already cancelled request', async () => {
    await expect(apiRequest(async () => null, '/v1/overview')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    const abort = new AbortController();
    abort.abort();
    await expect(
      apiRequest(async () => 'token', '/v1/overview', { signal: abort.signal }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps authorization and service errors distinct', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(apiRequest(async () => 'token', '/v1/overview')).rejects.toThrow(
      'Your session expired',
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'BANK_NOT_CONFIGURED' } }), { status: 503 }),
    );
    await expect(apiRequest(async () => 'token', '/v1/bank/link')).rejects.toMatchObject({
      code: 'BANK_NOT_CONFIGURED',
      message: 'Bank connections are not configured yet.',
    });
  });
  it('requires HTTPS outside development', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'http://test.roundups.invalid');
    vi.stubGlobal('__DEV__', false);
    await expect(apiRequest(async () => 'token', '/v1/overview')).rejects.toMatchObject({
      code: 'INSECURE_API_URL',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('allows an HTTP account service in a development-flavored release build', () => {
    expect(isApiUrlAllowed(new URL('http://localhost:3000'), 'development', false)).toBe(true);
    expect(isApiUrlAllowed(new URL('http://192.168.1.20:3000'), 'development', false)).toBe(true);
    expect(isApiUrlAllowed(new URL('http://localhost:3000'), 'production', false)).toBe(false);
  });
});

describe('session hand-off retries', () => {
  it('marks only the post-login session hand-off as token-not-ready', async () => {
    await expect(fetchSession(async () => null)).rejects.toMatchObject({
      code: 'AUTH_TOKEN_NOT_READY',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries when the Privy user arrives before its token and on temporary failures', () => {
    expect(shouldRetrySession(0, new ApiError(401, 'AUTH_TOKEN_NOT_READY', 'pending'))).toBe(true);
    expect(shouldRetrySession(2, new ApiError(503, 'SESSION_UNAVAILABLE', 'pending'))).toBe(true);
    expect(shouldRetrySession(4, new ApiError(503, 'SESSION_UNAVAILABLE', 'pending'))).toBe(false);
  });

  it('retries a rejected token so Privy can refresh it, but not broken build configuration', () => {
    expect(shouldRetrySession(0, new ApiError(401, 'UNAUTHORIZED', 'expired'))).toBe(true);
    expect(shouldRetrySession(0, new ApiError(503, 'API_NOT_CONFIGURED', 'missing'))).toBe(false);
    expect(shouldRetrySession(0, new ApiError(503, 'INSECURE_API_URL', 'invalid'))).toBe(false);
  });

  it('backs off without making the recovery feel frozen', () => {
    expect([0, 1, 2, 3, 4].map(sessionRetryDelay)).toEqual([400, 800, 1600, 2500, 2500]);
  });
});

it('supports React Native signals without throwIfAborted', async () => {
  const controller = new AbortController();
  Object.defineProperty(controller.signal, 'throwIfAborted', { value: undefined });
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
  await apiRequest(async () => 'token', '/v1/social/leaderboard', { signal: controller.signal });
  expect(fetchMock).toHaveBeenCalledOnce();
  controller.abort();
  await expect(
    apiRequest(async () => 'token', '/v1/social/leaderboard', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('turns native transport failures into a useful connection message', async () => {
  fetchMock.mockRejectedValue(new Error('native implementation detail'));
  await expect(apiRequest(async () => 'token', '/v1/social/leaderboard')).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
    message: 'Couldn’t connect. Check your connection and try again.',
  });
});

describe('bank connection error copy', () => {
  it.each([
    ['BANK_CONNECTION_NOT_COMPLETED', 'did not finish connecting'],
    ['BANK_ALREADY_LINKED', 'already connected'],
    ['SALTEDGE_RATE_LIMITED', 'busy right now'],
    ['LINK_SESSION_NOT_FOUND', 'no longer valid'],
  ])('maps %s to actionable copy, not a raw code', async (code, fragment) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code } }), { status: 422 }),
    );
    const failure = apiRequest(async () => 'token', '/v1/bank/exchange', {
      method: 'POST',
      body: '{}',
    });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await failure.catch((error: ApiError) => {
      expect(error.message).toContain(fragment);
      expect(error.message).not.toContain(code);
    });
  });
});

describe('request timeouts', () => {
  it.each(['preview', 'save'] as const)(
    'bounds the crypto-card %s request when the network stalls',
    async (operation) => {
      vi.useFakeTimers();
      try {
        fetchMock.mockImplementation(
          (_url, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => reject(init.signal!.reason));
            }),
        );
        let failure: unknown;
        const address = `0x${'1'.repeat(40)}`;
        const request =
          operation === 'preview'
            ? fetchOnchainSpendingPreview(async () => 'token', [address])
            : createCryptoCard(async () => 'token', 'etherfi', address);
        void request.catch((error) => {
          failure = error;
        });
        await vi.advanceTimersByTimeAsync(30_001);
        expect(failure).toMatchObject({ code: 'REQUEST_TIMEOUT' });
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it('reports a timed-out request instead of hanging forever', async () => {
    const signal = timeoutSignal(5);
    fetchMock.mockImplementation(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    await expect(
      apiRequest(async () => 'token', '/v1/bank/exchange', { method: 'POST', signal }),
    ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', status: 504 });
  });

  it('still propagates caller-initiated cancellation untouched', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiRequest(async () => 'token', '/v1/overview', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

it('releases session startup when the auth token provider never resolves', async () => {
  vi.useFakeTimers();
  try {
    const pending = fetchSession(() => new Promise(() => {}));
    const result = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
