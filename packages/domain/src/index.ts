import type {
  MappingDecision,
  MappingRegistry,
  NormalizedTransaction,
  Roundup,
  RoundupPercentage,
} from '@roundups/types';
import { roundupPercentages } from '@roundups/types';

export const REDEEM_THRESHOLD_CENTS = 1000;
export const FIXED_LEVERAGE = 3;

/** Financial calculations accept integer minor units, never binary floating-point dollars. */
export function calculateRoundup(amountCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    throw new RangeError('Expected non-negative safe integer cents');
  return (100 - (amountCents % 100)) % 100;
}

export function parseUsdCents(value: string): number {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value))
    throw new RangeError('Expected a USD decimal with at most two places');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new RangeError('Amount out of range');
  return value.startsWith('-') ? -cents : cents;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function eligibility(transaction: NormalizedTransaction): {
  eligible: boolean;
  reason: string;
} {
  const excluded = (reason: string) => ({ eligible: false, reason });
  if (transaction.removed) return excluded('removed');
  if (transaction.pending) return excluded('not_posted');
  if (!transaction.accountEnabled) return excluded('account_disabled');
  if (transaction.currency !== 'USD') return excluded('unsupported_currency');
  if (!Number.isSafeInteger(transaction.amountCents) || transaction.amountCents <= 0)
    return excluded('not_a_purchase_amount');
  if (!['purchase', 'subscription', 'utility'].includes(transaction.kind))
    return excluded(transaction.kind);
  if (!transaction.identifiableMerchant) return excluded('unidentified_merchant');
  return { eligible: true, reason: 'eligible_purchase' };
}

