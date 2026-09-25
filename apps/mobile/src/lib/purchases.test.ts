import { describe, expect, it } from 'vitest';
import { money, purchaseRoundupDisplay, purchaseExplanation, purchaseStatus, type Purchase } from './purchases';
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
    expect(purchaseStatus(purchase)).toBe('Queued');
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
    expect(purchaseStatus({ ...purchase, historicalPreview: true })).toBe('Before activation');
    expect(purchaseExplanation(purchase)).toContain('automatic spot investing');
    expect(purchaseExplanation({ ...purchase, historicalPreview: true })).toContain(
      'before automatic investing was enabled',
    );
  });
  it('offers a company choice only for the server mapping-required decision', () => {
    expect(
      purchaseStatus({ ...purchase, roundupStatus: null, reason: 'mapping_confirmation_required' }),
    ).toBe('Choose a company');
    expect(purchaseStatus({ ...purchase, roundupStatus: null, reason: 'not_a_purchase' })).toBe(
      'No roundup',
    );
  });
});

it('never presents preview or unexecuted roundups as an invested amount', () => {
  expect(purchaseRoundupDisplay({ ...purchase, historicalPreview: true })).toBe('Preview');
  expect(purchaseRoundupDisplay({ ...purchase, roundupStatus: 'preview' })).toBe('Preview');
  expect(purchaseRoundupDisplay(purchase)).toBe('Queued');
  expect(purchaseRoundupDisplay({ ...purchase, roundupStatus: 'redeemed' })).toBe('+$5.35');
  expect(purchaseRoundupDisplay({ ...purchase, pending: true, roundupStatus: 'redeemed' })).toBe('—');
  expect(purchaseExplanation({ ...purchase, roundupStatus: 'preview' })).toContain('No money was invested');
});
