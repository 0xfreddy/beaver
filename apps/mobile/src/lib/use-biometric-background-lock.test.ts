import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBiometricBackgroundLock } from './use-biometric-background-lock';
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
  subscribeBiometricAuthSettled: (listener: () => void) => {
    fixture.settled.add(listener);
    return () => fixture.settled.delete(listener);
  },
}));
let renderer: ReactTestRenderer;
const lock = vi.fn();
function Harness({ required = true }) {
  useBiometricBackgroundLock(required, lock);
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
  lock.mockClear();
  await act(async () => {
    renderer = create(createElement(Harness));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('does not require Face ID after a one-second return', async () => {
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await state('active');
  expect(lock).not.toHaveBeenCalled();
});
it('locks after 30 seconds away, even if background timers were suspended', async () => {
  await state('background');
  vi.setSystemTime(Date.now() + 30_000);
  await state('inactive');
  await state('active');
  expect(lock).toHaveBeenCalled();
});
it('does not reset the deadline for repeated background events', async () => {
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(20_000);
  });
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(10_000);
  });
  expect(lock).toHaveBeenCalledTimes(1);
});
it('ignores system dialogs and cancels the previous visit timer', async () => {
  await state('inactive');
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  await state('active');
  expect(lock).not.toHaveBeenCalled();
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await state('active');
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(lock).not.toHaveBeenCalled();
});
it('keeps a prompt that settles in the background locked', async () => {
  await state('background');
  await act(async () => fixture.settled.forEach((listener) => listener()));
  expect(lock).toHaveBeenCalled();
});
it('cancels pending locks when the requirement is disabled', async () => {
  await state('background');
  lock.mockClear();
  await act(async () => renderer.update(createElement(Harness, { required: false })));
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  await state('active');
  expect(lock).not.toHaveBeenCalled();
});

it('preserves the grace deadline across component re-renders', async () => {
  await state('background');
  await act(async () => {
    vi.advanceTimersByTime(20_000);
  });
  await act(async () => renderer.update(createElement(Harness)));
  await act(async () => {
    vi.advanceTimersByTime(9_999);
  });
  expect(lock).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(lock).toHaveBeenCalledTimes(1);
});
