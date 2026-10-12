import { describe, expect, it } from 'vitest';
import {
  canCancelRoundup,
  money,
  purchaseAmount,
  purchaseRoundupDisplay,
  purchaseExplanation,
  purchaseStatus,
  needsStockChoice,
  type Purchase,
} from './purchases';
const purchase: Purchase = {
  id: 'test',
  amountCents: 465,
  currency: 'USD',
  merchant: 'Apple',
  occurredAt: '2026-09-10T00:00:00Z',
  pending: false,
  removedAt: null,
  reason: null,
  historicalPreview: false,
  roundupCents: 535,
  symbol: 'AAPL',
  roundupStatus: 'pending',
};
describe('live purchase presentation', () => {
  it('preserves exact minor units and currency, including refunds and large amounts', () => {
    expect(money('9007199254740993')).toBe('$90071992547409.93');
    expect(money(-1299)).toBe('−$12.99');
    expect(money(535, 'EUR')).toBe('EUR 5.35');
    expect(money(0)).toBe('$0.00');
  });
  it('does not label a queued or signed investment as invested', () => {
    expect(purchaseStatus(purchase)).toBe('Preparing investment');
    expect(purchaseStatus({ ...purchase, roundupStatus: 'redeeming' })).toBe('Order in progress');
    expect(purchaseStatus({ ...purchase, roundupStatus: 'redeemed' })).toBe('Invested');
  });
  it('prioritizes bank removals and pending purchases over retained order data', () => {
    expect(
      purchaseStatus({ ...purchase, removedAt: '2026-09-10', roundupStatus: 'redeemed' }),
    ).toBe('Removed by bank');
    expect(purchaseStatus({ ...purchase, pending: true })).toBe('Waiting to settle');
    expect(purchaseExplanation({ ...purchase, removedAt: '2026-09-10' })).toContain(
      'completed investment',
    );
  });
  it('keeps historical purchases distinct from active roundups', () => {
    expect(purchaseStatus({ ...purchase, historicalPreview: true })).toBe(
      'Before roundups were enabled',
    );
    expect(purchaseExplanation(purchase)).toContain('automatic spot investing');
    expect(purchaseExplanation({ ...purchase, historicalPreview: true })).toContain(
      'before automatic investing was enabled',
    );
  });
  it('offers a company choice only for the server mapping-required decision', () => {
    expect(
      purchaseStatus({ ...purchase, roundupStatus: null, reason: 'mapping_confirmation_required' }),
    ).toBe('Choose stock');
    expect(purchaseStatus({ ...purchase, roundupStatus: null, reason: 'not_a_purchase' })).toBe(
      'Transfer or refund',
    );
  });
});

it('shows actionable stock and funding states without implying execution', () => {
  const unmapped = {
    ...purchase,
    symbol: null,
    roundupStatus: null,
    reason: 'mapping_confirmation_required',
  };
  expect(needsStockChoice(unmapped)).toBe(true);
  expect(needsStockChoice({ ...unmapped, historicalPreview: true })).toBe(false);
  expect(needsStockChoice({ ...unmapped, roundupStatus: 'cancelled' })).toBe(false);
  expect(purchaseExplanation(unmapped)).toContain('fallback stock');
  expect(
    purchaseStatus({
      ...purchase,
      roundupStatus: 'redeeming',
      orderStatus: 'blocked',
      orderErrorCode: 'WAITING_FOR_FUNDING',
    }),
  ).toBe('Add funds');
  expect(
    purchaseStatus({
      ...purchase,
      roundupStatus: 'redeeming',
      orderStatus: 'confirmed',
      orderErrorCode: 'SETTLEMENT_REVIEW_REQUIRED',
    }),
  ).toBe('Investment needs review');
});

it('never presents preview or unexecuted roundups as an invested amount', () => {
  expect(purchaseRoundupDisplay({ ...purchase, historicalPreview: true })).toBe(
    'Before roundups were enabled',
  );
  expect(purchaseRoundupDisplay({ ...purchase, roundupStatus: 'preview' })).toBe('Preview');
  expect(purchaseRoundupDisplay(purchase)).toBe('Preparing investment');
  expect(purchaseRoundupDisplay({ ...purchase, roundupStatus: 'redeemed' })).toBe('+$5.35');
  expect(purchaseRoundupDisplay({ ...purchase, pending: true, roundupStatus: 'redeemed' })).toBe(
    '—',
  );
  expect(purchaseExplanation({ ...purchase, roundupStatus: 'preview' })).toContain(
    'No money was invested',
  );
});

it('only offers cancellation while a roundup is still unreserved', () => {
  expect(canCancelRoundup(purchase)).toBe(true);
  expect(canCancelRoundup({ ...purchase, roundupStatus: 'below_market_minimum' })).toBe(true);
  expect(canCancelRoundup({ ...purchase, roundupStatus: 'execution_failed' })).toBe(true);
  expect(canCancelRoundup({ ...purchase, roundupStatus: 'redeeming' })).toBe(false);
  expect(canCancelRoundup({ ...purchase, roundupStatus: 'redeemed' })).toBe(false);
  expect(canCancelRoundup({ ...purchase, roundupStatus: 'cancelled' })).toBe(false);
});

it('shows the exact original amount and the separate USD roundup currency', () => {
  const item = {
    ...purchase,
    currency: 'KWD',
    originalAmount: '12.405',
    roundupCurrency: 'USD',
    roundupCents: 59,
    roundupStatus: 'redeemed',
  };
  expect(purchaseAmount(item)).toBe('KWD 12.41');
  expect(purchaseRoundupDisplay(item)).toBe('+$0.59');
});
it('explains the retryable exchange-rate wait without implying investment', () => {
  const item = {
    ...purchase,
    reason: 'awaiting_exchange_rate',
    roundupStatus: null,
    roundupCents: null,
  };
  expect(purchaseStatus(item)).toBe('Waiting for exchange rate');
  expect(purchaseExplanation(item)).toContain('No money has been set aside yet');
});
it('displays the preserved original currency from an old-client-compatible response', () => {
  expect(
    purchaseAmount({
      ...purchase,
      currency: 'USD',
      amountCents: 1364,
      originalAmount: '12.40',
      originalCurrency: 'EUR',
    }),
  ).toBe('EUR 12.40');
});

it('explains excluded historical credits instead of showing a purchase preview', () => {
  const credit = {
    ...purchase,
    transactionType: 'credit',
    historicalPreview: true,
    roundupStatus: 'preview',
    reason: 'not_a_purchase',
  };
  expect(purchaseStatus(credit)).toBe('Money received · No roundup');
  expect(purchaseRoundupDisplay(credit)).toBe('Money received · No roundup');
  expect(purchaseExplanation(credit)).toContain('not a purchase');
});
it('does not let a historical flag hide other exclusions', () => {
  expect(purchaseStatus({ ...purchase, historicalPreview: true, roundupStatus: 'cancelled' })).toBe(
    'Cancelled',
  );
  expect(
    purchaseStatus({
      ...purchase,
      historicalPreview: true,
      roundupStatus: null,
      reason: 'exact_increment',
    }),
  ).toBe('No spare change');
});
