import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void storage.set(key, value)),
    removeItem: vi.fn(async (key: string) => void storage.delete(key)),
  },
}));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { environment: 'development', mockDataEnabled: true, internalAccessEnabled: false },
    },
  },
}));

import {
  clearMockData,
  isMockDataEnvironmentAllowed,
  loadCanonicalMockData,
  mockApiRequest,
  restoreMockData,
} from './mock-data';
import { apiRequest } from './api';
import Constants from 'expo-constants';

beforeEach(() => {
  Constants.expoConfig!.extra!.environment = 'development';
  Constants.expoConfig!.extra!.mockDataEnabled = true;
  Constants.expoConfig!.extra!.internalAccessEnabled = false;
  storage.clear();
  vi.clearAllMocks();
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://live.example.invalid');
});

describe('sample account safety boundary', () => {
  it('never simulates deletion of a real account with sample data loaded', async () => {
    await loadCanonicalMockData('real-user');
    expect(await mockApiRequest('/v1/account', { method: 'DELETE' })).toEqual({ handled: false });
    expect(await restoreMockData('real-user')).not.toBeNull();
  });

  it('actually removes local data when a synthetic account is deleted', async () => {
    await loadCanonicalMockData('team:deletion@example.com');
    expect(await mockApiRequest('/v1/account', { method: 'DELETE' })).toEqual({
      handled: true,
      data: { deleted: true },
    });
    expect(await restoreMockData('team:deletion@example.com')).toBeNull();
  });
  it('rejects production even when the mock flag is enabled', () => {
    expect(isMockDataEnvironmentAllowed('production', true)).toBe(false);
    expect(isMockDataEnvironmentAllowed('production', false)).toBe(false);
    expect(isMockDataEnvironmentAllowed('development', true)).toBe(true);
    expect(isMockDataEnvironmentAllowed('staging', true)).toBe(true);
    expect(isMockDataEnvironmentAllowed('development', false)).toBe(false);
  });

  it('loads fixtures only for synthetic users in an internal production build', async () => {
    Constants.expoConfig!.extra!.environment = 'production';
    Constants.expoConfig!.extra!.mockDataEnabled = false;
    Constants.expoConfig!.extra!.internalAccessEnabled = true;
    await expect(loadCanonicalMockData('real-user')).rejects.toThrow(
      'Sample accounts are unavailable',
    );
    await loadCanonicalMockData('team:dev@example.com');
    expect(await mockApiRequest('/v1/overview', {})).toMatchObject({ handled: true });
    expect(await mockApiRequest('/v1/social/invites', { method: 'POST' })).toMatchObject({
      handled: true,
      data: { code: 'GR8F' },
    });
  });

  it('persists mutations locally, reloads canonically, and clears back to live routing', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    await mockApiRequest('/v1/activation', {
      method: 'POST',
      body: JSON.stringify({ enabled: false, dailyLimitCents: 12_300 }),
    });
    const changed = await mockApiRequest('/v1/investment-policy', {});
    expect(changed).toMatchObject({
      handled: true,
      data: { enabled: false, dailyLimitCents: 12_300 },
    });
    await restoreMockData('user_a');
    expect(await mockApiRequest('/v1/investment-policy', {})).toMatchObject({
      data: { enabled: false, dailyLimitCents: 12_300 },
    });
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    expect(await mockApiRequest('/v1/investment-policy', {})).toMatchObject({
      data: { enabled: true, dailyLimitCents: 5_000 },
    });
    await clearMockData('user_a');
    expect(await mockApiRequest('/v1/overview', {})).toEqual({ handled: false });
  });

  it('persists the selected rule without changing investment consent or another account', async () => {
    await loadCanonicalMockData('rules_a');
    await mockApiRequest('/v1/activation', {
      method: 'POST',
      body: JSON.stringify({ enabled: false, dailyLimitCents: 12000 }),
    });
    await mockApiRequest('/v1/investment-policy/roundup-rule', {
      method: 'PATCH',
      body: JSON.stringify({ percentage: 10 }),
    });
    await restoreMockData('rules_a');
    expect(await mockApiRequest('/v1/investment-policy', {})).toMatchObject({
      data: {
        roundupPercentage: 10,
        roundingIncrementCents: 100,
        enabled: false,
        dailyLimitCents: 12000,
      },
    });
    await expect(
      mockApiRequest('/v1/investment-policy/roundup-rule', {
        method: 'PATCH',
        body: JSON.stringify({ percentage: 4 }),
      }),
    ).rejects.toThrow();
    await loadCanonicalMockData('rules_b');
    expect(await mockApiRequest('/v1/investment-policy', {})).not.toMatchObject({
      data: { roundupPercentage: 10 },
    });
  });

  it('never falls through an unknown mock-account endpoint', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    await expect(mockApiRequest('/v1/provider/unsafe', {})).rejects.toThrow(
      'Sample account does not support',
    );
  });

  it('runs the manual receipts flow end to end and restores the mutated fixture', async () => {
    await loadCanonicalMockData('manual_a', new Date('2026-09-13T12:00:00Z'));
    const seeded = await mockApiRequest('/v1/manual/receipts', {});
    if (!seeded.handled) throw new Error('Expected mocked receipts.');
    const page = seeded.data as {
      items: { id: string; transactionId: string | null; merchant: string | null }[];
      scanEnabled: boolean;
    };
    expect(page.items).toHaveLength(4);
    expect(page.items.filter((item) => item.transactionId)).toHaveLength(3);
    expect(page.items.find((item) => !item.transactionId)!.merchant).toBeNull();
    expect(page.scanEnabled).toBe(true);

    const merchants = await mockApiRequest('/v1/manual/merchants', {});
    if (!merchants.handled) throw new Error('Expected mocked merchants.');
    expect((merchants.data as { items: { name: string }[] }).items.length).toBeGreaterThan(10);

    const draft = await mockApiRequest('/v1/manual/receipts', {
      method: 'POST',
      body: JSON.stringify({ image: null }),
    });
    if (!draft.handled) throw new Error('Expected a mocked draft.');
    const draftId = (draft.data as { id: string }).id;
    await expect(
      mockApiRequest(`/v1/manual/receipts/${draftId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          merchant: 'Neighborhood Grocer',
          amountCents: 2_317,
          currency: 'USD',
          date: '2026-09-13',
          purchaseConfirmed: true,
        }),
      }),
    ).resolves.toMatchObject({ handled: true, data: { preview: false } });
    await expect(
      mockApiRequest(`/v1/manual/receipts/${draftId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          merchant: 'Neighborhood Grocer',
          amountCents: 2_317,
          currency: 'USD',
          date: '2026-09-13',
        }),
      }),
    ).resolves.toMatchObject({ handled: true, data: { alreadyConfirmed: true } });

    const confirmed = await mockApiRequest('/v1/manual/receipts', {});
    if (!confirmed.handled) throw new Error('Expected mocked receipts.');
    const row = (confirmed.data as { items: { id: string; roundupCents: number }[] }).items.find(
      (item) => item.id === draftId,
    );
    expect(row).toMatchObject({ roundupCents: 83, merchant: 'Neighborhood Grocer' });
    const activity = await mockApiRequest('/v1/transactions?limit=50', {});
    if (!activity.handled) throw new Error('Expected mocked activity.');
    expect(
      (activity.data as { items: { merchant: string }[] }).items.some(
        (item) => item.merchant === 'Neighborhood Grocer',
      ),
    ).toBe(true);

    // The user-created purchase must survive the restore-time validation.
    await expect(restoreMockData('manual_a')).resolves.toMatchObject({ ownerId: 'manual_a' });
    await expect(mockApiRequest('/v1/manual/receipts', {})).resolves.toMatchObject({
      handled: true,
      data: { items: expect.any(Array) },
    });
    await clearMockData('manual_a');
  });

  it('intercepts account requests before the live transport boundary', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    const overview = await apiRequest(async () => 'live-token', '/v1/overview');
    expect(overview).toMatchObject({ purchaseCount: 75 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets dev invite access codes through before sample data is active', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await apiRequest(async () => 'team-token', '/v1/social/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'BVR2' }),
    });
    expect(result).toMatchObject({ status: 'already-friends' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('paginates, searches, and filters the same canonical ledger', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    const first = await mockApiRequest('/v1/transactions?limit=30', {});
    expect(first).toMatchObject({ handled: true, data: { nextCursor: 'mock_cursor_30' } });
    if (!first.handled) throw new Error('Expected mock activity.');
    expect((first.data as { items: unknown[] }).items).toHaveLength(30);
    for (const term of ['starbucks', 'AMZN', 'pizza']) {
      const result = await mockApiRequest(`/v1/transactions?search=${term}&limit=30`, {});
      if (!result.handled) throw new Error('Expected mock search.');
      expect((result.data as { items: unknown[] }).items.length).toBeGreaterThan(0);
    }
    const all = await mockApiRequest('/v1/transactions?filter=all&limit=50', {});
    const roundups = await mockApiRequest('/v1/transactions?filter=roundups&limit=50', {});
    if (!all.handled || !roundups.handled) throw new Error('Expected mock filters.');
    expect((roundups.data as { items: { id: string }[] }).items.map((item) => item.id)).not.toEqual(
      (all.data as { items: { id: string }[] }).items.map((item) => item.id),
    );
    const visibleAll = await mockApiRequest('/v1/transactions?filter=all&limit=6', {});
    const visibleRoundups = await mockApiRequest('/v1/transactions?filter=roundups&limit=6', {});
    if (!visibleAll.handled || !visibleRoundups.handled) throw new Error('Expected mock filters.');
    expect(
      (visibleAll.data as { items: { roundupCents: number | null }[] }).items.some(
        (item) => item.roundupCents === null,
      ),
    ).toBe(true);
    expect(
      (visibleRoundups.data as { items: { roundupCents: number | null }[] }).items.every(
        (item) => item.roundupCents !== null,
      ),
    ).toBe(true);
  });

  it('rolls back activation and clear when local persistence fails', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(loadCanonicalMockData('user_a', new Date('2026-09-14T12:00:00Z'))).rejects.toThrow(
      'disk unavailable',
    );
    expect(await mockApiRequest('/v1/overview', {})).toMatchObject({ handled: true });
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(clearMockData('user_a')).rejects.toThrow('disk unavailable');
    expect(await mockApiRequest('/v1/overview', {})).toMatchObject({ handled: true });
  });

  it('does not restore one account fixture into another account', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    expect(await restoreMockData('user_b')).toBeNull();
    expect(await mockApiRequest('/v1/overview', {})).toEqual({ handled: false });
  });
});

it('adds a distinct sample bank and unlinking it preserves other selected accounts', async () => {
  await loadCanonicalMockData('review:app-store');
  const created = await mockApiRequest('/v1/bank/sample-link', {
    method: 'POST',
    body: JSON.stringify({ institutionName: 'Instant Bank' }),
  });
  expect(created).toMatchObject({
    handled: true,
    data: { institutionName: 'Instant Bank', initialSyncComplete: true },
  });
  const id = (created as { handled: true; data: { id: string } }).data.id;
  await mockApiRequest(`/v1/bank/accounts/${id}_checking`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true }),
  });
  await mockApiRequest(`/v1/bank/connections/${id}`, { method: 'DELETE' });
  const accounts = await mockApiRequest('/v1/bank/accounts', {});
  const items = (
    accounts as { handled: true; data: { items: { connectionId: string; enabled: boolean }[] } }
  ).data.items;
  expect(items.find((account) => account.connectionId === id)?.enabled).toBe(false);
  expect(items.some((account) => account.connectionId !== id && account.enabled)).toBe(true);
});
