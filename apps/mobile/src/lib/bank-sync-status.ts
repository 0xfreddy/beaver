export interface BankSyncItem {
  id: string;
  institutionName?: string | null;
  provider?: 'moneykit' | 'saltedge';
  syncMode?: 'scheduled' | 'bank_dependent';
  nextExpectedAt?: string | null;
  status: string;
  initialSyncComplete: boolean;
  lastCheckedAt?: string | null;
  lastSyncedAt: string | null;
  bankDataUpdatedAt?: string | null;
  refreshRequestedAt?: string | null;
  refreshError?: string | null;
  nextRefreshAllowedAt?: string | null;
  disconnectRequested?: boolean;
}
export interface BankSyncSchedule {
  items: BankSyncItem[];
}

function elapsedLabel(value: string | null | undefined, now: number) {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time) || time > now) return null;
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return 'Last checked just now';
  if (minutes < 60) return `Last checked ${minutes}m ago`;
  if (minutes < 1440) return `Last checked ${Math.floor(minutes / 60)}h ago`;
  return `Last checked ${Math.floor(minutes / 1440)}d ago`;
}

export function bankSyncStatus(item: BankSyncItem, now: number) {
  const checked = elapsedLabel(item.lastCheckedAt ?? item.lastSyncedAt, now);
  const bankData =
    elapsedLabel(item.bankDataUpdatedAt, now)?.replace('Last checked', 'Bank data updated') ??
    'Bank data update time unavailable';
  const base = {
    bank: item.institutionName || 'Connected bank',
    detail: bankData,
    minutes: null as number | null,
    needsReconnect: false,
  };
  if (item.status === 'relink_required')
    return { ...base, label: 'Reconnect your bank', needsReconnect: true };
  if (item.status === 'error') return { ...base, label: 'Bank check delayed' };
  if (!item.initialSyncComplete) return { ...base, label: 'Importing bank activity' };
  if (item.status === 'syncing') return { ...base, label: 'Checking bank activity' };
  if (item.refreshError) return { ...base, label: 'Couldn’t refresh bank data' };
  const requested = Date.parse(item.refreshRequestedAt ?? '');
  const updated = Date.parse(item.bankDataUpdatedAt ?? '');
  if (Number.isFinite(requested) && (!Number.isFinite(updated) || updated < requested)) {
    return {
      ...base,
      label: now - requested < 5 * 60_000 ? 'Waiting for bank data' : 'Bank update delayed',
    };
  }
  // Missing provider metadata from an older API must never invent a daily schedule.
  if (item.provider === 'moneykit' && item.syncMode === 'scheduled' && item.nextExpectedAt) {
    const next = Date.parse(item.nextExpectedAt);
    if (Number.isFinite(next) && next > now) {
      const minutes = Math.ceil((next - now) / 60000);
      return {
        ...base,
        minutes,
        label: checked ?? 'Waiting for the first bank check',
        detail: `${bankData} · Next check estimated in ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
      };
    }
    if (Number.isFinite(next)) return { ...base, label: 'Waiting for the next bank check' };
  }
  return { ...base, label: checked ?? 'Waiting for the first bank check' };
}
