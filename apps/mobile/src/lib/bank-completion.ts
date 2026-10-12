import { ApiError, apiRequest, timeoutSignal } from './api';
import { clearPendingSaltEdge } from './saltedge-pending';
import { loadBankExchangeToken } from './bank-exchange-token';

export type BankCompletion = {
  userId: string;
  linkSessionId: string;
  mode: string;
  exchangeableToken: string;
  recovery?: boolean;
};
type Result = { id: string; institutionName?: string | null };
const requests = new Map<string, Promise<Result>>();

// A callback and the banks screen can overlap when users continue in the
// background. Share the request, but keep recovery durable until it succeeds.
export function completeBankConnection(
  value: BankCompletion,
  getAccessToken: () => Promise<string | null>,
): Promise<Result> {
  const key = `${value.userId}:${value.linkSessionId}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const exchangeableToken =
      value.mode === 'update'
        ? ''
        : value.exchangeableToken ||
          (await loadBankExchangeToken(value.userId, value.linkSessionId).catch(() => null));
    if (value.recovery) {
      try {
        const result = await apiRequest<Result>(getAccessToken, '/v1/bank/recover', {
          method: 'POST',
          signal: timeoutSignal(60_000),
          body: JSON.stringify({
            linkSessionId: value.linkSessionId,
            ...(exchangeableToken ? { exchangeableToken } : {}),
          }),
        });
        await clearPendingSaltEdge(value.linkSessionId);
        return result;
      } catch (error) {
        // Older servers have no recovery route. Only that generic 404 permits
        // the legacy endpoint; ownership/session errors must never fall back.
        if (
          !(error instanceof ApiError) ||
          error.status !== 404 ||
          error.code !== 'SERVICE_UNAVAILABLE'
        )
          throw error;
      }
    }
    if (value.mode !== 'update' && !exchangeableToken) {
      throw new ApiError(
        409,
        'BANK_COMPLETION_TOKEN_MISSING',
        'Your previous bank connection couldn’t be restored. Start a new connection.',
      );
    }
    const result = await apiRequest<Result>(
      getAccessToken,
      value.mode === 'update' ? '/v1/bank/relink' : '/v1/bank/exchange',
      {
        method: 'POST',
        signal: timeoutSignal(60_000),
        body: JSON.stringify(
          value.mode === 'update'
            ? { linkSessionId: value.linkSessionId }
            : { linkSessionId: value.linkSessionId, exchangeableToken },
        ),
      },
    );
    await clearPendingSaltEdge(value.linkSessionId);
    return result;
  })().finally(() => requests.delete(key));
  requests.set(key, request);
  return request;
}
