import { expect, it } from 'vitest';
import { homeAllocation } from './home-allocation';
const balance = {
  availableUsdcRaw: '1569660',
  usdcRaw: '1569660',
  reservedUsdcRaw: '0',
  lamports: '0',
  asOf: '',
};
it('shows a cash-only wallet instead of an empty pending-roundup chart', () => {
  expect(homeAllocation(undefined, balance).markets).toEqual([
    { symbol: 'USDC', amountCents: 156 },
  ]);
});
it('partitions cash into pending, preserving the total instead of adding planned money', () => {
  const result = homeAllocation(undefined, balance, [
    { currency: 'USD', status: 'pending', amountCents: '50' },
  ]);
  expect(result.markets).toEqual([
    { symbol: 'USDC', amountCents: 106 },
    { symbol: 'PENDING', amountCents: 50 },
  ]);
});
it('includes holdings and reserved cash once and identifies unfunded instructions', () => {
  const result = homeAllocation(
    {
      items: [
        {
          symbol: 'AAPL',
          name: 'Apple',
          rawAmount: '1',
          sellableRawAmount: '1',
          valueUsdCents: '400',
        },
      ],
      cash: { rawAmount: '1500000', decimals: 6 },
      asOf: '',
    },
    { ...balance, availableUsdcRaw: '1000000', usdcRaw: '1500000', reservedUsdcRaw: '500000' },
    [
      { currency: 'USD', status: 'pending', amountCents: '200' },
      { currency: 'EUR', status: 'pending', amountCents: '100' },
      { currency: 'USD', status: 'redeemed', amountCents: '400' },
    ],
  );
  expect(result.markets).toEqual([
    { symbol: 'AAPL', amountCents: 400 },
    { symbol: 'PENDING', amountCents: 150 },
  ]);
  expect(result.unfundedCents).toBe(100);
  expect(result.awaitingConversion).toBe(true);
});
it('does not count a stale reservation exceeding remaining on-chain cash', () => {
  expect(
    homeAllocation(undefined, {
      ...balance,
      availableUsdcRaw: '0',
      usdcRaw: '0',
      reservedUsdcRaw: '500000',
    }).markets,
  ).toEqual([]);
});

it('uses the same cash snapshot and cent precision as Portfolio', () => {
  const holdings = {
    items: [
      {
        symbol: 'AAPL',
        name: 'Apple',
        rawAmount: '1',
        sellableRawAmount: '1',
        valueUsdCents: '22',
      },
    ],
    cash: { rawAmount: '1569660', decimals: 6 },
    asOf: '',
  };
  const result = homeAllocation(holdings, { ...balance, usdcRaw: '2000000' }, [
    { currency: 'USD', status: 'pending', amountCents: '50' },
  ]);
  expect(result.markets).toEqual([
    { symbol: 'AAPL', amountCents: 22 },
    { symbol: 'USDC', amountCents: 106 },
    { symbol: 'PENDING', amountCents: 50 },
  ]);
});
