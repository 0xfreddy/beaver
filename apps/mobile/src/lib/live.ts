import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { ApiError, apiRequest } from './api';
import type { RoundupPercentage } from '@roundups/types';

export function useLive<T>(path: string, enabled = true, refetchInterval: number | false = 15000) {
  const auth = useAuth();
  return useQuery({
    queryKey: ['live', auth.user?.id, path],
    enabled: enabled && !!auth.session && !auth.sessionError,
    queryFn: ({ signal }) => apiRequest<T>(auth.getAccessToken, path, { signal }),
    refetchInterval,
    retry: (attempt, error) =>
      path === '/v1/trading/balances' &&
      attempt < 2 &&
      (!(error instanceof ApiError) || error.status >= 500 || error.status === 429),
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
}

export interface Capabilities {
  bankConnectionEnabled: boolean;
  bankProvider?: 'moneykit' | 'saltedge';
  bankEnvironment?: 'sandbox' | 'live';
  bankCountries: string[];
  saltEdgeEnabled?: boolean;
  saltEdgeEnvironment?: 'pending' | 'test' | 'live';
  fundingEnabled: boolean;
  executionEnabled: boolean;
  executionReason: string | null;
  country: string | null;
  network: 'mainnet' | 'devnet';
  executionMode: 'live' | 'paper';
}
export interface Holdings {
  items: {
    symbol: string;
    name: string;
    rawAmount: string;
    sellableRawAmount: string;
    valueUsdCents: string | null;
    decimals?: number;
    priceUsdCents?: string;
    productType?: 'spot';
    leverage?: 1;
  }[];
  cash: { rawAmount: string; decimals: number };
  asOf: string;
}
export interface Balances {
  onchainUsdcRaw?: string;
  usdcRaw: string;
  availableUsdcRaw: string;
  reservedUsdcRaw: string;
  lamports: string;
  asOf: string;
}
export interface FundingDetails {
  address: string;
  asset: 'USDC';
  mint: string;
  decimals: 6;
  chain: 'solana';
  network: 'mainnet' | 'devnet';
  acceptedAssets: {
    asset: 'USDC' | 'SOL';
    mint: string | null;
    decimals: number;
    creditSource: 'finalized_solana_receipt' | 'finalized_solana_balance';
  }[];
}
export interface Authorization {
  address: string;
  signerId: string;
  policyId: string;
  authorized: boolean;
}
export interface InvestmentPolicy {
  fallbackSymbol?: string | null;
  fallbackConfigured?: boolean;
  spendingMode?: 'bank' | 'manual';
  roundupPercentage?: RoundupPercentage;
  roundupRuleConfigured?: boolean;
  roundingIncrementCents?: number;
  maxRoundupCents: number;
  acceptedAt?: string | null;
  enabled: boolean;
  dailyLimitCents: number;
}
export function dollars(raw: string, decimals = 6) {
  const amount = BigInt(raw);
  const cents = (amount * 100n) / 10n ** BigInt(decimals);
  return `$${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
