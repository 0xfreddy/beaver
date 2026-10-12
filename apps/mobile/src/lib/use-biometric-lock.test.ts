import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBiometricLock } from './use-biometric-lock';
const fixture = vi.hoisted(() => ({
  state: 'active',
  listeners: new Set<(state: string) => void>(),
  settled: new Set<() => void>(),
}));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return fixture.state;
    },
    addEventListener: (_: string, listener: (state: string) => void) => {
      fixture.listeners.add(listener);
      return { remove: () => fixture.listeners.delete(listener) };
    },
  },
}));
vi.mock('./biometric-auth', () => ({
  isBiometricUnlockEnabled: async () => true,
  biometricAvailability: async () => ({ available: true, label: 'Face ID' }),
  subscribeBiometricPreference: () => () => {},
  subscribeBiometricAuthSettled: (listener: () => void) => {
    fixture.settled.add(listener);
    return () => fixture.settled.delete(listener);
  },
}));
let renderer: ReactTestRenderer;
let current: ReturnType<typeof useBiometricLock>;
function Harness({ userId = 'user-a' }: { hasSession?: boolean; userId?: string | null }) {
  current = useBiometricLock(userId);
  return null;
}
async function state(value: string) {
  await act(async () => {
    fixture.state = value;
    fixture.listeners.forEach((listener) => listener(value));
  });
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.state = 'active';
  await act(async () => {
    renderer = create(createElement(Harness));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('does not relock after a three-second return when the backend session refresh recovers', async () => {
  expect(current.biometricLocked).toBe(true);
  await act(async () => current.setBiometricLocked(false));
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  await act(async () => renderer.update(createElement(Harness, { hasSession: false })));
  await state('active');
  await act(async () => renderer.update(createElement(Harness, { hasSession: true })));
  expect(current.biometricLocked).toBe(false);
});

it('starts local authentication before the backend session becomes available', async () => {
  await act(async () =>
    renderer.update(createElement(Harness, { userId: 'user-b', hasSession: false })),
  );
  expect(current.biometricChecked).toBe(true);
  expect(current.biometricLocked).toBe(true);
});

it('keeps the original deadline through session refresh and locks at exactly 30 seconds', async () => {
  await act(async () => current.setBiometricLocked(false));
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  await act(async () => renderer.update(createElement(Harness, { hasSession: false })));
  await act(async () => {
    vi.advanceTimersByTime(26999);
  });
  expect(current.biometricLocked).toBe(false);
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(current.biometricLocked).toBe(true);
});

it('requires a fresh unlock for a different account and after sign-out', async () => {
  await act(async () => current.setBiometricLocked(false));
  await act(async () => renderer.update(createElement(Harness, { userId: 'user-b' })));
  expect(current.biometricLocked).toBe(true);
  await act(async () => renderer.update(createElement(Harness, { userId: null })));
  expect(current.biometricRequired).toBe(false);
  await act(async () => renderer.update(createElement(Harness, { userId: 'user-b' })));
  expect(current.biometricLocked).toBe(true);
});
