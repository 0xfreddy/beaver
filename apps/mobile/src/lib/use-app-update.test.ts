import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  listeners: new Set<(state: string) => void>(),
  read: vi.fn(),
  write: vi.fn(async (_key: string, _value: string) => {}),
  fetch: vi.fn(),
  build: '57',
  audience: 'ios-testflight',
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, listener: (state: string) => void) => {
      fixture.listeners.add(listener);
      return { remove: () => fixture.listeners.delete(listener) };
    },
  },
}));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        get updateAudience() {
          return fixture.audience;
        },
      },
    },
  },
}));
vi.mock('expo-application', () => ({
  get nativeBuildVersion() {
    return fixture.build;
  },
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: fixture.read, setItemAsync: fixture.write }));
vi.mock('./app-update', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./app-update')>()),
  fetchUpdatePolicy: fixture.fetch,
}));
let renderer: ReactTestRenderer | undefined;
let current: ReturnType<typeof import('./use-app-update').useAppUpdate>;
const policy = {
  enabled: true,
  minimumBuild: 58,
  recommendedBuild: 60,
  updateUrl: 'https://testflight.apple.com/join/Example1',
  supportUrl: 'mailto:test@example.com',
};
async function mount() {
  const { useAppUpdate } = await import('./use-app-update');
  function Harness() {
    current = useAppUpdate();
    return null;
  }
  await act(async () => {
    renderer = create(createElement(Harness));
  });
}
async function state(value: string) {
  await act(async () => fixture.listeners.forEach((listener) => listener(value)));
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.com');
  fixture.build = '57';
  fixture.audience = 'ios-testflight';
  fixture.read.mockResolvedValue(null);
  fixture.fetch.mockResolvedValue({ enabled: false });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('does not gate production or preview clients', async () => {
  fixture.audience = 'none';
  await mount();
  expect(current.hydrated).toBe(true);
  expect(current.visible).toBe(false);
  expect(fixture.fetch).not.toHaveBeenCalled();
  expect(fixture.read).not.toHaveBeenCalled();
});
it('keeps a saved requirement offline and ignores dismissal', async () => {
  fixture.read.mockResolvedValue(JSON.stringify({ policy }));
  fixture.fetch.mockRejectedValue(new Error('Offline'));
  await mount();
  expect(current.visible).toBe(true);
  expect(current.checkFailed).toBe(true);
  await act(async () => current.dismiss());
  expect(current.visible).toBe(true);
});
it('does not invent a requirement on first launch offline', async () => {
  fixture.fetch.mockRejectedValue(new Error('Offline'));
  await mount();
  expect(current.hydrated).toBe(true);
  expect(current.visible).toBe(false);
});
it('rechecks after background, keeps a requirement on unchanged build, and accepts rollback', async () => {
  fixture.fetch.mockResolvedValue(policy);
  await mount();
  expect(current.visible).toBe(true);
  await state('inactive');
  await state('active');
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
  await state('background');
  await state('inactive');
  await state('active');
  expect(fixture.fetch).toHaveBeenCalledTimes(2);
  expect(current.visible).toBe(true);
  fixture.fetch.mockResolvedValue({ enabled: false });
  await act(async () => current.refresh());
  expect(current.visible).toBe(false);
  expect(JSON.parse(fixture.write.mock.calls.at(-1)?.[1] ?? '{}').policy).toEqual({
    enabled: false,
  });
});
it('clears the requirement on a new native build even with an offline cache', async () => {
  fixture.build = '60';
  fixture.read.mockResolvedValue(JSON.stringify({ policy }));
  fixture.fetch.mockRejectedValue(new Error('Offline'));
  await mount();
  expect(current.visible).toBe(false);
});
it('remembers Not now but a higher minimum overrides the recommendation dismissal', async () => {
  fixture.build = '58';
  fixture.fetch.mockResolvedValue(policy);
  await mount();
  expect(current.mode).toBe('recommended');
  await act(async () => current.dismiss());
  expect(current.visible).toBe(false);
  fixture.fetch.mockResolvedValue({ ...policy, minimumBuild: 59 });
  await act(async () => current.refresh());
  expect(current.mode).toBe('required');
  expect(current.visible).toBe(true);
});
it('deduplicates overlapping checks', async () => {
  let resolve: (value: typeof policy) => void = () => {};
  fixture.fetch.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount();
  await act(async () => current.refresh());
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
  await act(async () => resolve(policy));
  expect(current.checking).toBe(false);
  expect(current.visible).toBe(true);
});
