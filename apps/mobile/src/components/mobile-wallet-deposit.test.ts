import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MobileWalletDeposit } from './mobile-wallet-deposit.android';
import { devnetDepositOptions } from '../lib/deposit-options';

const state = vi.hoisted(() => ({
  mock: false,
  userId: 'privy:test-user',
  pending: null as null | {
    signature: string;
    network: 'devnet';
    amountRaw: string;
    destination: string;
  },
  status: 'pending',
  start: vi.fn(),
}));
const destination = '11111111111111111111111111111111';
vi.mock('react-native', () => ({
  View: 'View',
  TextInput: 'TextInput',
  Keyboard: { dismiss: vi.fn() },
  Linking: { openURL: vi.fn() },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('expo-haptics', () => ({
  notificationAsync: async () => {},
  NotificationFeedbackType: { Success: 'success' },
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./ui', () => ({ Button: 'Button', Type: 'Type' }));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: state.userId, walletAddress: '11111111111111111111111111111111' },
    getAccessToken: async () => 'test-token',
  }),
}));
vi.mock('../providers/mock-data-provider', () => ({
  useMockData: () => ({ active: state.mock, ready: true }),
}));
vi.mock('../lib/review-auth', () => ({ isBypassUserId: (id: string) => id.startsWith('review:') }));
vi.mock('../lib/api', () => ({
  apiRequest: async () => ({}),
  withRequestTimeout: (operation: (signal: AbortSignal) => Promise<unknown>) =>
    operation(new AbortController().signal),
}));
vi.mock('../lib/mobile-wallet-client.android', () => ({
  walletDepositConnection: () => ({}),
  signWalletDeposit: vi.fn(),
}));
vi.mock('../lib/mobile-wallet-deposit', async (original) => ({
  ...(await original<object>()),
  loadWalletDeposit: async () => state.pending,
  walletDepositStatus: async () => state.status,
  startWalletDeposit: state.start,
}));

let tree: ReactTestRenderer;
let client: QueryClient;
const confirmed = vi.fn();
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('EXPO_PUBLIC_SOLANA_NETWORK', 'devnet');
  state.mock = false;
  state.userId = 'privy:test-user';
  state.pending = null;
  state.status = 'pending';
  state.start.mockReset();
  confirmed.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  client.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function render() {
  await act(async () => {
    tree = create(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MobileWalletDeposit, {
          option: devnetDepositOptions()[0]!,
          instruction: {
            id: null,
            address: destination,
            sourceChain: devnetDepositOptions()[0]!.caip2,
            createdAt: '',
            estimatedSeconds: 30,
          },
          onConfirmed: confirmed,
        }),
      ),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
const buttons = () =>
  tree.root.findAll((node) => node.type === ('Button' as unknown)).map((node) => node.props.title);

it('never exposes real transfers to a sample account', async () => {
  state.mock = true;
  await render();
  expect(buttons()).not.toContain('Deposit from wallet');
  expect(state.start).not.toHaveBeenCalled();
});
it('also blocks synthetic review identities before mock data finishes loading', async () => {
  state.userId = 'review:app-store';
  await render();
  expect(buttons()).not.toContain('Deposit from wallet');
});
it('restores a pending transfer instead of offering another wallet approval', async () => {
  state.pending = {
    signature: 'test-signature',
    network: 'devnet',
    amountRaw: '1000000',
    destination,
  };
  await render();
  expect(buttons()).toContain('Check and retry transfer');
  expect(buttons()).not.toContain('Continue in wallet');
  expect(buttons()).not.toContain('Make another deposit');
  expect(confirmed).not.toHaveBeenCalled();
});
it('only announces completion after the transaction reaches finality', async () => {
  state.pending = {
    signature: 'test-signature',
    network: 'devnet',
    amountRaw: '1000000',
    destination,
  };
  state.status = 'finalized';
  await render();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(buttons()).toContain('Make another deposit');
  expect(confirmed).toHaveBeenCalledOnce();
});
