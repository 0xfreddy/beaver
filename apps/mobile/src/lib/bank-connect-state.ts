import type { PendingSaltEdgeCompletion } from './saltedge-pending';

// The connect flow's single visible state machine. Every wait is named, every
// failure maps to exactly one primary action, and no state lacks an escape.

export type BankConnectFailureKind =
  'not_completed' | 'already_linked' | 'busy' | 'expired' | 'recovery_unavailable' | 'other';

export type BankConnectStep =
  | { kind: 'idle' }
  | { kind: 'finishing'; bank: string | null }
  | { kind: 'success'; bank: string | null }
  | { kind: 'failed'; reason: BankConnectFailureKind; message: string };

export type BankConnectEvent =
  | { type: 'finishing'; bank?: string | null }
  | { type: 'succeeded'; bank?: string | null }
  | { type: 'failed'; code?: string; message?: string }
  | { type: 'reset' };

const fallbackCopy: Record<BankConnectFailureKind, string> = {
  not_completed: 'Your bank did not finish connecting.',
  already_linked: 'That bank is already connected.',
  busy: 'Your bank provider is busy right now.',
  expired: 'This connection link expired.',
  recovery_unavailable:
    'Your previous bank connection couldn’t be restored. Start a new connection.',
  other: 'Something went wrong.',
};

export function bankRecoveryAction(reason: BankConnectFailureKind, canFinalize: boolean) {
  if (reason === 'already_linked') return 'view_banks';
  if (
    reason === 'expired' ||
    reason === 'not_completed' ||
    reason === 'recovery_unavailable' ||
    !canFinalize
  )
    return 'connect';
  return 'finalize';
}

export function bankReturnDestination(returnTo = '/onboarding/bank', connectAgain = false) {
  return {
    pathname: returnTo,
    params: {
      ...(returnTo === '/onboarding/bank' || returnTo === '/settings/banks'
        ? { stage: 'connect' }
        : {}),
      ...(connectAgain ? { link: '1' } : {}),
    },
  };
}

export function bankConnectFailureKind(code?: string | null): BankConnectFailureKind {
  switch (code) {
    case 'BANK_COMPLETION_TOKEN_MISSING':
      return 'recovery_unavailable';
    case 'BANK_CONNECTION_NOT_COMPLETED':
      return 'not_completed';
    case 'BANK_ALREADY_LINKED':
      return 'already_linked';
    case 'LINK_SESSION_NOT_FOUND':
    case 'LINK_EXPIRED':
    case 'LINK_ALREADY_USED':
    case 'LINK_TOKEN_MISMATCH':
      return 'expired';
    case 'SALTEDGE_RATE_LIMITED':
    case 'SALTEDGE_UNAVAILABLE':
    case 'SALTEDGE_REQUEST_FAILED':
    case 'SALTEDGE_INVALID_RESPONSE':
    case 'SALTEDGE_CUSTOMER_UNRESOLVED':
    case 'SALTEDGE_PAGINATION_LIMIT':
    case 'LINK_EXCHANGE_UNCERTAIN':
    case 'REQUEST_TIMEOUT':
    case 'NETWORK_ERROR':
      return 'busy';
    default:
      return 'other';
  }
}

export function reduceBankConnect(step: BankConnectStep, event: BankConnectEvent): BankConnectStep {
  switch (event.type) {
    case 'finishing':
      return { kind: 'finishing', bank: event.bank ?? null };
    case 'succeeded':
      return { kind: 'success', bank: event.bank ?? null };
    case 'failed':
      return {
        kind: 'failed',
        reason: bankConnectFailureKind(event.code),
        message: event.message ?? fallbackCopy[bankConnectFailureKind(event.code)],
      };
    case 'reset':
      return { kind: 'idle' };
  }
}

// The widget is requested with javascript_callback_type post_message but the
// payload shape is vendor-version dependent; treat only explicit success
// markers as completion and let the return URL and deep link stay the
// fallbacks. A false negative is harmless — a false positive would finalize
// before the vendor connection exists.
export function parseWidgetCompletion(data: string): boolean {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return false;
  }
  if (!event || typeof event !== 'object') return false;
  const nested =
    event.data && typeof event.data === 'object'
      ? (event.data as Record<string, unknown>)
      : undefined;
  const stage = nested?.stage ?? event.stage ?? event.event ?? event.type;
  // A connection exists during fetching and errors too. Its ID is not success.
  if (stage !== undefined) return stage === 'success' || stage === 'final' || stage === 'done';
  const connection = nested?.connection_id;
  return typeof connection === 'string' || typeof connection === 'number';
}

// Reconciliation: a persisted-but-unfinalized session for the current user
// resumes exactly once per stored instance, never while another action runs.
export function shouldReconcile(
  pending: PendingSaltEdgeCompletion | null,
  options: { userId?: string | null; busy: boolean; attemptedKey: string | null },
): boolean {
  if (!pending || options.busy) return false;
  if (pending.userId !== options.userId) return false;
  return options.attemptedKey !== `${pending.linkSessionId}:${pending.savedAt}`;
}
