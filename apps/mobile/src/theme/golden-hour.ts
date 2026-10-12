/** Decorative progress only. Never combines different currencies or market minimums. */
export type GoldenBucket = {
  currency: string;
  symbol: string;
  status: string;
  amountCents: string;
};
export type GoldenMarket = { symbol: string; minimumInputCents: number | string };
export const goldenPalettes = {
  resting: ['#B9C8DE', '#CAC5E3', '#DED6DF', '#EFDCBA'],
  accumulating: ['#ABC0D6', '#C7CEE0', '#EBD3AB', '#FFC16A'],
  confirmed: ['#C3BDD9', '#DEBDD2', '#F2C4B6', '#F6C887'],
} as const;
export function goldenProgress(buckets: GoldenBucket[], markets: GoldenMarket[], enabled: boolean) {
  if (!enabled) return 0;
  const totals = new Map<string, bigint>();
  for (const b of buckets) {
    if (
      b.currency !== 'USD' ||
      !['pending', 'below_market_minimum', 'redeeming'].includes(b.status) ||
      !/^\d+$/.test(b.amountCents)
    )
      continue;
    totals.set(b.symbol, (totals.get(b.symbol) ?? 0n) + BigInt(b.amountCents));
  }
  let progress = 0;
  for (const market of markets) {
    const raw = String(market.minimumInputCents);
    if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) continue;
    const minimum = BigInt(raw);
    const amount = totals.get(market.symbol) ?? 0n;
    progress = Math.max(
      progress,
      Number(((amount >= minimum ? minimum : amount) * 1000n) / minimum) / 1000,
    );
  }
  return progress;
}
export type GoldenOrder = { id: string; side: string; status: string };
/** Initial history establishes a baseline; only subsequent confirmed buys bloom. */
export function newGoldenConfirmations(orders: GoldenOrder[], seen: ReadonlySet<string> | null) {
  const confirmed = orders
    .filter((o) => o.side === 'buy' && o.status === 'confirmed')
    .map((o) => o.id);
  return {
    ids: new Set([...(seen ?? []), ...confirmed]),
    bloom: seen !== null && confirmed.some((id) => !seen.has(id)),
  };
}
