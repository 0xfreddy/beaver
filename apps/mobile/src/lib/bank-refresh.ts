import type { BankSyncItem } from './bank-sync-status';

type Request = <T>(path: string, options?: { method: string }) => Promise<T>;
type RefreshResult = {
  status: 'requested' | 'waiting' | 'deferred';
  nextRefreshAllowedAt?: string;
};

/** Discover current connections rather than silently skipping banks whose cached query is empty. */
export async function refreshHomeBanks(request: Request, now = Date.now()): Promise<string[]> {
  const { items } = await request<{ items: BankSyncItem[] }>('/v1/bank/connections');
  return Promise.all(
    items
      .filter((bank) => bank.status !== 'disconnected' && !bank.disconnectRequested)
      .map(async (bank) => {
        const name = bank.institutionName || 'Your bank';
        if (bank.status === 'relink_required')
          return `${name}: reconnect your bank to update transactions.`;
        if (bank.status === 'syncing' || !bank.initialSyncComplete)
          return `${name}: a bank check is already in progress.`;
        if (!['healthy', 'error'].includes(bank.status))
          return `${name}: bank check delayed. Open connected banks for details.`;
        try {
          const result = await request<RefreshResult>(
            `/v1/bank/connections/${encodeURIComponent(bank.id)}/refresh`,
            { method: 'POST' },
          );
          if (result.status === 'deferred') {
            const next = Date.parse(result.nextRefreshAllowedAt ?? '');
            return Number.isFinite(next)
              ? `${name} is updating in the background. Next bank update available in ${Math.max(1, Math.ceil((next - now) / 60_000))} min.`
              : `${name} is updating in the background.`;
          }
          return result.status === 'waiting'
            ? `${name} is updating in the background.`
            : `${name} is updating in the background. New transactions appear when the bank supplies them.`;
        } catch {
          return `${name}: couldn’t request an update. Pull down to retry.`;
        }
      }),
  );
}
