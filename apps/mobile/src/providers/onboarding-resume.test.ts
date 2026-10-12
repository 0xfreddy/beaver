import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { OnboardingProvider, useOnboarding } from './onboarding-provider';
const state = vi.hoisted(() => ({ userId: 'user-a', storage: new Map<string, string>() }));
vi.mock('./auth-provider', () => ({
  useAuth: () => ({ isReady: true, user: { id: state.userId } }),
}));
vi.mock('../lib/api', () => ({ apiRequest: vi.fn(), timeoutSignal: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => state.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      state.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      state.storage.delete(key);
    },
  },
}));
let current: ReturnType<typeof useOnboarding>;
let renderer: ReactTestRenderer;
function Child() {
  current = useOnboarding();
  return null;
}
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.unstubAllGlobals();
});
it('restores the bank step after remount without sharing progress across accounts', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const mount = async () => {
    await act(async () => {
      renderer = create(createElement(OnboardingProvider, null, createElement(Child)));
    });
  };
  await mount();
  await act(async () => current.rememberPath('/onboarding/bank'));
  await act(async () => renderer.unmount());
  await mount();
  expect(current.resumePath).toBe('/onboarding/bank');
  await act(async () => current.rememberPath('/onboarding/account'));
  expect(current.resumePath).toBe('/onboarding/bank');
  await act(async () => renderer.unmount());
  state.userId = 'user-b';
  await mount();
  expect(current.resumePath).toBeNull();
});
