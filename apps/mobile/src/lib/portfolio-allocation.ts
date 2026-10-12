import type { Holdings } from './live';

/** Value only assets with a known price; unpriced holdings must not erase cash. */
export function portfolioAllocation(holdings?: Holdings) {
  if (!holdings) return [];
  const items = holdings.items
    .filter((item) => item.valueUsdCents !== null && BigInt(item.valueUsdCents) > 0n)
    .map((item) => ({ symbol: item.symbol, cents: item.valueUsdCents! }));
  const cash = (BigInt(holdings.cash.rawAmount) * 100n) / 10n ** BigInt(holdings.cash.decimals);
  if (cash > 0n) items.push({ symbol: 'USDC', cents: cash.toString() });
  return items;
}
