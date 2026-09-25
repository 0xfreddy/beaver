import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void storage.set(key, value)),
    removeItem: vi.fn(async (key: string) => void storage.delete(key)),
  },
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { environment: 'development', mockDataEnabled: true } } },
}));

import { loadCanonicalMockData, mockApiRequest } from './mock-data';
import type { Balances, Holdings } from './live';

const DESTINATION = 'FREDDYTEST111111111111111111111111111111';

async function liveState() {
  const balances = await mockApiRequest('/v1/trading/balances', {});
  const holdings = await mockApiRequest('/v1/portfolio', {});
  if (!balances.handled || !holdings.handled) throw new Error('sample account not active');
  // The sample service returns live fixture references; snapshot so the
  // "before" state below is not mutated by the withdrawal itself.
  return {
    balances: structuredClone(balances.data) as Balances,
    holdings: structuredClone(holdings.data) as Holdings,
  };
}

// Mirrors the payload the withdraw screen builds for a full withdrawal:
// every holding at its sellable amount, plus all available USDC.
function fullWithdrawalPayload(holdings: Holdings, balances: Balances) {
  return {
    network: 'solana',
    destination: DESTINATION,
    cashRaw: balances.availableUsdcRaw,
    assets: holdings.items.map((item) => ({
      symbol: item.symbol,
      rawAmount: item.sellableRawAmount,
    })),
  };
}

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
});

describe('sample-account withdrawal execution', () => {
  it('converts selected stocks plus cash to a USDC total and moves the funds out', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    const before = await liveState();
    const stockCents = before.holdings.items.reduce(
      (total, item) => total + BigInt(item.valueUsdCents ?? '0'),
      0n,
    );
    const cashCents = BigInt(before.balances.availableUsdcRaw) / 10_000n;

    const receipt = await mockApiRequest('/v1/withdrawals', {
      method: 'POST',
      body: JSON.stringify(fullWithdrawalPayload(before.holdings, before.balances)),
    });

    // The conversion: stock dollar values at current prices + available cash,
    // expressed as 6-decimal USDC raw — the same math the review screen shows.
    expect(receipt).toMatchObject({
      handled: true,
      data: {
        status: 'pending',
        network: 'solana',
        totalUsdcRaw: ((stockCents + cashCents) * 10_000n).toString(),
      },
    });

    const after = await liveState();
    expect(after.holdings.items).toEqual([]);
    // Withdrawn cash leaves every USDC ledger the same way, including the
    // portfolio cash mirror; reserved funds stay behind.
    const cashRaw = BigInt(before.balances.availableUsdcRaw);
    for (const key of ['usdcRaw', 'availableUsdcRaw', 'onchainUsdcRaw'] as const) {
      expect(BigInt(after.balances[key]!)).toBe(BigInt(before.balances[key]!) - cashRaw);
    }
    expect(BigInt(after.holdings.cash.rawAmount)).toBe(
      BigInt(before.holdings.cash.rawAmount) - cashRaw,
    );
    expect(BigInt(after.balances.reservedUsdcRaw)).toBe(BigInt(before.balances.reservedUsdcRaw));
  });

  it('sells only the requested stocks and leaves USDC untouched when cash is excluded', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    const before = await liveState();
    const target = before.holdings.items[0];
    if (!target) throw new Error('canonical fixture must hold at least one stock');
    const proceeds = BigInt(target.valueUsdCents ?? '0');

    const receipt = await mockApiRequest('/v1/withdrawals', {
      method: 'POST',
      body: JSON.stringify({
        network: 'solana',
        destination: DESTINATION,
        cashRaw: null,
        assets: [{ symbol: target.symbol, rawAmount: target.sellableRawAmount }],
      }),
    });

    expect(receipt).toMatchObject({
      data: { totalUsdcRaw: (proceeds * 10_000n).toString() },
    });
    const after = await liveState();
    expect(after.holdings.items.map((item) => item.symbol)).toEqual(
      before.holdings.items.slice(1).map((item) => item.symbol),
    );
    expect(after.balances.usdcRaw).toBe(before.balances.usdcRaw);
    expect(after.balances.availableUsdcRaw).toBe(before.balances.availableUsdcRaw);
    expect(after.holdings.cash.rawAmount).toBe(before.holdings.cash.rawAmount);
  });

  it('rejects a non-Solana-shaped destination without touching the account', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    const before = await liveState();
    const payload = fullWithdrawalPayload(before.holdings, before.balances);

    await expect(
      mockApiRequest('/v1/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ ...payload, destination: '0O0Illl-not-base58' }),
      }),
    ).rejects.toThrow(/Solana wallet address/);

    const after = await liveState();
    expect(after.holdings.items).toEqual(before.holdings.items);
    expect(after.balances).toEqual(before.balances);
  });

  it('skips symbols the account does not hold instead of failing the withdrawal', async () => {
    await loadCanonicalMockData('user_a', new Date('2026-09-13T12:00:00Z'));
    const before = await liveState();
    const cashRaw = BigInt(before.balances.availableUsdcRaw);

    const receipt = await mockApiRequest('/v1/withdrawals', {
      method: 'POST',
      body: JSON.stringify({
        network: 'solana',
        destination: DESTINATION,
        cashRaw: before.balances.availableUsdcRaw,
        assets: [{ symbol: 'NOPE', rawAmount: '1000' }],
      }),
    });

    expect(receipt).toMatchObject({ data: { totalUsdcRaw: cashRaw.toString() } });
    const after = await liveState();
    expect(after.holdings.items).toEqual(before.holdings.items);
    expect(BigInt(after.balances.availableUsdcRaw)).toBe(0n);
  });
});
