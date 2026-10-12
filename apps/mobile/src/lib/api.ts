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

/** Aborts with a TimeoutError reason, which apiRequest reports as REQUEST_TIMEOUT. */
export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(
    () =>
      controller.abort(
        Object.assign(new Error('The request timed out.'), { name: 'TimeoutError' }),
      ),
    ms,
  );
  return controller.signal;
}

function timeoutAbort(signal: AbortSignal | undefined | null) {
  return (
    !!signal?.aborted && (signal.reason as { name?: string } | undefined)?.name === 'TimeoutError'
  );
}

export function isApiUrlAllowed(url: URL, environment: unknown, developmentRuntime: boolean) {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && (developmentRuntime || environment === 'development');
}

/** Bound token acquisition, transport and response parsing, including native promises that ignore abort. */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () =>
    controller.abort(
      parent?.reason ??
        Object.assign(new Error('The request was aborted.'), { name: 'AbortError' }),
    );
  if (parent?.aborted) cancel();
  parent?.addEventListener('abort', cancel, { once: true });
  let rejectAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  const timer = setTimeout(
    () =>
      controller.abort(new ApiError(504, 'REQUEST_TIMEOUT', apiErrorMessage('REQUEST_TIMEOUT'))),
    milliseconds,
  );
  try {
    if (controller.signal.aborted) return await cancelled;
    return await Promise.race([operation(controller.signal), cancelled]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
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
  return withRequestTimeout(
    (boundedSignal) =>
      apiRequest<AuthSession>(
        async () => {
          const token = await getAccessToken();
          if (!token)
            throw new ApiError(
              401,
              'AUTH_TOKEN_NOT_READY',
              'Finishing your sign-in. Please retry.',
            );
          return token;
        },
        '/v1/session',
        { method: 'POST', signal: boundedSignal },
      ),
    15_000,
    signal,
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
    if (timeoutAbort(options.signal))
      throw new ApiError(504, 'REQUEST_TIMEOUT', apiErrorMessage('REQUEST_TIMEOUT'));
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
    if (timeoutAbort(options.signal))
      throw new ApiError(504, 'REQUEST_TIMEOUT', apiErrorMessage('REQUEST_TIMEOUT'));
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
    signal: timeoutSignal(30_000),
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
    signal: timeoutSignal(30_000),
    body: JSON.stringify({ provider, address }),
  });
}

export function deleteCryptoCard(getAccessToken: () => Promise<string | null>, id: string) {
  return apiRequest<{ removed: boolean }>(getAccessToken, `/v1/bank/crypto-cards/${id}`, {
    method: 'DELETE',
  });
}

export function cancelRoundup(getAccessToken: () => Promise<string | null>, transactionId: string) {
  return apiRequest<{ id: string; status: 'cancelled' }>(
    getAccessToken,
    `/v1/transactions/${encodeURIComponent(transactionId)}/roundup/cancel`,
    { method: 'POST' },
  );
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
    ROUNDUP_NOT_CANCELLABLE: 'This roundup is already part of an investment order.',
    POLICY_NOT_FOUND: 'Finish setting up your roundup rules first.',
    SNAPSHOT_EXPIRED: 'This leaderboard changed or expired. Refresh to see the latest.',
    INVITE_RATE_LIMIT: 'You have created 10 invitations this hour. Try again later.',
    SOCIAL_RATE_LIMIT: 'Too many requests. Wait a minute and retry.',
    INVITE_NOT_FOUND: 'That invitation is unavailable.',
    PROFILE_NOT_FOUND: 'That profile is unavailable.',
    INVALID_REQUEST: 'Check your details and try again.',

    SOLANA_NOT_CONFIGURED: 'Wallet balances are not available yet. Please try again later.',
    LINK_EXCHANGE_UNCERTAIN:
      'We couldn’t confirm your bank connection yet. Try again in a moment — your progress is saved.',
    LINK_OWNERSHIP_MISMATCH: 'This connection does not match your account. Start again.',
    LINK_SESSION_NOT_FOUND: 'This bank connection session is no longer valid. Start again.',
    LINK_TOKEN_MISMATCH: 'This bank link does not match your session. Start a new connection.',
    LINK_ALREADY_USED: 'This bank link was already used. Start a new connection.',
    USE_RELINK_COMPLETION: 'Your bank update is almost done. Try again in a moment.',
    BANK_ALREADY_LINKED:
      'That bank is already connected. If it is missing from your list, it may be linked to another account.',
    BANK_CONNECTION_NOT_COMPLETED:
      'Your bank did not finish connecting. Start again and complete the sign-in.',
    BANK_REGION_UNSUPPORTED: 'Bank connections are not available in that region yet.',
    BANK_RELINK_REQUIRED: 'Your bank needs to be reconnected. Tap Reconnect bank to sign in again.',
    BANK_DELETED: 'This bank removed the connection. Reconnect it to continue.',
    BANK_DATA_PENDING: 'Your bank data is still syncing. Check back shortly.',
    REQUEST_TIMEOUT: 'This is taking longer than expected. Please try again.',
    SALTEDGE_RATE_LIMITED: 'Your bank provider is busy right now. Wait a minute and try again.',
    SALTEDGE_UNAVAILABLE: 'Your bank provider is unreachable. Check your connection and try again.',
    SALTEDGE_REQUEST_FAILED: 'Your bank provider could not complete the request. Please try again.',
    SALTEDGE_INVALID_RESPONSE: 'Your bank provider sent an unexpected response. Please try again.',
    SALTEDGE_SYNC_FAILED: 'Your bank data could not be refreshed. Please try again.',
    SALTEDGE_PAGINATION_LIMIT: 'Your bank history is unusually large. Please try again later.',
    SALTEDGE_CUSTOMER_UNRESOLVED: 'Your bank profile could not be matched. Please try again.',
    LIVE_ROUNDUPS_NOT_ENABLED: 'Live bank roundups are not enabled yet.',
    CRYPTO_CARD_NOT_FOUND: 'That crypto card address is no longer saved.',
    BANK_NOT_READY: 'Your bank connection is still being prepared. Please try again shortly.',
    MONEYKIT_RATE_LIMITED: 'Your bank needs more time before another refresh. Please try later.',
    BANK_COUNTRY_UNSUPPORTED: 'Bank connections are not supported in that country.',
    BANK_COUNTRY_UNAVAILABLE:
      'No banks are available for that region yet. Try a different region or check back soon.',
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
    SELECT_SYNCED_BANK_ACCOUNT: 'Your connected accounts are still syncing. Try again shortly.',
    CONNECTED_ACCOUNTS_AUTOMATIC_ROUNDUPS:
      'All connected accounts participate automatically. To stop this bank’s roundups, unlink the bank.',
    BANK_NOT_CONFIGURED: 'Bank connections are not configured yet.',
    BANK_UNAVAILABLE: 'This bank is no longer available. Refresh the bank list and try again.',
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
