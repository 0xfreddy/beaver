import { expect, it } from 'vitest';
import { portfolioAllocation } from './portfolio-allocation';
import type { Holdings } from './live';
const holdings: Holdings = {
  asOf: '2026-10-11T00:00:00Z',
  cash: { rawAmount: '1569660', decimals: 6 },
  items: [
    { symbol: 'AAPL', name: 'Apple', rawAmount: '1', sellableRawAmount: '1', valueUsdCents: null },
  ],
};
it('keeps cash visible when the only stock has no quote, matching the device report', () => {
  expect(portfolioAllocation(holdings)).toEqual([{ symbol: 'USDC', cents: '156' }]);
});
it('includes valued stocks and cash once each', () => {
  expect(
    portfolioAllocation({ ...holdings, items: [{ ...holdings.items[0]!, valueUsdCents: '500' }] }),
  ).toEqual([
    { symbol: 'AAPL', cents: '500' },
    { symbol: 'USDC', cents: '156' },
  ]);
});
it('distinguishes no allocations from loading without inventing stock values', () => {
  expect(portfolioAllocation()).toEqual([]);
  expect(portfolioAllocation({ ...holdings, cash: { rawAmount: '0', decimals: 6 } })).toEqual([]);
});
