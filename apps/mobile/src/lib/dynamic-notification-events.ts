import { notificationAmount } from '@roundups/domain';
/** Presentation data from the authenticated notification history, never optimistic balances. */
export interface SavedNotification {
  id: string;
  event: string;
  status?: string;
  createdAt: string;
  acceptedAt?: string | null;
  display: { title?: string; body?: string; deepLink?: string } | null;
  properties?: Record<string, unknown>;
}
export interface InAppNotice {
  id: string;
  title: string;
  message: string;
  route: string;
  kind: 'sync' | 'bank' | 'first' | 'roundup' | 'deposit' | 'milestone' | 'friend';
  cents?: number;
  symbols?: string[];
  sourceIds: string[];
}
const usd = (cents: number) => `${(cents / 100).toFixed(2)} USD`;
export function inAppNotice(row: SavedNotification): InAppNotice | null {
  if (row.status && !['pending', 'accepted'].includes(row.status)) return null;
  const p = row.properties ?? {};
  const cents =
    typeof p.amount_cents === 'number' &&
    Number.isSafeInteger(p.amount_cents) &&
    p.amount_cents >= 0
      ? p.amount_cents
      : undefined;
  const symbol = typeof p.symbol === 'string' ? p.symbol : undefined;
  const base = {
    id: row.id,
    sourceIds: [row.id],
    message: (row.display?.body ?? '').replace(/\b\d+\.\d{3,}(?= USDC)/g, notificationAmount),
    route:
      row.status === 'pending' ? (row.display?.deepLink ?? '/activity') : `/notification/${row.id}`,
  };
  switch (row.event) {
    case 'bank_initial_sync_completed':
      return {
        ...base,
        kind: 'bank',
        id: typeof p.connection_id === 'string' ? `bank:${p.connection_id}` : row.id,
        title: 'Your transactions are ready',
      };
    case 'first_roundup_executed':
      return {
        ...base,
        kind: 'first',
        title: 'Your first roundup is in 🎉',
        message: cents !== undefined && symbol ? `${usd(cents)} bought ${symbol}.` : base.message,
      };
    case 'trade_executed':
      if (p.side !== 'buy') return null;
      return {
        ...base,
        kind: 'roundup',
        title: 'Your roundups are in',
        cents,
        symbols: symbol ? [symbol] : [],
        message: cents !== undefined && symbol ? `${usd(cents)} bought ${symbol}.` : base.message,
      };
    case 'deposit_received':
      return {
        ...base,
        kind: 'deposit',
        title:
          typeof p.amount_usdc === 'string' && /^\d+(\.\d+)?$/.test(p.amount_usdc)
            ? `Your ${notificationAmount(p.amount_usdc)} USDC has arrived`
            : 'Your money has arrived',
      };
    case 'investment_milestone_reached':
      return {
        ...base,
        kind: 'milestone',
        title:
          cents !== undefined ? `You’ve rounded up ${usd(cents)}!` : 'A new roundup milestone!',
      };
    case 'invite_accepted':
      return {
        ...base,
        kind: 'friend',
        title:
          typeof p.friend_name === 'string' && p.friend_name.trim()
            ? `${p.friend_name} joined Beaver`
            : 'Your friend joined Beaver',
        message: 'Find them in your friends list.',
      };
    default:
      return null;
  }
}
/** One card for a burst of successful purchases. Never add different currencies or sales. */
export function combineRoundups(items: InAppNotice[]): InAppNotice {
  const first = items[0]!;
  if (items.length === 1) return first;
  const symbols = [...new Set(items.flatMap((n) => n.symbols ?? []))];
  const total = items.every((n) => n.cents !== undefined)
    ? items.reduce((sum, n) => sum + n.cents!, 0)
    : undefined;
  return {
    ...first,
    id: items.map((n) => n.id).join(':'),
    sourceIds: items.flatMap((n) => n.sourceIds),
    route: '/portfolio',
    message: `${total !== undefined && Number.isSafeInteger(total) ? usd(total) : 'Your spare change'} bought ${symbols.length ? symbols.join(', ') : 'stocks'}.`,
  };
}

// The notification handler suppresses Apple's foreground banner only after a mounted,
// unlocked host accepts the matching account's saved event.
let receiver: ((row: SavedNotification) => boolean) | null = null;
export function setInAppNotificationReceiver(next: typeof receiver) {
  receiver = next;
}
export function receiveInAppNotification(row: SavedNotification) {
  return receiver?.(row) ?? false;
}

const systemPresented = new Set<string>();
export function markSystemPresented(id: string) {
  systemPresented.add(id);
  if (systemPresented.size > 200) systemPresented.delete(systemPresented.values().next().value!);
}
export function wasSystemPresented(id: string) {
  return systemPresented.has(id);
}
