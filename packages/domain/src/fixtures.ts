import type { MappingRegistry, NormalizedTransaction } from '@roundups/types';
import { buildHistoricalPreview, decideRoundup } from './index';

/** Synthetic data and illustrative markets only. Never a production venue registry. */
export const demoRegistry: MappingRegistry = {
  merchants: [
    { merchant: 'Starbucks', symbol: 'SBUX', version: 1 },
    { merchant: 'Apple', symbol: 'AAPL', version: 1 },
    { merchant: 'Amazon', symbol: 'AMZN', version: 1 },
    { merchant: 'Uber', symbol: 'UBER', version: 1 },
    { merchant: 'Netflix', symbol: 'NFLX', version: 1 },
  ],
  categories: [{ primary: 'FOOD_AND_DRINK', symbol: 'CMG', version: 1 }],
  markets: [
    ['SBUX', 'Starbucks'],
    ['AAPL', 'Apple'],
    ['AMZN', 'Amazon'],
    ['UBER', 'Uber'],
    ['NFLX', 'Netflix'],
    ['CMG', 'Chipotle'],
  ].map(([symbol, name]) => ({
    symbol: symbol!,
    name: name!,
    active: true,
    minimumCollateralCents: 400,
  })),
};

export function sampleTransaction(
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction {
  return {
    id: 'demo-starbucks',
    provider: 'demo',
    providerTransactionId: 'demo-starbucks',
    pendingTransactionId: null,
    accountId: 'demo-checking',
    amountCents: 920,
    currency: 'USD',
    merchant: 'Starbucks',
    merchantEntityId: null,
    categoryPrimary: 'FOOD_AND_DRINK',
    categoryDetailed: 'COFFEE',
    occurredAt: '2026-09-08T12:00:00Z',
    pending: false,
    removed: false,
    accountEnabled: true,
    kind: 'purchase',
    paymentChannel: 'card',
    identifiableMerchant: true,
    historicalPreview: true,
    ...overrides,
  };
}

const purchases: [string, number, string][] = [
  ['Starbucks', 920, 'FOOD_AND_DRINK'],
  ['Uber', 1854, 'TRANSPORTATION'],
  ['Apple', 1840, 'SHOPPING'],
  ['Amazon', 4288, 'SHOPPING'],
  ['Joe’s Pizza', 1635, 'FOOD_AND_DRINK'],
  ['Netflix', 1599, 'ENTERTAINMENT'],
];
export const demoTransactions = Array.from({ length: 42 }, (_, index) => {
  const [merchant, amountCents, categoryPrimary] = purchases[index % purchases.length]!;
  return sampleTransaction({
    id: `demo-${index}`,
    providerTransactionId: `demo-${index}`,
    merchant,
    amountCents,
    categoryPrimary,
    occurredAt: `2026-09-${String(8 - Math.floor(index / 6)).padStart(2, '0')}T12:00:00Z`,
  });
});
demoTransactions.push(
  sampleTransaction({
    id: 'demo-transfer',
    providerTransactionId: 'demo-transfer',
    merchant: 'Savings transfer',
    kind: 'transfer',
    amountCents: 20000,
  }),
  sampleTransaction({
    id: 'demo-pending',
    providerTransactionId: 'demo-pending',
    merchant: 'Starbucks',
    pending: true,
    amountCents: 675,
  }),
  sampleTransaction({
    id: 'demo-refund',
    providerTransactionId: 'demo-refund',
    merchant: 'Amazon',
    kind: 'refund',
    amountCents: -1299,
  }),
);
export const demoPreview = buildHistoricalPreview(demoTransactions, demoRegistry);
export const demoActivity = demoTransactions.map((transaction) => ({
  transaction,
  roundup: decideRoundup(transaction, demoRegistry, null),
}));
