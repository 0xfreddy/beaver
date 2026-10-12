import { expect, it, vi } from 'vitest';
import { refreshHomeBanks } from './bank-refresh';

it('requests each eligible bank, preserves partial failures and reports a provider cooldown', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      items: [
        { id: 'a', institutionName: 'Revolut', status: 'healthy', initialSyncComplete: true },
        { id: 'b', institutionName: 'Other bank', status: 'error', initialSyncComplete: true },
        { id: 'c', status: 'disconnected' },
        { id: 'd', status: 'healthy', disconnectRequested: true },
        { id: 'e', institutionName: 'Old bank', status: 'relink_required' },
      ],
    })
    .mockResolvedValueOnce({ status: 'deferred', nextRefreshAllowedAt: '2026-10-12T12:00:00Z' })
    .mockRejectedValueOnce(new Error('offline'));
  const messages = await refreshHomeBanks(request, Date.parse('2026-10-12T11:53:00Z'));
  expect(request.mock.calls.slice(1)).toEqual([
    ['/v1/bank/connections/a/refresh', { method: 'POST' }],
    ['/v1/bank/connections/b/refresh', { method: 'POST' }],
  ]);
  expect(messages[0]).toBe(
    'Revolut is updating in the background. Next bank update available in 7 min.',
  );
  expect(messages[1]).toContain('couldn’t request an update');
  expect(messages[2]).toContain('reconnect');
});
it('reports acceptance without claiming new transactions were received', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ items: [{ id: 'a', status: 'healthy', initialSyncComplete: true }] })
    .mockResolvedValueOnce({ status: 'requested' });
  expect((await refreshHomeBanks(request))[0]).toContain('updating in the background');
});
it('does not silently succeed when bank discovery fails', async () => {
  await expect(refreshHomeBanks(vi.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow(
    'offline',
  );
});
