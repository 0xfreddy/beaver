import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  state: 'active',
  listeners: new Set<(state: string) => void>(),
  authenticate: vi.fn<() => Promise<unknown>>(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  AppState: {
    get currentState() {
      return fixture.state;
    },
    addEventListener: (_: string, fn: (state: string) => void) => {
      fixture.listeners.add(fn);
      return { remove: () => fixture.listeners.delete(fn) };
    },
  },
}));
vi.mock('../lib/biometric-auth', () => ({ authenticateWithBiometrics: fixture.authenticate }));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: { background: '#000' } }) }));
vi.mock('./ui', () => ({ Button: 'Button', Type: 'Type' }));
vi.mock('./branded-wait-surface', () => ({ BrandedWaitSurface: 'BrandedWaitSurface' }));
import { BiometricUnlock } from './biometric-unlock';
let renderer: ReactTestRenderer;
let resolve: (result: unknown) => void;
const onUnlock = vi.fn();
async function state(value: string) {
  await act(async () => {
    fixture.state = value;
    fixture.listeners.forEach((listener) => listener(value));
  });
}
beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.state = 'active';
  onUnlock.mockClear();
  fixture.authenticate.mockReset().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await act(async () => {
    renderer = create(
      createElement(BiometricUnlock, {
        label: 'Face ID',
        onUnlock,
        onUseAccount: async () => {},
      }),
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
it('prompts immediately once and keeps the branded lock still', async () => {
  expect(fixture.authenticate).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType('BrandedWaitSurface' as never).props.still).toBe(true);
  await state('inactive');
  await state('active');
  expect(fixture.authenticate).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ available: true }));
  expect(onUnlock).toHaveBeenCalledTimes(1);
});
it('leaves cancellation locked with manual retry instead of a prompt loop', async () => {
  await act(async () => resolve(Promise.reject(new Error('Authentication was cancelled.'))));
  await state('inactive');
  await state('active');
  expect(onUnlock).not.toHaveBeenCalled();
  expect(fixture.authenticate).toHaveBeenCalledTimes(1);
  const retry = renderer.root
    .findAllByType('Button' as never)
    .find((button) => button.props.title === 'Unlock with Face ID');
  await act(async () => retry!.props.onPress());
  expect(fixture.authenticate).toHaveBeenCalledTimes(2);
});
it('does not accept a stale success after leaving and returning during a prompt', async () => {
  await state('background');
  await state('active');
  await act(async () => resolve({ available: true }));
  expect(onUnlock).not.toHaveBeenCalled();
});
it('does not unlock after the lock screen has unmounted', async () => {
  await act(async () => renderer.unmount());
  await act(async () => resolve({ available: true }));
  expect(onUnlock).not.toHaveBeenCalled();
});
