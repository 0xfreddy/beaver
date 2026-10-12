import { describe, expect, it } from 'vitest';
import {
  bankConnectFailureKind,
  bankRecoveryAction,
  bankReturnDestination,
  parseWidgetCompletion,
  reduceBankConnect,
  shouldReconcile,
  type BankConnectStep,
} from './bank-connect-state';
import type { PendingSaltEdgeCompletion } from './saltedge-pending';

const idle: BankConnectStep = { kind: 'idle' };

it('restarts authorization for unfinished sign-in even when a completion is saved', () => {
  expect(bankRecoveryAction('not_completed', true)).toBe('connect');
  expect(bankRecoveryAction('recovery_unavailable', true)).toBe('connect');
  expect(bankConnectFailureKind('BANK_COMPLETION_TOKEN_MISSING')).toBe('recovery_unavailable');
  expect(bankRecoveryAction('expired', true)).toBe('connect');
  expect(bankRecoveryAction('busy', true)).toBe('finalize');
  expect(bankRecoveryAction('busy', false)).toBe('connect');
  expect(bankRecoveryAction('already_linked', true)).toBe('view_banks');
});

it('returns to account selection and exposes retry without replaying the introduction', () => {
  expect(bankReturnDestination('/onboarding/bank')).toEqual({
    pathname: '/onboarding/bank',
    params: { stage: 'connect' },
  });
  expect(bankReturnDestination('/settings/banks', true)).toEqual({
    pathname: '/settings/banks',
    params: { stage: 'connect', link: '1' },
  });
});

describe('bank connect failure kinds', () => {
  it('maps vendor and transport codes to the four user-facing reasons', () => {
    expect(bankConnectFailureKind('BANK_CONNECTION_NOT_COMPLETED')).toBe('not_completed');
    expect(bankConnectFailureKind('BANK_ALREADY_LINKED')).toBe('already_linked');
    expect(bankConnectFailureKind('LINK_EXPIRED')).toBe('expired');
    expect(bankConnectFailureKind('SALTEDGE_RATE_LIMITED')).toBe('busy');
    expect(bankConnectFailureKind('REQUEST_TIMEOUT')).toBe('busy');
    expect(bankConnectFailureKind(undefined)).toBe('other');
    expect(bankConnectFailureKind('SOMETHING_NEW')).toBe('other');
  });
});

describe('bank connect step reducer', () => {
  it('walks finishing → success → reset and keeps the bank name', () => {
    const finishing = reduceBankConnect(idle, { type: 'finishing', bank: 'Revolut' });
    expect(finishing).toEqual({ kind: 'finishing', bank: 'Revolut' });
    const success = reduceBankConnect(finishing, { type: 'succeeded', bank: 'Revolut' });
    expect(success).toEqual({ kind: 'success', bank: 'Revolut' });
    expect(reduceBankConnect(success, { type: 'reset' })).toEqual({ kind: 'idle' });
  });
  it('derives the reason and keeps the server copy when a finalize fails', () => {
    const step = reduceBankConnect(idle, {
      type: 'failed',
      code: 'BANK_CONNECTION_NOT_COMPLETED',
      message: 'Your bank did not finish connecting. Start again and complete the sign-in.',
    });
    expect(step).toEqual({
      kind: 'failed',
      reason: 'not_completed',
      message: 'Your bank did not finish connecting. Start again and complete the sign-in.',
    });
  });
  it('falls back to reason copy when no message is available', () => {
    const step = reduceBankConnect(idle, { type: 'failed', code: 'LINK_EXPIRED' });
    expect(step.kind).toBe('failed');
    if (step.kind === 'failed') expect(step.message).toContain('expired');
  });
});

describe('widget completion messages', () => {
  it('accepts the plausible success payload shapes', () => {
    expect(parseWidgetCompletion('{"stage":"success"}')).toBe(true);
    expect(parseWidgetCompletion('{"event":"final","data":{}}')).toBe(true);
    expect(parseWidgetCompletion('{"data":{"connection_id":"42"}}')).toBe(true);
  });
  it('rejects intermediate stages, junk, and plain strings', () => {
    expect(parseWidgetCompletion('{"stage":"connecting"}')).toBe(false);
    expect(parseWidgetCompletion('{"stage":"fetching"}')).toBe(false);
    expect(parseWidgetCompletion('not json')).toBe(false);
    expect(parseWidgetCompletion('success')).toBe(false);
    expect(parseWidgetCompletion('{}')).toBe(false);
  });
});

describe('reconciliation predicate', () => {
  const pending: PendingSaltEdgeCompletion = {
    provider: 'saltedge',
    userId: 'user-1',
    linkSessionId: 'session-1',
    mode: 'connect',
    exchangeableToken: 'https://connect.saltedge.com/session/abc',
    returnTo: '/onboarding/bank',
    savedAt: 1234,
  };
  it('resumes only an owned, unattempted pending while idle', () => {
    expect(shouldReconcile(pending, { userId: 'user-1', busy: false, attemptedKey: null })).toBe(
      true,
    );
    expect(shouldReconcile(pending, { userId: 'user-1', busy: true, attemptedKey: null })).toBe(
      false,
    );
    expect(shouldReconcile(pending, { userId: 'user-2', busy: false, attemptedKey: null })).toBe(
      false,
    );
    expect(shouldReconcile(null, { userId: 'user-1', busy: false, attemptedKey: null })).toBe(
      false,
    );
    expect(
      shouldReconcile(pending, {
        userId: 'user-1',
        busy: false,
        attemptedKey: 'session-1:1234',
      }),
    ).toBe(false);
  });
});

it('does not finalize a fetching or failed widget callback just because it has a connection id', () => {
  expect(
    parseWidgetCompletion(JSON.stringify({ data: { stage: 'fetching', connection_id: '42' } })),
  ).toBe(false);
  expect(
    parseWidgetCompletion(JSON.stringify({ data: { stage: 'error', connection_id: '42' } })),
  ).toBe(false);
  expect(
    parseWidgetCompletion(JSON.stringify({ data: { stage: 'success', connection_id: '42' } })),
  ).toBe(true);
  expect(parseWidgetCompletion('null')).toBe(false);
});
