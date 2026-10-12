/** API amounts stay in minor units; never recompute live roundups on the client. */
export interface Purchase {
  id: string;
  amountCents: number;
  currency: string;
  originalAmount?: string | null;
  originalCurrency?: string | null;
  roundupCurrency?: string | null;
  calculationVersion?: string | null;
  usdConversion?: {
    originalAmount: string;
    currency: string;
    usdCents: number;
    usdPerUnit: string;
    source: string;
    observedAt: string;
    convertedAt: string;
  } | null;
  merchant: string | null;
  occurredAt: string;
  pending: boolean;
  transactionType?: string;
  removedAt: string | null;
  reason: string | null;
  historicalPreview: boolean;
  roundupCents: number | null;
  symbol: string | null;
  roundupStatus: string | null;
  orderStatus?: string | null;
  orderErrorCode?: string | null;
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
/** Display at most two decimals; the original value remains untouched for calculation. */
export function purchaseAmount(item: Purchase) {
  const currency = item.originalCurrency ?? item.currency;
  if (!item.originalAmount || !/^-?\d+(?:\.\d+)?$/.test(item.originalAmount))
    return money(item.amountCents, item.currency);
  const [whole, fraction = ''] = item.originalAmount.replace('-', '').split('.');
  const cents =
    BigInt(whole!) * 100n +
    BigInt(fraction.padEnd(2, '0').slice(0, 2)) +
    (Number(fraction[2] ?? 0) >= 5 ? 1n : 0n);
  return money(String(item.originalAmount.startsWith('-') ? -cents : cents), currency);
}

function nonPurchaseLabel(item: Purchase) {
  const labels: Record<string, string> = {
    credit: 'Money received',
    transfer: 'Transfer',
    refund: 'Refund',
    fee: 'Fee',
    withdrawal: 'Withdrawal',
  };
  const label = labels[item.transactionType ?? ''];
  if (label) return `${label} · No roundup`;
  if (item.transactionType && item.transactionType !== 'purchase')
    return 'Purchase not verified · No roundup';
  if (item.reason === 'not_a_purchase' || item.reason === 'non_positive_amount')
    return 'Transfer or refund';
  return null;
}

export function purchaseStatus(item: Purchase) {
  if (item.removedAt) return 'Removed by bank';
  if (item.pending) return 'Waiting to settle';
  if (item.roundupStatus === 'cancelled') return 'Cancelled';
  const excluded = nonPurchaseLabel(item);
  if (excluded) return excluded;
  if (item.reason && exclusionLabels[item.reason]) return exclusionLabels[item.reason]!;
  if (item.historicalPreview) return 'Before roundups were enabled';
  if (needsStockChoice(item)) return 'Choose stock';
  if (item.reason === 'awaiting_exchange_rate') return 'Waiting for exchange rate';
  if (item.roundupStatus === 'redeeming' && item.orderErrorCode)
    return investmentBlockLabel(item.orderErrorCode);
  return (
    roundupLabels[item.roundupStatus ?? ''] ?? exclusionLabels[item.reason ?? ''] ?? 'No roundup'
  );
}
export function purchaseExplanation(item: Purchase) {
  if (item.removedAt)
    return 'Your bank removed this transaction. Any completed investment is shown in Orders.';
  if (item.pending)
    return 'Your bank is still settling this purchase. No roundup has been created.';
  if (item.roundupStatus === 'cancelled')
    return 'This roundup was cancelled. No new investment will be made from it.';
  if (item.transactionType === 'unknown')
    return 'The bank has not identified this as a purchase. No roundup is created until it can be verified.';
  if (nonPurchaseLabel(item))
    return 'This is not a purchase. Transfers, money received and other non-purchase activity do not generate roundups.';
  if (item.reason === 'exact_increment')
    return 'Your rule produces $0.00 for this purchase, so no roundup was created.';
  if (item.historicalPreview) return 'Purchased before automatic investing was enabled.';
  if (needsStockChoice(item))
    return 'Choose a fallback stock for purchases without a stock match. Eligible purchases start investing after you save your choice.';
  if (item.roundupStatus === 'redeeming' && item.orderErrorCode)
    return investmentBlockLabel(item.orderErrorCode);
  if (item.reason === 'awaiting_exchange_rate')
    return 'We’ll calculate your USD roundup when an exchange rate is available. No money has been set aside yet.';
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
  if (item.reason === 'not_a_purchase')
    return 'Transfers, refunds and other non-purchase activity do not generate roundups.';
  if (item.reason === 'exact_increment')
    return 'Your rule produces $0.00 for this purchase, so no roundup was created.';
  return item.reason
    ? `No roundup: ${item.reason.replaceAll('_', ' ')}.`
    : 'This purchase has no eligible roundup.';
}

const exclusionLabels: Record<string, string> = {
  not_a_purchase: 'Transfer or refund',
  exact_increment: 'No spare change',
  account_disabled: 'Account turned off',
  before_account_activation: 'Before account activation',
  unsupported_currency: 'Currency unavailable',
  non_positive_amount: 'Transfer or refund',
  duplicate: 'Duplicate transaction',
};

const roundupLabels: Record<string, string> = {
  pending: 'Preparing investment',
  below_market_minimum: 'Building toward minimum',
  redeeming: 'Order in progress',
  redeemed: 'Invested',
  execution_failed: 'Investment failed',
  cancelled: 'Cancelled',
  preview: 'Historical',
};

export function needsStockChoice(item: Purchase) {
  return (
    !item.removedAt &&
    !item.pending &&
    !item.historicalPreview &&
    !['cancelled', 'redeeming', 'redeemed', 'execution_failed'].includes(
      item.roundupStatus ?? '',
    ) &&
    item.reason === 'mapping_confirmation_required'
  );
}

export function investmentBlockLabel(code: string) {
  const labels: Record<string, string> = {
    WAITING_FOR_FUNDING: 'Add funds',
    DAILY_LIMIT_REACHED: 'Daily limit reached',
    AUTOMATION_PAUSED: 'Investing paused',
    WALLET_NOT_LINKED: 'Connect wallet',
    WALLET_AUTHORIZATION_REQUIRED: 'Authorize wallet',
    BANK_NOT_READY: 'Reconnect bank',
    INSTRUMENT_UNAVAILABLE: 'Stock unavailable',
    QUOTE_UNAVAILABLE: 'Waiting for a market quote',
    QUOTE_RATE_LIMITED: 'Waiting for a market quote',
    ORDER_IN_PROGRESS: 'Confirming previous investment',
    SETTLEMENT_REVIEW_REQUIRED: 'Investment needs review',
  };
  return labels[code] ?? 'Investment needs attention';
}

export function roundupStateLabel(status: string | null) {
  return status === 'preview'
    ? 'Preview'
    : (roundupLabels[status ?? ''] ?? 'Waiting for a stock match');
}

/** Only a finalized investment earns a plus amount; previews never imply funding. */
export function purchaseRoundupDisplay(item: Purchase) {
  if (item.removedAt || item.pending) return '—';
  if (
    item.roundupStatus === 'cancelled' ||
    nonPurchaseLabel(item) ||
    (item.reason && exclusionLabels[item.reason])
  )
    return purchaseStatus(item);
  if (item.historicalPreview) return purchaseStatus(item);
  if (item.roundupStatus === 'preview') return 'Preview';
  if (item.roundupStatus === 'redeemed' && item.roundupCents != null)
    return `+${money(item.roundupCents, item.roundupCurrency ?? item.currency)}`;
  return purchaseStatus(item);
}

export function canCancelRoundup(item: Purchase) {
  return ['pending', 'below_market_minimum', 'execution_failed'].includes(item.roundupStatus ?? '');
}
