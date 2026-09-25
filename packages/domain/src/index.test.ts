import { describe, expect, it } from 'vitest';
import {
  buildHistoricalPreview,
  calculateRoundup,
  cancelUnexecuted,
  canRedeem,
  decideRoundup,
  eligibility,
  parseUsdCents,
  resolveMarket,
  summarizeRoundups,
} from './index';
import { demoRegistry, sampleTransaction } from './fixtures';
import { transactionKinds } from '@roundups/types';

describe('roundup money', () => {
  it.each([
    [920, 80],
    [999, 1],
    [1000, 0],
    [1891, 9],
    [0, 0],
  ])('%i cents rounds up by %i', (amount, expected) =>
    expect(calculateRoundup(amount)).toBe(expected),
  );
  it.each([-1, 9.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid minor units: %s',
    (value) => expect(() => calculateRoundup(value)).toThrow(),
  );
  it('parses decimals without rounding errors', () => {
    expect(parseUsdCents('9.20')).toBe(920);
    expect(parseUsdCents('-0.09')).toBe(-9);
    expect(() => parseUsdCents('9.201')).toThrow();
  });
});

describe('eligibility and immutable decisions', () => {
  it.each(
    transactionKinds.filter((kind) => !['purchase', 'subscription', 'utility'].includes(kind)),
  )('excludes %s regardless of rail', (kind) => {
    expect(eligibility(sampleTransaction({ kind, paymentChannel: 'card' })).eligible).toBe(false);
  });
  it.each(['ach', 'paypal', 'venmo'] as const)(
    'accepts identified merchant purchases on %s',
    (paymentChannel) => {
      expect(eligibility(sampleTransaction({ paymentChannel })).eligible).toBe(true);
      expect(
        eligibility(sampleTransaction({ paymentChannel, identifiableMerchant: false })).eligible,
      ).toBe(false);
    },
  );
  it('excludes pending, removed, disabled and foreign currency transactions', () => {
    for (const overrides of [
      { pending: true },
      { removed: true },
      { accountEnabled: false },
      { currency: 'AED' },
    ]) {
      expect(decideRoundup(sampleTransaction(overrides), demoRegistry, null)).toBeNull();
    }
  });
  it('gives direct mapping priority over category and preserves version', () => {
    expect(resolveMarket(sampleTransaction(), demoRegistry)).toEqual({
      symbol: 'SBUX',
      method: 'direct',
      version: 1,
    });
    expect(resolveMarket(sampleTransaction({ merchant: 'Local cafe' }), demoRegistry)?.symbol).toBe(
      'CMG',
    );
  });
  it('uses entity before category and refuses an unavailable direct market', () => {
    const registry = {
      ...demoRegistry,
      merchants: [
        { merchant: 'Different name', entityId: 'starbucks-entity', symbol: 'SBUX', version: 8 },
      ],
    };
    expect(
      resolveMarket(sampleTransaction({ merchantEntityId: 'starbucks-entity' }), registry)?.method,
    ).toBe('entity');
    expect(
      resolveMarket(sampleTransaction(), {
        ...demoRegistry,
        markets: demoRegistry.markets.filter((m) => m.symbol !== 'SBUX'),
      }),
    ).toBeNull();
  });
  it('keeps historical imports preview-only regardless of activation date', () => {
    expect(decideRoundup(sampleTransaction(), demoRegistry, '2020-01-01T00:00:00Z')?.status).toBe(
      'preview',
    );
  });
  it('requires a strictly later occurrence timestamp for live pending', () => {
    const tx = sampleTransaction({ historicalPreview: false });
    expect(decideRoundup(tx, demoRegistry, tx.occurredAt)?.status).toBe('preview');
    expect(decideRoundup(tx, demoRegistry, '2026-09-07T12:00:00Z')?.status).toBe('pending');
    expect(decideRoundup(tx, demoRegistry, null)?.status).toBe('preview');
    expect(() => decideRoundup(tx, demoRegistry, 'invalid')).toThrow();
  });
  it('deduplicates provider transaction identifiers in previews', () => {
    const tx = sampleTransaction();
    expect(buildHistoricalPreview([tx, tx], demoRegistry).totalCents).toBe(80);
  });
  it('does not cancel redeemed or in-flight decisions', () => {
    const r = decideRoundup(sampleTransaction(), demoRegistry, null)!;
    expect(cancelUnexecuted(r).status).toBe('cancelled');
    expect(cancelUnexecuted({ ...r, status: 'redeemed' }).status).toBe('redeemed');
    expect(cancelUnexecuted({ ...r, status: 'redeeming' }).status).toBe('redeeming');
  });
  it('never counts previews or in-flight amounts toward redemption', () => {
    const preview = buildHistoricalPreview([sampleTransaction()], demoRegistry);
    expect(summarizeRoundups(preview.roundups, demoRegistry).pendingTotalCents).toBe(0);
    expect(canRedeem(preview.roundups, demoRegistry)).toBe(false);
  });
  it('requires both global threshold and a market minimum', () => {
    const base = {
      ...decideRoundup(sampleTransaction(), demoRegistry, null)!,
      status: 'pending' as const,
      historicalPreview: false,
    };
    expect(canRedeem([{ ...base, amountCents: 999 }], demoRegistry)).toBe(false);
    expect(canRedeem([{ ...base, amountCents: 1000 }], demoRegistry)).toBe(true);
    const fragmented = ['SBUX', 'AAPL', 'AMZN', 'UBER'].map((symbol) => ({
      ...base,
      symbol,
      amountCents: 250,
    }));
    expect(canRedeem(fragmented, demoRegistry)).toBe(false);
  });
});
