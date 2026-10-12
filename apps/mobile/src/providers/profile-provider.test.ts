import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileProvider, useProfile } from './profile-provider';

const fixture = vi.hoisted(() => ({
  sample: { ready: false, busy: false, error: null as string | null, reload: vi.fn() },
  request: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
}));
vi.mock('./auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'team:test@example.com' },
    session: {},
    sessionError: null,
    getAccessToken: async () => 'test',
  }),
}));
vi.mock('./mock-data-provider', () => ({ useMockData: () => fixture.sample }));
vi.mock('../lib/avatars', () => ({ avatars: [{ id: 'glass-01' }] }));
vi.mock('../lib/mock-data', () => ({ isMockDataEligible: () => false }));
vi.mock('../lib/api', () => ({ apiRequest: (...args: unknown[]) => fixture.request(...args) }));

let value: ReturnType<typeof useProfile>;
let renderer: ReactTestRenderer | undefined;
let cache: QueryClient;
function Consumer() {
  value = useProfile();
  return null;
}
function tree() {
  return createElement(
    QueryClientProvider,
    { client: cache },
    createElement(ProfileProvider, null, createElement(Consumer)),
  );
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.sample = { ready: false, busy: false, error: null, reload: vi.fn() };
  fixture.request.mockReset().mockImplementation(async () => {
    if (!fixture.sample.ready) throw new Error('Your session expired. Sign in again.');
    return { alias: 'Tester', avatarId: 'glass-01' };
  });
  cache = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  cache.clear();
  vi.unstubAllGlobals();
});

describe('profile startup', () => {
  it('waits for sample restoration before requesting a profile, then becomes ready', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    await settle();
    expect(value.ready).toBe(false);
    expect(fixture.request).not.toHaveBeenCalled();
    fixture.sample.ready = true;
    await act(async () => renderer!.update(tree()));
    await settle();
    expect(value.ready).toBe(true);
    expect(value.profile.alias).toBe('Tester');
  });

  it('surfaces sample restoration failures without sending a synthetic token to the API', async () => {
    fixture.sample.ready = true;
    fixture.sample.error = 'Couldn’t restore the sample account.';
    await act(async () => {
      renderer = create(tree());
    });
    await settle();
    expect(fixture.request).not.toHaveBeenCalled();
    expect(value.error).toBe(fixture.sample.error);
    expect(value.ready).toBe(false);
  });

  it('retries a failed profile request and releases the onboarding gate', async () => {
    fixture.sample.ready = true;
    fixture.request.mockRejectedValue(new Error('Couldn’t connect.'));
    await act(async () => {
      renderer = create(tree());
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    await settle();
    expect(value.ready).toBe(false);
    expect(value.error).toBe('Couldn’t connect.');
    fixture.request.mockResolvedValue({ alias: 'Tester', avatarId: 'glass-01' });
    await act(async () => value.retry());
    await settle();
    expect(value.ready).toBe(true);
    expect(value.error).toBeNull();
  });

  it('does not allow saving a cached profile while sample routing is being reset', async () => {
    fixture.sample.ready = true;
    await act(async () => {
      renderer = create(tree());
    });
    await settle();
    expect(value.ready).toBe(true);
    fixture.sample.busy = true;
    await act(async () => renderer!.update(tree()));
    expect(value.ready).toBe(false);
    await expect(value.save({ alias: 'Tester' })).rejects.toThrow('not available yet');
  });
});

it('can restore the server profile when an older build left malformed local profile data', async () => {
  vi.mocked(AsyncStorage.getItem).mockResolvedValue('{broken');
  fixture.sample.ready = true;
  await act(async () => {
    renderer = create(tree());
  });
  await settle();
  expect(fixture.request).toHaveBeenCalled();
  expect(value.ready).toBe(true);
  expect(value.profile.alias).toBe('Tester');
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
});
