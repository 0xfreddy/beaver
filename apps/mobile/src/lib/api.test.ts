import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { environment: 'test' } } },
}));
import {
  ApiError,
  apiRequest,
  fetchSession,
  isApiUrlAllowed,
  sessionRetryDelay,
  shouldRetrySession,
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
