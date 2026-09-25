/** API amounts stay in minor units; never recompute live roundups on the client. */
export interface Purchase {
  id: string;
  amountCents: number;
  currency: string;
  merchant: string | null;
  occurredAt: string;
  pending: boolean;
  removedAt: string | null;
  reason: string | null;
  historicalPreview: boolean;
  roundupCents: number | null;
  symbol: string | null;
  roundupStatus: string | null;
  orderStatus?: string | null;
  eligibilityStatus?: string;
  confirmedSymbol?: string | null;
  mappingMethod?: string | null;
  pendingTransactionId?: string | null;
  postedTransactionId?: string | null;
  signature?: string | null;
  sourceName?: string | null;
  sourceLogoUrl?: string | null;
  cardLastFour?: string | null;
  /** On-chain spend id (`chain:hash`) used to dedup card previews against saved transactions. */
  chainHash?: string | null;
  cryptoCardProvider?: 'etherfi' | 'tuyo';
}
export interface PurchasePage {
  items: Purchase[];
  nextCursor: string | null;
}
export function money(cents: number | string, currency = 'USD') {
  const amount = BigInt(cents);
  const absolute = amount < 0n ? -amount : amount;
  const prefix = currency === 'USD' ? '$' : `${currency} `;
  return `${amount < 0n ? '−' : ''}${prefix}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
export function purchaseStatus(item: Purchase) {
  if (item.removedAt) return 'Removed by bank';
  if (item.pending) return 'Waiting to settle';
  if (item.historicalPreview) return 'Before activation';
  return (
    roundupLabels[item.roundupStatus ?? ''] ??
    (item.reason === 'mapping_confirmation_required' ? 'Choose a company' : 'No roundup')
  );
}
export function purchaseExplanation(item: Purchase) {
  if (item.removedAt)
    return 'Your bank removed this purchase. Any completed investment is shown in Orders.';
  if (item.pending)
    return 'Your bank is still settling this purchase. No roundup has been created.';
  if (item.historicalPreview) return 'Purchased before automatic investing was enabled.';
  if (item.roundupStatus === 'preview') return 'Preview only. No money was invested.';
  if (item.roundupStatus === 'redeemed')
    return 'The investment order for this roundup is finalized.';
  if (item.roundupStatus === 'redeeming')
    return 'An order has been created. Check Orders for its confirmed status.';
  if (item.roundupStatus === 'cancelled')
    return 'This roundup was cancelled. No new investment will be made from it.';
  if (item.roundupStatus === 'execution_failed')
    return 'The investment did not complete. Check Orders for details.';
  if (item.roundupCents != null)
    return 'Set aside for automatic spot investing, subject to approval, available USDC and market minimums.';
  return item.reason
    ? `No roundup: ${item.reason.replaceAll('_', ' ')}.`
    : 'This purchase has no eligible roundup.';
}

const roundupLabels: Record<string, string> = {
  pending: 'Queued',
  below_market_minimum: 'Building toward minimum',
  redeeming: 'Order in progress',
  redeemed: 'Invested',
  execution_failed: 'Investment failed',
  cancelled: 'Cancelled',
  preview: 'Historical',
};

export function roundupStateLabel(status: string | null) {
  return status === 'preview'
    ? 'Preview'
    : (roundupLabels[status ?? ''] ?? 'Waiting for a stock match');
}

/** Only a finalized investment earns a plus amount; previews never imply funding. */
export function purchaseRoundupDisplay(item: Purchase) {
  if (item.removedAt || item.pending) return '—';
  if (item.historicalPreview || item.roundupStatus === 'preview') return 'Preview';
  if (item.roundupStatus === 'redeemed' && item.roundupCents != null)
    return `+${money(item.roundupCents, item.currency)}`;
  return purchaseStatus(item);
}
