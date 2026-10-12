import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  refresh: undefined as undefined | (() => Promise<void>),
  api: vi.fn(),
  invalidate: vi.fn(),
  query: {
    isPending: false,
    isSuccess: false,
    error: new Error('Check your details and try again.'),
    data: undefined as unknown,
    isFetching: false,
    refetch: vi.fn(),
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  RefreshControl: 'RefreshControl',
  View: 'View',
  StyleSheet: { create: (x: unknown) => x },
}));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQueries: () => [],
  useQueryClient: () => ({ invalidateQueries: f.invalidate }),
}));
vi.mock('../lib/live', () => ({
  useLive: (path: string) =>
    path.includes('filter=purchases') ? f.query : { data: undefined, refetch: vi.fn() },
  dollars: () => '$0.00',
}));
vi.mock('../lib/api', () => ({ fetchOnchainSpendingPreview: vi.fn(), apiRequest: f.api }));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({ session: {}, user: { id: 'a' }, getAccessToken: vi.fn() }),
}));
vi.mock('../providers/onchain-preview-provider', () => ({
  useOnchainPreview: () => ({ preview: null }),
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./ui', () => ({ Screen: 'Screen', Type: 'Type', Button: 'Button' }));
vi.mock('./bank-sync-card', () => ({ BankSyncCard: 'BankSyncCard' }));
vi.mock('./home-banners', () => ({ HomeBanners: 'HomeBanners' }));
vi.mock('./performance-card', () => ({ PerformanceCard: 'PerformanceCard' }));
vi.mock('./account-gate', () => ({ AccountGate: 'AccountGate' }));
vi.mock('./live-activity', () => ({ LivePurchaseRow: 'LivePurchaseRow' }));
vi.mock('./allocation-chart', () => ({
  useAllocationChart: (_data: unknown, options: { onRefresh: () => Promise<void> }) => {
    f.refresh = options.onRefresh;
    return { slot: 'AllocationSlot' };
  },
}));
vi.mock('./overview-cards', () => ({ OverviewCards: 'OverviewCards' }));
vi.mock('./shimmer-skeleton', () => ({ RecentPurchaseSkeleton: 'RecentPurchaseSkeleton' }));
vi.mock('./onboarding-animation', () => ({ OnboardingAnimation: 'OnboardingAnimation' }));
import { LiveHome } from './live-home';
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined as unknown as ReactTestRenderer;
  vi.unstubAllGlobals();
});
it('distinguishes initial loading, failure, successful empty data and cached refresh failure', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const render = async () => {
    await act(async () => {
      if (tree) tree.update(createElement(LiveHome));
      else tree = create(createElement(LiveHome));
    });
  };
  const count = (type: string) => tree.root.findAllByType(type as never).length;
  f.query.isPending = true;
  f.query.error = null as unknown as Error;
  await render();
  expect(count('RecentPurchaseSkeleton')).toBe(1);
  f.query.isPending = false;
  f.query.error = new Error('Check your details and try again.');
  await render();
  expect(count('RecentPurchaseSkeleton')).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Couldn’t load purchases');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Waiting for your first transaction');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Check your details');
  f.query.error = null as unknown as Error;
  f.query.isSuccess = true;
  f.query.data = { items: [] };
  await render();
  expect(count('RecentPurchaseSkeleton')).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Waiting for your first transaction');
  f.query.isSuccess = false;
  f.query.error = new Error('offline');
  f.query.data = { items: [{ id: 'p', occurredAt: '2026-10-11', merchant: 'Coffee' }] };
  await render();
  expect(count('LivePurchaseRow')).toBe(1);
  expect(count('RecentPurchaseSkeleton')).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Your last update is still shown');
});

it('a pull requests bank updates only once and invalidates the bank status after acceptance', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let accept!: (value: unknown) => void;
  f.api.mockResolvedValueOnce({
    items: [
      { id: 'bank', institutionName: 'Revolut', status: 'healthy', initialSyncComplete: true },
    ],
  });
  f.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  await act(async () => {
    tree = create(createElement(LiveHome));
  });
  let pending!: Promise<void>;
  await act(async () => {
    pending = f.refresh!();
    void f.refresh!();
  });
  expect(f.api).toHaveBeenCalledTimes(2);
  expect(f.api.mock.calls[1]!.slice(1)).toEqual([
    '/v1/bank/connections/bank/refresh',
    { method: 'POST' },
  ]);
  await act(async () => {
    accept({ status: 'requested' });
    await pending;
  });
  expect(f.invalidate).toHaveBeenCalledWith({ queryKey: ['live', 'a'] });
  expect(JSON.stringify(tree.toJSON())).toContain('updating in the background');
});

it('places bank freshness and pull status directly below the allocation semicircle', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await act(async () => {
    tree = create(createElement(LiveHome));
  });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered.indexOf('AllocationSlot')).toBeLessThan(rendered.indexOf('BankSyncCard'));
  expect(rendered.indexOf('BankSyncCard')).toBeLessThan(rendered.indexOf('Recent purchases'));
});
