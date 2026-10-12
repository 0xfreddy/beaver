import { expect, it } from 'vitest';
import { bankSyncStatus, type BankSyncItem } from './bank-sync-status';
const now = Date.parse('2026-10-11T10:00:00Z');
const item: BankSyncItem = {
  id: 'bank',
  institutionName: 'Revolut',
  provider: 'saltedge',
  syncMode: 'bank_dependent',
  status: 'healthy',
  initialSyncComplete: true,
  lastSyncedAt: '2026-10-11T09:57:00Z',
  nextExpectedAt: '2026-10-12T11:00:00Z',
};
it('never shows a daily countdown for Salt Edge even if an old timestamp is present', () => {
  expect(bankSyncStatus(item, now)).toMatchObject({ label: 'Last checked 3m ago', minutes: null });
});
it('uses an explicit MoneyKit schedule and does not claim a sync starts when the timer expires', () => {
  expect(
    bankSyncStatus(
      {
        ...item,
        provider: 'moneykit',
        syncMode: 'scheduled',
        nextExpectedAt: '2026-10-11T12:21:00Z',
      },
      now,
    ),
  ).toMatchObject({
    detail: 'Bank data update time unavailable · Next check estimated in 2h 21m',
    minutes: 141,
  });
  expect(
    bankSyncStatus(
      {
        ...item,
        provider: 'moneykit',
        syncMode: 'scheduled',
        nextExpectedAt: '2026-10-11T09:59:00Z',
      },
      now,
    ).label,
  ).toBe('Waiting for the next bank check');
});
it.each(['relink_required', 'error', 'syncing'])('prioritizes %s over a countdown', (status) => {
  expect(
    bankSyncStatus({ ...item, provider: 'moneykit', syncMode: 'scheduled', status }, now).minutes,
  ).toBeNull();
});
it('distinguishes initial import, absent checks, and older API responses', () => {
  expect(bankSyncStatus({ ...item, initialSyncComplete: false }, now).label).toBe(
    'Importing bank activity',
  );
  expect(bankSyncStatus({ ...item, lastSyncedAt: null }, now).label).toBe(
    'Waiting for the first bank check',
  );
  expect(
    bankSyncStatus({ ...item, provider: undefined, syncMode: undefined }, now).minutes,
  ).toBeNull();
});
it.each(['invalid', '2026-10-12T10:00:00Z'])(
  'does not display a misleading elapsed time for %s',
  (lastSyncedAt) => {
    expect(bankSyncStatus({ ...item, lastSyncedAt }, now).label).toBe(
      'Waiting for the first bank check',
    );
  },
);

it('keeps bank freshness independent of a recent importer check', () => {
  expect(
    bankSyncStatus(
      { ...item, lastCheckedAt: '2026-10-11T10:00:00Z', bankDataUpdatedAt: '2026-10-11T08:00:00Z' },
      now,
    ),
  ).toMatchObject({
    label: 'Last checked just now',
    detail: 'Bank data updated 2h ago',
  });
});
it('does not treat request acceptance or a later check as completed bank data', () => {
  const waiting = {
    ...item,
    lastCheckedAt: '2026-10-11T10:00:00Z',
    refreshRequestedAt: '2026-10-11T09:59:00Z',
    bankDataUpdatedAt: '2026-10-11T08:00:00Z',
  };
  expect(bankSyncStatus(waiting, now).label).toBe('Waiting for bank data');
  expect(bankSyncStatus(waiting, now + 300_000).label).toBe('Bank update delayed');
  expect(bankSyncStatus({ ...waiting, bankDataUpdatedAt: '2026-10-11T10:00:00Z' }, now).label).toBe(
    'Last checked just now',
  );
  expect(bankSyncStatus({ ...waiting, refreshError: 'BANK_REFRESH_FAILED' }, now).label).toBe(
    'Couldn’t refresh bank data',
  );
});
