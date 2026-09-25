import { describe, expect, it } from 'vitest';
import type { CryptoCard, OnchainSpendingPreview } from '@roundups/types';
import type { Purchase } from './purchases';
import {
  cryptoPreviewRequests,
  recentPurchases,
  retainedOnboardingPreview,
} from './recent-purchases';

const bankPurchase: Purchase = {
  id: 'bank-purchase',
  amountCents: 425,
  currency: 'USD',
  merchant: 'Coffee shop',
  occurredAt: '2026-09-20T10:00:00.000Z',
  pending: false,
  removedAt: null,
  reason: null,
  historicalPreview: false,
  roundupCents: 75,
  symbol: 'SBUX',
  roundupStatus: 'pending',
  sourceName: 'Chase',
  cardLastFour: '1038',
};

const preview: OnchainSpendingPreview = {
  mode: 'historical_preview',
  provider: 'etherfi',
  roundingIncrementCents: 100,
  roundupPercentage: 0,
  addresses: [],
  transactions: [
    {
      id: 'optimism:0xabc',
      amountCents: 1_200,
      roundupCents: 800,
      occurredAt: '2026-09-21T10:00:00.000Z',
      chain: 'optimism',
    },
  ],
  months: [],
  averageMonthlySpentCents: 0,
  averageMonthlyRoundupCents: 0,
};

describe('recent purchases', () => {
  it('includes onboarding crypto-card transactions in chronological order', () => {
    const items = recentPurchases([bankPurchase], preview);
    expect(items.map((item) => item.id)).toEqual([
      'onchain:etherfi:optimism:0xabc',
      'bank-purchase',
    ]);
    expect(items[0]).toMatchObject({
      merchant: 'Card purchase',
      sourceName: 'EtherFi',
      cryptoCardProvider: 'etherfi',
      historicalPreview: true,
    });
  });

  it('keeps the requested display limit across both sources', () => {
    expect(recentPurchases([bankPurchase], preview, 1)).toHaveLength(1);
  });

  it('preserves the provider for each saved crypto card preview', () => {
    const tuyo = { ...preview, provider: 'tuyo' as const };
    expect(recentPurchases([], [preview, tuyo]).map((item) => item.cryptoCardProvider)).toEqual([
      'tuyo',
      'etherfi',
    ]);
  });
});

const cards: CryptoCard[] = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  provider: 'etherfi',
  address: `0x${i.toString(16).padStart(40, '0')}`,
  createdAt: '2026-09-20T00:00:00Z',
}));

describe('saved crypto previews', () => {
  it('batches within the API limit and keeps providers separate', () => {
    const requests = cryptoPreviewRequests([
      ...cards,
      cards[0]!,
      { ...cards[0]!, provider: 'tuyo' },
    ]);
    expect(requests.map((request) => [request.provider, request.addresses.length])).toEqual([
      ['etherfi', 8],
      ['etherfi', 2],
      ['tuyo', 1],
    ]);
  });

  it('does not duplicate purchases returned by overlapping previews', () => {
    expect(recentPurchases([], [preview, preview])).toHaveLength(1);
  });

  it('prefers the synced transaction over its preview twin', () => {
    const synced: Purchase = {
      ...bankPurchase,
      id: 'synced-onchain',
      merchant: 'Card purchase',
      sourceName: 'Crypto cards',
      chainHash: 'optimism:0xabc',
      roundupStatus: 'pending',
      historicalPreview: false,
      roundupCents: 100,
      occurredAt: '2026-09-21T10:00:00.000Z',
    };
    const items = recentPurchases([synced, bankPurchase], preview);
    expect(items.map((item) => item.id)).toEqual(['synced-onchain', 'bank-purchase']);
  });

  it('drops onboarding activity after a card is removed', () => {
    const onboarding = {
      ...preview,
      addresses: [
        {
          address: cards[0]!.address,
          provider: 'etherfi' as const,
          chains: [],
          months: [],
        },
      ],
    };
    expect(retainedOnboardingPreview(onboarding, undefined)).toBe(onboarding);
    expect(retainedOnboardingPreview(onboarding, cards)).toBe(onboarding);
    expect(retainedOnboardingPreview(onboarding, [])).toBeNull();
    expect(retainedOnboardingPreview(onboarding, [{ ...cards[0]!, provider: 'tuyo' }])).toBeNull();
  });
});
