import { describe, expect, it } from 'vitest';
import {
  MOCK_FIXTURE_VERSION,
  buildMockFixture,
  mockPendingAllocationCents,
  validateMockFixture,
} from './mock-fixture';

const anchor = new Date('2026-09-13T16:00:00+04:00');

describe('full sample account fixture', () => {
  it('is deterministic, versioned, account scoped, and uses reserved IDs', () => {
    const first = buildMockFixture('user_a', anchor);
    const second = buildMockFixture('user_a', anchor);
    expect(first).toEqual(second);
    expect(first.version).toBe(MOCK_FIXTURE_VERSION);
    expect(first.ownerId).toBe('user_a');
    expect(validateMockFixture(first, 'user_a')).toBe(true);
    expect(validateMockFixture(first, 'user_b')).toBe(false);
    expect(first.transactions.every((item) => item.id.startsWith('mock_'))).toBe(true);
    expect(first.orders.every((item) => item.id.startsWith('mock_'))).toBe(true);
    expect(first.accounts.every((item) => item.id.startsWith('mock_'))).toBe(true);
  });

  it('contains the complete transaction history from the PRD', () => {
    const fixture = buildMockFixture('user_a', anchor);
    expect(fixture.transactions).toHaveLength(75);
    expect(
      fixture.transactions.filter((item) => item.id.startsWith('mock_tx_active_')),
    ).toHaveLength(48);
    expect(
      fixture.transactions.filter((item) => item.id.startsWith('mock_tx_historical_')),
    ).toHaveLength(8);
    expect(
      fixture.transactions.filter((item) => item.id.startsWith('mock_tx_pending_')),
    ).toHaveLength(5);
    expect(
      fixture.transactions.filter((item) => item.id.startsWith('mock_tx_excluded_')),
    ).toHaveLength(11);
    expect(
      fixture.transactions.filter((item) => item.id.startsWith('mock_tx_manual_')),
    ).toHaveLength(3);
    expect(mockPendingAllocationCents(fixture)).toBe(6_542);
    const allocation = fixture.transactions.reduce<Record<string, number>>((result, item) => {
      if (
        item.symbol &&
        item.roundupCents &&
        ['pending', 'below_market_minimum'].includes(item.roundupStatus ?? '')
      )
        result[item.symbol] = (result[item.symbol] ?? 0) + item.roundupCents;
      return result;
    }, {});
    expect(allocation).toEqual({
      SBUX: 1_835,
      AMZN: 1_420,
      AAPL: 1_220,
      UBER: 875,
      NFLX: 612,
      CMG: 580,
    });
    expect(fixture.transactions.slice(0, 3).map((item) => item.symbol)).toEqual([
      'SBUX',
      'AAPL',
      'AMZN',
    ]);
    expect(fixture.transactions[0]?.merchant).toBe(
      'Long Merchant Name International Terminal Café',
    );
    expect(
      fixture.transactions.find((item) => item.merchant === 'Neighborhood Florist'),
    ).toMatchObject({ amountCents: 3_870, reason: 'mapping_confirmation_required' });
    expect(
      fixture.transactions.find(
        (item) => item.merchant === 'Starbucks' && item.amountCents === 675,
      ),
    ).toMatchObject({ pending: true, roundupCents: null });
    expect(fixture.transactions.some((item) => item.amountCents === 1)).toBe(true);
    expect(fixture.transactions.some((item) => item.amountCents === 999)).toBe(true);
    expect(fixture.transactions.some((item) => item.amountCents === 3_000)).toBe(true);
    expect(fixture.transactions.some((item) => item.amountCents === 99_999)).toBe(true);
  });

  it('balances wallet cash, reserves, holdings, orders, and social data', () => {
    const fixture = buildMockFixture('user_a', anchor);
    expect(fixture.balances.usdcRaw).toBe('250000000');
    expect(fixture.balances.reservedUsdcRaw).toBe('22500000');
    expect(fixture.balances.availableUsdcRaw).toBe('227500000');
    expect(fixture.balances.lamports).toBe('28000000');
    expect(fixture.holdings.items.reduce((sum, item) => sum + Number(item.valueUsdCents), 0)).toBe(
      58_500,
    );
    expect(fixture.holdings.items.map((item) => [item.symbol, item.valueUsdCents])).toEqual([
      ['AAPL', '18640'],
      ['AMZN', '13275'],
      ['SBUX', '9420'],
      ['UBER', '7310'],
      ['NFLX', '5685'],
      ['CMG', '4170'],
    ]);
    expect(fixture.orders.reduce((sum, order) => sum + order.reservedCents, 0)).toBe(2_250);
    expect(fixture.orders).toHaveLength(10);
    expect(
      fixture.orders.filter((order) => order.status === 'confirmed' && order.side === 'buy'),
    ).toHaveLength(4);
    expect(
      fixture.orders.filter((order) => order.status === 'confirmed' && order.side === 'sell'),
    ).toHaveLength(1);
    expect(fixture.depositReceipts).toHaveLength(4);
    expect(fixture.manualReceipts).toHaveLength(4);
    expect(fixture.manualReceipts.filter((item) => item.transactionId)).toHaveLength(3);
    expect(fixture.manualReceipts.filter((item) => !item.transactionId)).toHaveLength(1);
    expect(fixture.cryptoCard).toMatchObject({ provider: 'EtherFi', label: 'EtherFi Cash' });
    expect(fixture.achievements.definitions).toHaveLength(27);
    expect(fixture.achievements.awards).toHaveLength(4);
    expect(fixture.achievements.distinctFriends).toBe(5);
    expect(fixture.globalLeaderboard.rows).toHaveLength(12);
    expect(fixture.friendsLeaderboard.rows).toHaveLength(6);
    expect(new Set(fixture.globalLeaderboard.rows.map((row) => row.rank)).size).toBeLessThan(12);
  });
});
