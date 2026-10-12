import { beforeEach, describe, expect, it, vi } from 'vitest';
const secrets = vi.hoisted(() => ({ clear: vi.fn(async (_id: string) => {}) }));
vi.mock('./bank-exchange-token', () => ({ clearBankExchangeToken: secrets.clear }));
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
    removeItem: async (key: string) => void store.delete(key),
  },
}));
import { clearPendingSaltEdge, loadPendingSaltEdge, savePendingSaltEdge } from './saltedge-pending';

const completion = {
  userId: 'user-1',
  linkSessionId: 'session-1',
  mode: 'connect',
  exchangeableToken: 'https://connect.saltedge.com/session/abc',
  returnTo: '/onboarding/bank',
};

beforeEach(() => store.clear());

describe('pending Salt Edge completion persistence', () => {
  it('round-trips a completion for recovery after a process death', async () => {
    await savePendingSaltEdge({ ...completion, provider: 'saltedge' });
    const loaded = await loadPendingSaltEdge();
    expect(loaded).toMatchObject({ ...completion, provider: 'saltedge' });
    expect(typeof loaded!.savedAt).toBe('number');
  });

  it('normalizes records written before the provider field existed', async () => {
    store.set(
      'saltedge.pending.completion',
      JSON.stringify({ ...completion, savedAt: Date.now() }),
    );
    expect((await loadPendingSaltEdge())?.provider).toBe('saltedge');
  });

  it('round-trips a MoneyKit marker whose one-time token is gone', async () => {
    await savePendingSaltEdge({
      ...completion,
      provider: 'moneykit',
      exchangeableToken: '',
    });
    const loaded = await loadPendingSaltEdge();
    expect(loaded?.provider).toBe('moneykit');
    expect(loaded?.exchangeableToken).toBe('');
  });

  it('rejects unknown providers', async () => {
    store.set(
      'saltedge.pending.completion',
      JSON.stringify({ ...completion, provider: 'plaid', savedAt: Date.now() }),
    );
    expect(await loadPendingSaltEdge()).toBeNull();
  });

  it('preserves recovery beyond the bank authorization window', async () => {
    await savePendingSaltEdge(completion);
    store.set(
      'saltedge.pending.completion',
      JSON.stringify({ ...completion, savedAt: Date.now() - 31 * 60 * 1000 }),
    );
    expect((await loadPendingSaltEdge())?.linkSessionId).toBe('session-1');
  });

  it('treats corrupt or incomplete records as absent', async () => {
    store.set('saltedge.pending.completion', '{not json');
    expect(await loadPendingSaltEdge()).toBeNull();
    await savePendingSaltEdge(completion);
    store.set('saltedge.pending.completion', JSON.stringify({ userId: 'user-1' }));
    expect(await loadPendingSaltEdge()).toBeNull();
  });

  it('clears cleanly once finalized or abandoned', async () => {
    await savePendingSaltEdge(completion);
    await clearPendingSaltEdge();
    expect(await loadPendingSaltEdge()).toBeNull();
  });
});

it('cannot erase a new marker while old secure-token cleanup is suspended', async () => {
  await savePendingSaltEdge(completion);
  let release!: () => void;
  let entered!: () => void;
  const clearing = new Promise<void>((done) => {
    entered = done;
  });
  secrets.clear.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        release = done;
        entered();
      }),
  );
  const old = clearPendingSaltEdge(completion.linkSessionId);
  await clearing;
  const newer = savePendingSaltEdge({ ...completion, linkSessionId: 'new-session' });
  await Promise.resolve();
  release();
  await Promise.all([old, newer]);
  expect((await loadPendingSaltEdge())?.linkSessionId).toBe('new-session');
});