export function normalizeMerchant(value: string): string {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function resolveMarket(
  transaction: NormalizedTransaction,
  registry: MappingRegistry,
): MappingDecision | null {
  const direct = registry.merchants.find(
    (mapping) => normalizeMerchant(mapping.merchant) === normalizeMerchant(transaction.merchant),
  );
  const entity = transaction.merchantEntityId
    ? registry.merchants.find((mapping) => mapping.entityId === transaction.merchantEntityId)
    : undefined;
  const category =
    registry.categories.find(
      (mapping) =>
        mapping.primary === transaction.categoryPrimary &&
        mapping.detailed === transaction.categoryDetailed,
    ) ??
    registry.categories.find(
      (mapping) => mapping.primary === transaction.categoryPrimary && !mapping.detailed,
    );
  // A direct match is authoritative. An unsupported direct market must not silently become another instrument.
  const mapping = direct ?? entity ?? category;
  if (
    !mapping ||
    !registry.markets.some((market) => market.symbol === mapping.symbol && market.active)
  )
    return null;
  return {
    symbol: mapping.symbol,
    method: direct ? 'direct' : entity ? 'entity' : 'category',
    version: mapping.version,
  };
}

export function decideRoundup(
  transaction: NormalizedTransaction,
  registry: MappingRegistry,
  enabledAt: string | null,
): Roundup | null {
  if (!eligibility(transaction).eligible) return null;
  const mapping = resolveMarket(transaction, registry);
  const amountCents = calculateRoundup(transaction.amountCents);
  if (!mapping || amountCents === 0) return null;
  const occurred = Date.parse(transaction.occurredAt);
  const activated = enabledAt === null ? NaN : Date.parse(enabledAt);
  if (!Number.isFinite(occurred)) throw new RangeError('Invalid transaction timestamp');
  if (enabledAt !== null && !Number.isFinite(activated))
    throw new RangeError('Invalid activation timestamp');
  const historicalPreview =
    transaction.historicalPreview || enabledAt === null || occurred <= activated;
  return {
    transactionId: transaction.id,
    amountCents,
    symbol: mapping.symbol,
    mappingMethod: mapping.method,
    mappingVersion: mapping.version,
    historicalPreview,
    status: historicalPreview ? 'preview' : 'pending',
  };
}

export function summarizeRoundups(roundups: readonly Roundup[], registry: MappingRegistry) {
  const pending = roundups.filter(
    (r) => !r.historicalPreview && ['pending', 'below_market_minimum'].includes(r.status),
  );
  const buckets = new Map<string, number>();
  for (const r of pending) buckets.set(r.symbol, (buckets.get(r.symbol) ?? 0) + r.amountCents);
  const pendingTotalCents = pending.reduce((total, r) => total + r.amountCents, 0);
  const markets = [...buckets].map(([symbol, amountCents]) => {
    const market = registry.markets.find((m) => m.symbol === symbol && m.active);
    return {
      symbol,
      amountCents,
      meetsMinimum: !!market && amountCents >= market.minimumCollateralCents,
    };
  });
  return {
    pendingTotalCents,
    thresholdCents: REDEEM_THRESHOLD_CENTS,
    thresholdReached: pendingTotalCents >= REDEEM_THRESHOLD_CENTS,
    markets,
  };
}

/** Eligibility only; no order construction or venue execution exists in Foundation. */
export function canRedeem(roundups: readonly Roundup[], registry: MappingRegistry): boolean {
  const summary = summarizeRoundups(roundups, registry);
  return summary.thresholdReached && summary.markets.some((m) => m.meetsMinimum);
}

/** A removal/refund cancels only unexecuted decisions. Never closes or alters a redeemed position. */
export function cancelUnexecuted(roundup: Roundup): Roundup {
  return ['preview', 'pending', 'below_market_minimum', 'execution_failed'].includes(roundup.status)
    ? { ...roundup, status: 'cancelled' }
    : roundup;
}

export function buildHistoricalPreview(
  transactions: readonly NormalizedTransaction[],
  registry: MappingRegistry,
) {
  const unique = new Map(
    transactions.map((transaction) => [
      `${transaction.provider}:${transaction.providerTransactionId}`,
      transaction,
    ]),
  );
  const roundups = [...unique.values()].flatMap((transaction) => {
    const roundup = decideRoundup({ ...transaction, historicalPreview: true }, registry, null);
    return roundup ? [roundup] : [];
  });
  const buckets = new Map<string, number>();
  for (const r of roundups) buckets.set(r.symbol, (buckets.get(r.symbol) ?? 0) + r.amountCents);
  return {
    totalCents: roundups.reduce((sum, r) => sum + r.amountCents, 0),
    purchaseCount: roundups.length,
    markets: [...buckets]
      .map(([symbol, amountCents]) => ({ symbol, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents),
    roundups,
  };
}

/** Whole-dollar spare change, or a percentage rounded half-up to the nearest cent. */
export function calculateRoundupCents(cents: number, percentage: RoundupPercentage = 0) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError('Invalid purchase cents');
  if (!roundupPercentages.includes(percentage)) throw new RangeError('Invalid roundup percentage');
  if (percentage === 0) return (100 - (cents % 100)) % 100;
  return Number((BigInt(cents) * BigInt(percentage) + 50n) / 100n);
}

export type RoundupRule = {
  percentage: number;
  incrementCents: number;
  maxRoundupCents: number;
};

/** The single roundup formula shared by bank sync, manual receipts, and crypto cards:
 * percentage rules take a share of the purchase, spare-change rules invest the
 * difference to the next increment, and every result respects the cap. */
export function ruleRoundupCents(purchaseCents: number, rule: RoundupRule) {
  if (!Number.isSafeInteger(purchaseCents) || purchaseCents < 0)
    throw new RangeError('Invalid purchase cents');
  const calculated = rule.percentage
    ? Number((BigInt(purchaseCents) * BigInt(rule.percentage) + 50n) / 100n)
    : (rule.incrementCents - (purchaseCents % rule.incrementCents)) % rule.incrementCents;
  return Math.min(calculated, rule.maxRoundupCents);
}