import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OnboardingProvider, useOnboarding } from './onboarding-provider';

const fixture = vi.hoisted(() => ({
  request: vi.fn(),
  storage: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
  auth: {
    isReady: true,
    user: { id: 'sample-user' } as { id: string } | null,
    getAccessToken: vi.fn(),
    refreshSession: vi.fn(async () => {}),
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: fixture.storage }));
vi.mock('./auth-provider', () => ({ useAuth: () => fixture.auth }));
vi.mock('../lib/api', () => ({
  apiRequest: (...args: unknown[]) => fixture.request(...args),
  timeoutSignal: () => new AbortController().signal,
}));
let renderer: ReactTestRenderer;
let value: ReturnType<typeof useOnboarding>;
function Consumer() {
  value = useOnboarding();
  return null;
}
beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.auth.user = { id: 'sample-user' };
  fixture.storage.getItem.mockResolvedValue(null);
  fixture.request.mockReset().mockImplementation(() => new Promise(() => {}));
  await act(async () => {
    renderer = create(createElement(OnboardingProvider, null, createElement(Consumer)));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});

it('finishes locally even when the optional server sync never answers', async () => {
  let finished = false;
  await act(async () => {
    void value.complete().then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(finished).toBe(true);
  expect(value.completedUserIds).toContain('sample-user');
  expect(fixture.storage.setItem).toHaveBeenCalledWith(expect.any(String), 'seen');
});

it('does not complete an introduction for a signed-out user', async () => {
  fixture.auth.user = null;
  await act(async () =>
    renderer.update(createElement(OnboardingProvider, null, createElement(Consumer))),
  );
  await expect(value.complete()).rejects.toThrow('Sign in');
});
