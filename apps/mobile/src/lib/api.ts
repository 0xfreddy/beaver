import type { AuthSession, CryptoCard, OnchainSpendingPreview } from '@roundups/types';
import Constants from 'expo-constants';
import { mockApiRequest } from './mock-data';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const sessionRetryLimit = 4;

export function isApiUrlAllowed(url: URL, environment: unknown, developmentRuntime: boolean) {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (developmentRuntime || environment === 'development');
}

/**
 * A successful Privy login can expose the user a moment before its access token is readable.
 * Retry that hand-off, an expired-token refresh race, and temporary service failures.
 */
export function shouldRetrySession(failureCount: number, error: unknown) {
  if (failureCount >= sessionRetryLimit) return false;
  if (!(error instanceof ApiError)) return true;
  if (error.code === 'AUTH_TOKEN_NOT_READY') return true;
  if (error.code === 'API_NOT_CONFIGURED' || error.code === 'INSECURE_API_URL') return false;
  return true;
}

export function sessionRetryDelay(attemptIndex: number) {
  return Math.min(400 * 2 ** attemptIndex, 2_500);
}

/** Request a fresh token per call; the Privy SDK owns refresh and secure storage. */
export async function fetchSession(
  getAccessToken: () => Promise<string | null>,
  signal?: AbortSignal,
): Promise<AuthSession> {
  return apiRequest<AuthSession>(
    async () => {
      const token = await getAccessToken();
      if (!token)
        throw new ApiError(401, 'AUTH_TOKEN_NOT_READY', 'Finishing your sign-in. Please retry.');
      return token;
    },
    '/v1/session',
    { method: 'POST', signal },
  );
}

export async function apiRequest<T>(
  getAccessToken: () => Promise<string | null>,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!baseUrl)
    throw new ApiError(503, 'API_NOT_CONFIGURED', 'The account service is not configured.');
  const url = new URL(baseUrl);
  const developmentRuntime = typeof __DEV__ !== 'undefined' && __DEV__;
  const environment = Constants.expoConfig?.extra?.environment;
  if (!isApiUrlAllowed(url, environment, developmentRuntime))
    throw new ApiError(
      503,
      'INSECURE_API_URL',
      'The account service requires a secure connection.',
    );
  const token = await getAccessToken();
  if (options.signal?.aborted) {
    const error = new Error('The request was aborted.');
    error.name = 'AbortError';
    throw error;
  }
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  const mock = await mockApiRequest(path, options);
  if (mock.handled) return mock.data as T;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  }).catch((error: unknown) => {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      503,
      'NETWORK_ERROR',
      'Couldn’t connect. Check your connection and try again.',
    );
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'SERVICE_UNAVAILABLE',
      response.status === 401
        ? 'Your session expired. Sign in again.'
        : apiErrorMessage(body?.error?.code),
    );
  }
  return response.json() as Promise<T>;
}

export function fetchOnchainSpendingPreview(
  getAccessToken: () => Promise<string | null>,
  addresses: readonly string[],
  provider: 'etherfi' | 'tuyo' = 'etherfi',
) {
  return apiRequest<OnchainSpendingPreview>(getAccessToken, '/v1/bank/onchain-preview', {
    method: 'POST',
    body: JSON.stringify({ addresses, provider }),
  });
}

export function fetchCryptoCards(getAccessToken: () => Promise<string | null>) {
  return apiRequest<{ items: CryptoCard[] }>(getAccessToken, '/v1/bank/crypto-cards');
}

export function createCryptoCard(
  getAccessToken: () => Promise<string | null>,
  provider: 'etherfi' | 'tuyo',
  address: string,
) {
  return apiRequest<CryptoCard>(getAccessToken, '/v1/bank/crypto-cards', {
    method: 'POST',
    body: JSON.stringify({ provider, address }),
  });
}

export function deleteCryptoCard(getAccessToken: () => Promise<string | null>, id: string) {
  return apiRequest<{ removed: boolean }>(getAccessToken, `/v1/bank/crypto-cards/${id}`, {
    method: 'DELETE',
  });
}

