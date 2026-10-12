import { expect, it } from 'vitest';
import {
  inAppNotice,
  combineRoundups,
  type SavedNotification,
} from './dynamic-notification-events';
const event = (name: string, properties = {}): SavedNotification => ({
  id: 'saved-id',
  event: name,
  createdAt: new Date().toISOString(),
  status: 'accepted',
  display: { body: 'Confirmed by Beaver', deepLink: '/portfolio' },
  properties,
});
it('uses confirmed amounts without relabelling USD or USDC as pounds', () => {
  expect(
    inAppNotice(event('first_roundup_executed', { amount_cents: 35, symbol: 'AAPL' }))?.message,
  ).toBe('0.35 USD bought AAPL.');
  expect(inAppNotice(event('deposit_received', { amount_usdc: '20.000001' }))?.title).toBe(
    'Your 20.00 USDC has arrived',
  );
  expect(inAppNotice(event('investment_milestone_reached', { amount_cents: 10000 }))?.title).toBe(
    'You’ve rounded up 100.00 USD!',
  );
});
it('does not celebrate failed, suppressed or sell events as roundups', () => {
  expect(inAppNotice(event('investment_failed'))).toBeNull();
  expect(inAppNotice({ ...event('deposit_received'), status: 'suppressed' })).toBeNull();
  expect(inAppNotice(event('trade_executed', { side: 'sell' }))).toBeNull();
});
it('combines successful purchase amounts and unique stocks into one card', () => {
  const a = inAppNotice(
    event('trade_executed', { side: 'buy', amount_cents: 35, symbol: 'AAPL' }),
  )!;
  const b = {
    ...inAppNotice(event('trade_executed', { side: 'buy', amount_cents: 65, symbol: 'SBUX' }))!,
    id: 'second',
    sourceIds: ['second'],
  };
  expect(combineRoundups([a, b])).toMatchObject({
    message: '1.00 USD bought AAPL, SBUX.',
    sourceIds: ['saved-id', 'second'],
    route: '/portfolio',
  });
});
it('does not invent totals when an amount is missing or invalid', () => {
  const a = inAppNotice(event('trade_executed', { side: 'buy', amount_cents: 35 }))!;
  const b = inAppNotice(event('trade_executed', { side: 'buy', amount_cents: 1.5 }))!;
  expect(combineRoundups([a, b]).message).toBe('Your spare change bought stocks.');
});
it('uses the shared bank key and a friend name only when provided', () => {
  expect(inAppNotice(event('bank_initial_sync_completed', { connection_id: 'bank-1' }))?.id).toBe(
    'bank:bank-1',
  );
  expect(inAppNotice(event('invite_accepted', { friend_name: 'Alex' }))?.title).toBe(
    'Alex joined Beaver',
  );
  expect(inAppNotice(event('invite_accepted'))?.title).toBe('Your friend joined Beaver');
});
it('pending push delivery can present in-app and routes directly to its destination', () => {
  expect(inAppNotice({ ...event('first_roundup_executed'), status: 'pending' })?.route).toBe(
    '/portfolio',
  );
});
