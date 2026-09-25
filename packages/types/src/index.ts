import { z } from 'zod';
export type { AuthSession, VerifiedIdentity } from './auth';
export * from './backend';
export { backendOpenApi } from './openapi';

export const transactionKinds = [
  'purchase',
  'subscription',
  'utility',
  'transfer',
  'p2p',
  'credit_card_payment',
  'atm',
  'cash_advance',
  'bank_fee',
  'tax',
  'mortgage',
  'loan_payment',
  'investment_transfer',
  'crypto',
  'refund',
  'reversal',
  'rent',
  'unknown',
] as const;

export const transactionSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  providerTransactionId: z.string().min(1),
  pendingTransactionId: z.string().nullable(),
  accountId: z.string().min(1),
  amountCents: z.number().int().safe(),
  currency: z.string().length(3),
  merchant: z.string(),
  merchantEntityId: z.string().nullable(),
  categoryPrimary: z.string().nullable(),
  categoryDetailed: z.string().nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
  pending: z.boolean(),
  removed: z.boolean(),
  accountEnabled: z.boolean(),
  kind: z.enum(transactionKinds),
  paymentChannel: z.enum(['card', 'online', 'ach', 'paypal', 'venmo', 'other']),
  identifiableMerchant: z.boolean(),
  historicalPreview: z.boolean(),
});
export type NormalizedTransaction = z.infer<typeof transactionSchema>;

export type Market = {
  symbol: string;
  name: string;
  active: boolean;
  minimumCollateralCents: number;
};
export type MerchantMapping = {
  merchant: string;
  entityId?: string;
  symbol: string;
  version: number;
};
export type CategoryMapping = {
  primary: string;
  detailed?: string;
  symbol: string;
  version: number;
};
export type MappingRegistry = {
  merchants: readonly MerchantMapping[];
  categories: readonly CategoryMapping[];
  markets: readonly Market[];
};
export type MappingDecision = {
  symbol: string;
  method: 'direct' | 'entity' | 'category';
  version: number;
};
export type RoundupStatus =
  | 'preview'
  | 'pending'
  | 'below_market_minimum'
  | 'redeeming'
  | 'redeemed'
  | 'execution_failed'
  | 'cancelled';
export type Roundup = {
  transactionId: string;
  amountCents: number;
  symbol: string;
  mappingMethod: MappingDecision['method'];
  mappingVersion: number;
  status: RoundupStatus;
  historicalPreview: boolean;
};

export const featureFlagsSchema = z.object({
  bankConnectionEnabled: z.boolean(),
  liveRoundupsEnabled: z.boolean(),
  fundingEnabled: z.boolean(),
  redemptionEnabled: z.boolean(),
  executionEnabled: z.boolean(),
  hyperliquidEnabled: z.boolean(),
  lighterEnabled: z.boolean(),
});
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});
export * from './social';

export * from './retention';