function apiErrorMessage(code?: string) {
  const messages: Record<string, string> = {
    PURCHASE_ALREADY_RECORDED:
      'A matching purchase is already recorded. Check Activity before adding it again.',
    RECEIPT_FUNDING_REQUIRED: 'Add enough USDC to cover your roundup before adding this receipt.',
    BALANCE_UNAVAILABLE: 'Your wallet balance could not be refreshed. Please try again.',
    FUTURE_RECEIPT_DATE: 'The receipt date cannot be in the future.',
    RECEIPT_NOT_FOUND: 'This receipt is not available in your account.',
    RECEIPT_IMAGE_TOO_LARGE: 'Crop closer to the receipt and try a smaller photo.',
    RECEIPT_IMAGE_UNAVAILABLE: 'Receipt photo storage is unavailable. Try again later.',
    RECEIPT_SCAN_NOT_CONFIGURED:
      'Receipt scanning is not configured yet. Your photo is saved as a draft.',
    RECEIPT_SCAN_FAILED: 'The receipt scan failed. Retake the photo and try again.',
    RECEIPT_UNREADABLE: 'Could not read this receipt. Retake it closer to the paper and try again.',
    RECEIPT_PHOTO_REQUIRED: 'Add a receipt photo before scanning.',
    FX_RATE_UNAVAILABLE:
      'Currency rates are unavailable right now. Try confirming this purchase again shortly.',
    RECAP_EXPIRED: 'This recap has changed. Refresh your progress and try again.',
    LESSON_ANSWER_INCORRECT: 'Have another look at the explanation and try again.',
    ROUNDUP_NOT_FOUND: 'This completed roundup is no longer available.',
    POLICY_NOT_FOUND: 'Finish setting up your roundup rules first.',
    SNAPSHOT_EXPIRED: 'This leaderboard changed or expired. Refresh to see the latest.',
    INVITE_RATE_LIMIT: 'You have created 10 invitations this hour. Try again later.',
    SOCIAL_RATE_LIMIT: 'Too many requests. Wait a minute and retry.',
    INVITE_NOT_FOUND: 'That invitation is unavailable.',
    PROFILE_NOT_FOUND: 'That profile is unavailable.',
    INVALID_REQUEST: 'Check your details and try again.',

    SOLANA_NOT_CONFIGURED: 'Wallet balances are not available yet. Please try again later.',
    LINK_EXCHANGE_UNCERTAIN:
      'Your connection needs recovery. Tap Finish bank connection again shortly. If it still fails, start a new connection.',
    LINK_OWNERSHIP_MISMATCH: 'This connection does not match your account. Start again.',
    LIVE_ROUNDUPS_NOT_ENABLED: 'Live bank roundups are not enabled yet.',
    CRYPTO_CARD_NOT_FOUND: 'That crypto card address is no longer saved.',
    BANK_NOT_READY: 'Your bank connection is still being prepared. Please try again shortly.',
    MONEYKIT_RATE_LIMITED: 'Your bank needs more time before another refresh. Please try later.',
    BANK_COUNTRY_UNSUPPORTED: 'Bank connections are not supported in that country.',
    BANK_COUNTRY_UNAVAILABLE:
      'Our bank provider has no connections enabled for this country yet. Please choose another region or use manual receipts while we enable coverage.',
    ACCOUNT_NOT_READY:
      'Wait for the bank’s first sync, or reconnect the bank before selecting accounts.',
    LINK_EXPIRED: 'This bank connection expired. Start again.',
    BANK_DISCONNECTED: 'This bank is disconnected. Add a new connection.',
    TRANSACTION_NOT_FOUND: 'This purchase is unavailable in your account.',
    INSTRUMENT_UNAVAILABLE: 'This investment is not currently available.',
    INVESTMENT_ALREADY_RESERVED:
      'An order already includes this purchase. Its company cannot be changed.',
    SOLANA_WALLET_REQUIRED: 'Create your Solana wallet to continue.',
    AUTOMATION_NOT_CONFIGURED: 'Investment authorization is not configured yet.',
    WALLET_AUTHORIZATION_REQUIRED: 'Approve wallet access before enabling investments.',
    JURISDICTION_NOT_ELIGIBLE: 'Your country must be verified before funding or investing.',
    EXECUTION_NOT_CONFIGURED: 'Trading is not enabled yet.',
    SELECT_SYNCED_BANK_ACCOUNT: 'Select a synced bank account or choose Manual mode first.',
    BANK_NOT_CONFIGURED: 'Bank connections are not configured yet.',
    ONCHAIN_SPENDING_NOT_CONFIGURED: 'On-chain bank estimates are not configured yet.',
    ONCHAIN_SCAN_UNAVAILABLE: 'We couldn’t read those addresses right now. Please try again.',
    TUYO_ADDRESS_NOT_FOUND: 'No Tuyo spending account was found for that deposit address.',
    TUYO_ADDRESS_INVALID: 'That Tuyo account could not be verified. Please try again.',
    WAIT_FOR_CURRENT_ORDER: 'Wait for your current order to finish.',
    ORDER_ALREADY_SIGNED: 'This order is already signed and cannot be cancelled.',
    WITHDRAWALS_NOT_CONFIGURED: 'Withdrawals are not configured yet. Please try again later.',
    WITHDRAWAL_IN_PROGRESS:
      'A withdrawal is already on its way. Wait for it to finish before starting another.',
    WITHDRAWAL_LEG_FAILED:
      'One of the asset sales behind this withdrawal failed. Nothing was sent; please try again.',
    IDEMPOTENCY_CONFLICT:
      'This request was already submitted with different details. Check Activity before retrying.',
    CHAIN_EXECUTION_FAILED: 'The transfer failed on Solana. Nothing was lost; please retry.',
  };
  return messages[code ?? ''] ?? 'The request could not be completed. Please retry.';
}
