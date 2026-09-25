import { z } from 'zod';

export const countrySchema = z.string().regex(/^[A-Z]{2}$/);
export const SALT_EDGE_REGION_VALUES = ['us', 'europe', 'asia_pacific', 'other'] as const;
export const bankLinkSchema = z
  .object({
    country: countrySchema.optional(),
    // A region routes the link to Salt Edge; a country keeps the MoneyKit path.
    region: z.enum(SALT_EDGE_REGION_VALUES).optional(),
    providerCode: z.string().min(1).max(128).optional(),
    connectionId: z.uuid().optional(),
  })
  .refine((body) => !!body.country || !!body.region, {
    message: 'Either country or region is required.',
    path: ['country'],
  });
export const bankExchangeSchema = z.object({
  exchangeableToken: z.string().min(1).max(4096),
  linkSessionId: z.uuid(),
});
export const accountSelectionSchema = z.object({ enabled: z.boolean() });
export const evmAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/);
export const onchainSpendingPreviewSchema = z
  .object({
    addresses: z.array(evmAddressSchema).min(1).max(8),
    provider: z.enum(['etherfi', 'tuyo']).default('etherfi'),
  })
  .refine(
    ({ addresses }) =>
      new Set(addresses.map((address) => address.toLowerCase())).size === addresses.length,
    { message: 'Enter different addresses.', path: ['addresses'] },
  );
export const createCryptoCardSchema = z.object({
  provider: z.enum(['etherfi', 'tuyo']),
  address: evmAddressSchema,
});
export type CryptoCardProvider = 'etherfi' | 'tuyo';
export type CryptoCard = {
  id: string;
  provider: CryptoCardProvider;
  address: string;
  createdAt: string;
};
export type OnchainSpendingMonth = {
  month: string;
  spentCents: number;
  roundupCents: number;
  purchaseCount: number;
  roundupCount: number;
};
export type OnchainSpendingAddress = {
  address: string;
  provider: 'etherfi' | 'tuyo';
  resolvedAddress?: string;
  months: OnchainSpendingMonth[];
  chains: { id: string; label: string; transactionCount: number; error: string | null }[];
};
export type OnchainSpendingTransaction = {
  id: string;
  amountCents: number;
  roundupCents: number;
  occurredAt: string;
  chain: string;
};
export type OnchainSpendingPreview = {
  mode: 'historical_preview';
  provider: 'etherfi' | 'tuyo';
  /** Spare-change rules round to this increment; percentage rules carry their rate. */
  roundingIncrementCents: number;
  roundupPercentage: number;
  addresses: OnchainSpendingAddress[];
  transactions: OnchainSpendingTransaction[];
  months: OnchainSpendingMonth[];
  averageMonthlySpentCents: number;
  averageMonthlyRoundupCents: number;
};
export const activationSchema = z.object({
  enabled: z.boolean(),
  policyVersion: z.literal('automatic-spot-v1'),
  dailyLimitCents: z.number().int().min(1000).max(100000).default(5000),
  maxRoundupCents: z.number().int().min(30).max(10000).default(900),
});
export const mappingConfirmationSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9.]{1,16}$/),
});
const withdrawalAssetSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9.]{1,16}$/),
  rawAmount: z.string().regex(/^[1-9][0-9]{0,19}$/),
});
export const withdrawalRequestSchema = z
  .object({
    network: z.literal('solana'),
    destination: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    cashRaw: z
      .string()
      .regex(/^[0-9]{1,19}$/)
      .nullable(),
    assets: z.array(withdrawalAssetSchema).max(20),
  })
  .refine(
    ({ cashRaw, assets }) => (cashRaw !== null && BigInt(cashRaw) > 0n) || assets.length > 0,
    { message: 'Select cash or at least one asset to withdraw.', path: ['assets'] },
  )
  .refine(({ assets }) => new Set(assets.map((asset) => asset.symbol)).size === assets.length, {
    message: 'Each asset may only be withdrawn once.',
    path: ['assets'],
  });
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;
export type WithdrawalReceipt = {
  id: string;
  status: 'pending' | 'signed' | 'submitted' | 'confirmed' | 'completed' | 'failed';
  network: 'solana';
  destination: string;
  totalUsdcRaw: string | null;
  asOf: string;
};
export const notificationPreferencesSchema = z.object({
  roundupsSummary: z.boolean(),
  readyToRedeem: z.boolean(),
  bankIssues: z.boolean(),
  deposits: z.boolean(),
  trades: z.boolean(),
  riskAlerts: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const activityQuerySchema = z.object({
  filter: z.enum(['all', 'roundups', 'excluded']).default('all'),
  search: z.string().max(100).default(''),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const automaticInvestmentPolicy = Object.freeze({
  version: 'automatic-spot-v1',
  mode: 'automatic',
  productType: 'spot',
  chain: 'solana',
  leverage: 1,
  roundingIncrementCents: 100,
  maxRoundupCents: 900,
  historicalPurchasesInvested: false,
  unmappedPurchases: 'chosen_fallback_or_awaiting_confirmation',
  insufficientBalance: 'wait_for_funding',
  belowVenueMinimum: 'accumulate_same_instrument',
});

/** Zero selects whole-dollar roundups; 100 matches the purchase amount. */
export const roundupPercentages = [0, 1, 2, 3, 5, 8, 10, 20, 100] as const;
export type RoundupPercentage = (typeof roundupPercentages)[number];
export const roundupRuleSchema = z.object({
  percentage: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(5),
    z.literal(8),
    z.literal(10),
    z.literal(20),
    z.literal(100),
  ]),
});
