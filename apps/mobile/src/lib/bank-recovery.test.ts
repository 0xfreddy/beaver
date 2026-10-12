import { beforeEach, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());
const secrets = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key: string) => secrets.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void secrets.set(key, value),
  deleteItemAsync: async (key: string) => void secrets.delete(key),
}));
vi.mock('./bank-exchange-token', () => import('./bank-exchange-token.native'));
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
import { apiRequest } from './api';
import { recoverPendingBank } from './bank-recovery';
import { saveBankExchangeToken, loadBankExchangeToken } from './bank-exchange-token.native';
import { loadPendingSaltEdge, savePendingSaltEdge } from './saltedge-pending';

const marker = {
  provider: 'moneykit' as const,
  userId: 'user-1',
  linkSessionId: 'cold-session',
  mode: 'connect',
  exchangeableToken: '',
  returnTo: '/settings/banks',
  savedAt: Date.now() - 86400000,
};
const token = async () => 'access-token';
beforeEach(() => {
  store.clear();
  secrets.clear();
  vi.mocked(apiRequest).mockReset();
  // Storage restored by a new process, with no in-memory SDK session.
  store.set('saltedge.pending.completion', JSON.stringify(marker));
});

it('restores a securely saved SDK token after restart, then deletes it after completion', async () => {
  await saveBankExchangeToken(marker.userId, marker.linkSessionId, 'temporary-exchange-token');
  expect(await loadBankExchangeToken('other-user', marker.linkSessionId)).toBeNull();
  expect(store.get('saltedge.pending.completion')).not.toContain('temporary-exchange-token');
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('offline'));
  await expect(recoverPendingBank(marker.userId, token)).rejects.toThrow('offline');
  expect(await loadBankExchangeToken(marker.userId, marker.linkSessionId)).toBe(
    'temporary-exchange-token',
  );
  vi.mocked(apiRequest).mockResolvedValue({ id: 'bank-1' });
  await recoverPendingBank(marker.userId, token);
  expect(apiRequest).toHaveBeenLastCalledWith(
    token,
    '/v1/bank/recover',
    expect.objectContaining({
      body: JSON.stringify({
        linkSessionId: marker.linkSessionId,
        exchangeableToken: 'temporary-exchange-token',
      }),
    }),
  );
  expect(await loadBankExchangeToken(marker.userId, marker.linkSessionId)).toBeNull();
});

it.each(['saltedge', 'moneykit'])(
  'recovers %s on startup after a day without a bank screen',
  async (provider) => {
    store.set('saltedge.pending.completion', JSON.stringify({ ...marker, provider }));
    await saveBankExchangeToken(marker.userId, marker.linkSessionId, 'saved-proof');
    vi.mocked(apiRequest).mockResolvedValue({ id: 'bank-1' });
    expect(await recoverPendingBank(marker.userId, token)).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith(
      token,
      '/v1/bank/recover',
      expect.objectContaining({
        body: JSON.stringify({
          linkSessionId: marker.linkSessionId,
          exchangeableToken: 'saved-proof',
        }),
      }),
    );
    expect(await loadPendingSaltEdge()).toBeNull();
  },
);

it('retains completion proof while the existing endpoint reports a retryable failure', async () => {
  await saveBankExchangeToken(marker.userId, marker.linkSessionId, 'saved-proof');
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error('LINK_EXCHANGE_UNCERTAIN'));
  await expect(recoverPendingBank(marker.userId, token)).rejects.toThrow();
  expect(await loadPendingSaltEdge()).toMatchObject(marker);
  vi.mocked(apiRequest).mockResolvedValue({ id: 'bank-1' });
  expect(await recoverPendingBank(marker.userId, token)).toBe(true);
  expect(await recoverPendingBank(marker.userId, token)).toBe(false);
  expect(apiRequest).toHaveBeenCalledTimes(2);
});

it('does not submit another user’s recovery marker', async () => {
  expect(await recoverPendingBank('other-user', token)).toBe(false);
  expect(apiRequest).not.toHaveBeenCalled();
  expect(await loadPendingSaltEdge()).toMatchObject(marker);
});

it('leaves an active flow in this process to its SDK and callback', async () => {
  await savePendingSaltEdge({ ...marker, linkSessionId: 'live-session' });
  expect(await recoverPendingBank(marker.userId, token)).toBe(false);
  expect(apiRequest).not.toHaveBeenCalled();
});
