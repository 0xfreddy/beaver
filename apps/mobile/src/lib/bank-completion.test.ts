import { beforeEach, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
    removeItem: async (key: string) => void store.delete(key),
  },
}));
vi.mock('./api', () => ({
  apiRequest: vi.fn(),
  timeoutSignal: () => undefined,
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
import { apiRequest, ApiError } from './api';
import { completeBankConnection } from './bank-completion';
import { loadPendingSaltEdge, savePendingSaltEdge } from './saltedge-pending';

const pending = {
  userId: 'user-1',
  linkSessionId: 'session-1',
  mode: 'connect',
  exchangeableToken: 'connect-url',
  returnTo: '/onboarding/bank',
};
const token = async () => 'access-token';
beforeEach(() => {
  store.clear();
  vi.mocked(apiRequest).mockReset();
});

it('keeps recovery durable while a request is pending and shares it across surfaces', async () => {
  await savePendingSaltEdge(pending);
  let finish!: (value: { id: string }) => void;
  vi.mocked(apiRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const callback = completeBankConnection(pending, token);
  const banks = completeBankConnection(pending, token);
  expect(callback).toBe(banks);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(await loadPendingSaltEdge()).toMatchObject(pending);
  finish({ id: 'bank-1' });
  await expect(callback).resolves.toEqual({ id: 'bank-1' });
  expect(await loadPendingSaltEdge()).toBeNull();
});

it('allows a failed completion to be recovered after leaving the callback', async () => {
  await savePendingSaltEdge(pending);
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('offline'));
  await expect(completeBankConnection(pending, token)).rejects.toThrow('offline');
  const restored = await loadPendingSaltEdge();
  expect(restored).toMatchObject(pending);
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'bank-1' });
  await completeBankConnection(restored!, token);
  expect(apiRequest).toHaveBeenCalledTimes(2);
  expect(await loadPendingSaltEdge()).toBeNull();
});

it('does not erase a newer connection when an older request completes', async () => {
  await savePendingSaltEdge({ ...pending, linkSessionId: 'session-2' });
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'bank-1' });
  await completeBankConnection(pending, token);
  expect((await loadPendingSaltEdge())?.linkSessionId).toBe('session-2');
});

it('reconnects through relink without exchanging a new connection', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'bank-1' });
  await completeBankConnection({ ...pending, mode: 'update' }, token);
  expect(apiRequest).toHaveBeenCalledWith(
    token,
    '/v1/bank/relink',
    expect.objectContaining({
      body: JSON.stringify({ linkSessionId: pending.linkSessionId }),
    }),
  );
});

it('falls back to exchange only when an older API has no recovery route', async () => {
  vi.mocked(apiRequest).mockRejectedValueOnce(
    new ApiError(404, 'SERVICE_UNAVAILABLE', 'Not found'),
  );
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'bank-1' });
  await completeBankConnection({ ...pending, recovery: true }, token);
  expect(apiRequest).toHaveBeenCalledWith(
    token,
    '/v1/bank/exchange',
    expect.objectContaining({
      body: JSON.stringify({
        linkSessionId: pending.linkSessionId,
        exchangeableToken: pending.exchangeableToken,
      }),
    }),
  );
});

it('keeps a tokenless marker when an older API cannot recover it', async () => {
  vi.mocked(apiRequest).mockRejectedValueOnce(
    new ApiError(404, 'SERVICE_UNAVAILABLE', 'Not found'),
  );
  const marker = { ...pending, exchangeableToken: '' };
  await savePendingSaltEdge(marker);
  await expect(completeBankConnection({ ...marker, recovery: true }, token)).rejects.toMatchObject({
    code: 'BANK_COMPLETION_TOKEN_MISSING',
  });
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(await loadPendingSaltEdge()).toMatchObject(marker);
});

it('resumes updates through server recovery without requiring an exchange token', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'bank-1' });
  await completeBankConnection(
    { ...pending, mode: 'update', exchangeableToken: '', recovery: true },
    token,
  );
  expect(apiRequest).toHaveBeenCalledWith(
    token,
    '/v1/bank/recover',
    expect.objectContaining({ body: JSON.stringify({ linkSessionId: pending.linkSessionId }) }),
  );
});

it('preserves a missing-session response from a supported recovery endpoint', async () => {
  vi.mocked(apiRequest).mockRejectedValueOnce(
    new ApiError(404, 'LINK_SESSION_NOT_FOUND', 'Expired'),
  );
  await expect(completeBankConnection({ ...pending, recovery: true }, token)).rejects.toMatchObject(
    { code: 'LINK_SESSION_NOT_FOUND' },
  );
});

it('uses server recovery when a restarted connection has no local token', async () => {
  const marker = { ...pending, exchangeableToken: '', recovery: true };
  await savePendingSaltEdge(marker);
  vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'bank-1' });
  await expect(completeBankConnection(marker, token)).resolves.toEqual({ id: 'bank-1' });
  expect(apiRequest).toHaveBeenCalledWith(
    token,
    '/v1/bank/recover',
    expect.objectContaining({
      body: JSON.stringify({ linkSessionId: pending.linkSessionId }),
    }),
  );
});
