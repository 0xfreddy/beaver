import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MobileWalletDestination } from './mobile-wallet-destination.android';

const state = vi.hoisted(() => ({ mock: false, userId: 'live:one', sign: vi.fn(), api: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('./ui', () => ({ Button: 'Button', Type: 'Type' }));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: state.userId }, getAccessToken: async () => 'test' }),
}));
vi.mock('../providers/mock-data-provider', () => ({
  useMockData: () => ({ ready: true, active: state.mock }),
}));
vi.mock('../lib/review-auth', () => ({ isBypassUserId: (id: string) => id.startsWith('review:') }));
vi.mock('../lib/mobile-wallet-client.android', () => ({
  signWalletDestination: (...args: unknown[]) => state.sign(...args),
}));
vi.mock('../lib/api', () => ({
  ApiError: class extends Error {},
  apiRequest: (...args: unknown[]) => state.api(...args),
  withRequestTimeout: (fn: (signal: AbortSignal) => Promise<unknown>) =>
    fn(new AbortController().signal),
}));

let tree: ReactTestRenderer;
const verified = vi.fn();
const busy = vi.fn();
function element() {
  return createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
    children: createElement(MobileWalletDestination, {
      disabled: false,
      onVerified: verified,
      onBusy: busy,
    }),
  });
}
async function render() {
  await act(async () => {
    tree = create(element());
  });
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
const proof = () => ({
  id: 'proof',
  address: 'wallet',
  network: 'devnet',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  state.mock = false;
  state.userId = 'live:one';
  state.sign.mockResolvedValue({ challenge: proof(), signature: 'signed' });
  state.api.mockImplementation(async () => proof());
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('does not offer live verification to sample accounts', async () => {
  state.mock = true;
  await render();
  expect(tree.toJSON()).toBeNull();
  state.mock = false;
  state.userId = 'review:one';
  await act(async () => tree.update(element()));
  expect(tree.toJSON()).toBeNull();
  expect(state.sign).not.toHaveBeenCalled();
});
it('blocks rapid repeated taps and waits for server verification', async () => {
  await render();
  const button = tree.root.find((node) => node.props.title === 'Use my wallet');
  await act(async () => {
    button.props.onPress();
    button.props.onPress();
  });
  await flush();
  expect(state.sign).toHaveBeenCalledTimes(1);
  expect(state.api).toHaveBeenCalledTimes(1);
  expect(verified).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'proof', address: 'wallet' }),
  );
  expect(busy.mock.calls).toEqual([[true], [false]]);
});
it('does not treat cancellation as a verified address', async () => {
  state.sign.mockRejectedValue(new Error('declined'));
  await render();
  await act(async () =>
    tree.root.find((node) => node.props.title === 'Use my wallet').props.onPress(),
  );
  await flush();
  expect(verified).not.toHaveBeenCalled();
  expect(state.api).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('did not complete');
});
it('rejects a mismatched server destination', async () => {
  state.api.mockResolvedValue({ ...proof(), address: 'other' });
  await render();
  await act(async () =>
    tree.root.find((node) => node.props.title === 'Use my wallet').props.onPress(),
  );
  await flush();
  expect(verified).not.toHaveBeenCalled();
});
it('discards wallet results after changing Beaver accounts', async () => {
  let finish: (value: unknown) => void = () => {};
  state.sign.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await act(async () =>
    tree.root.find((node) => node.props.title === 'Use my wallet').props.onPress(),
  );
  state.userId = 'live:two';
  await act(async () => tree.update(element()));
  await act(async () => finish({ challenge: proof(), signature: 'signed' }));
  await flush();
  expect(verified).not.toHaveBeenCalled();
  expect(state.api).not.toHaveBeenCalled();
});
