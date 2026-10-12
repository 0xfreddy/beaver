import type { Balances, Holdings } from './live';

export interface AllocationBucket {
  currency: string;
  status: string;
  amountCents: string;
}
/** Pending instructions are not extra assets. Partition existing cash without double counting. */
export function homeAllocation(
  holdings?: Holdings,
  balances?: Balances,
  buckets: AllocationBucket[] = [],
) {
  const markets = (holdings?.items ?? [])
    .filter((item) => BigInt(item.rawAmount) > 0n && item.valueUsdCents !== null)
    .map((item) => ({ symbol: item.symbol, amountCents: Number(item.valueUsdCents) }));
  // Use the portfolio snapshot for both screens. Reservation data only partitions
  // that cash; a separately refreshed balance must not change the allocation total.
  const totalCash = holdings
    ? (BigInt(holdings.cash.rawAmount) * 1000000n) / 10n ** BigInt(holdings.cash.decimals)
    : balances
      ? BigInt(balances.usdcRaw)
      : 0n;
  const reserved = balances ? BigInt(balances.reservedUsdcRaw) : 0n;
  const held = reserved < totalCash ? reserved : totalCash;
  const available = totalCash - held;
  const pendingCents = buckets
    .filter((b) => b.currency === 'USD' && ['pending', 'below_market_minimum'].includes(b.status))
    .reduce((sum, b) => sum + BigInt(b.amountCents), 0n);
  const pendingRaw = pendingCents * 10000n;
  const allocated = pendingRaw < available ? pendingRaw : available;
  const pending = (held + allocated) / 10000n;
  const cash = totalCash / 10000n - pending;
  if (cash > 0n) markets.push({ symbol: 'USDC', amountCents: Number(cash) });
  if (pending > 0n) markets.push({ symbol: 'PENDING', amountCents: Number(pending) });
  return {
    markets,
    unfundedCents: Number((pendingRaw - allocated) / 10000n),
    awaitingConversion: buckets.some(
      (b) =>
        b.currency !== 'USD' &&
        ['pending', 'below_market_minimum'].includes(b.status) &&
        BigInt(b.amountCents) > 0n,
    ),
  };
}
