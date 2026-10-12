import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  permission: 'denied',
  stored: null as string | null,
  push: vi.fn(),
  set: vi.fn(),
}));
vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
vi.mock('expo-router', () => ({ router: { push: f.push } }));
vi.mock('expo-notifications', () => ({ addPushTokenListener: () => ({ remove() {} }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => f.stored, setItem: f.set },
}));
vi.mock('./notification-consent', () => ({
  notificationOfferKey: (userId: string) => `beaver.notification-offer.v4:${userId}`,
  hasCompletedNotificationSetup: async () => f.stored === 'completed',
  notificationOfferDeferred: () => false,
}));
vi.mock('./notifications', () => ({
  notificationPermissionState: async () => f.permission,
  attachNotificationListeners: () => () => {},
  notificationRoute: vi.fn(),
}));
vi.mock('./notification-registration', () => ({ syncNotificationRegistration: vi.fn() }));
vi.mock('./dynamic-notification-events', () => ({
  receiveInAppNotification: vi.fn(),
  markSystemPresented: vi.fn(),
}));
vi.mock('./api', () => ({ apiRequest: vi.fn() }));
vi.mock('./telemetry', () => ({ posthog: null }));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({ session: { user: { id: 'a' } }, getAccessToken: async () => 'token' }),
}));
vi.mock('../providers/mock-data-provider', () => ({
  useMockData: () => ({ ready: true, active: false }),
}));
import { notificationOfferKey, useNotifications } from './use-notifications';
function Harness({ canOffer = true }) {
  useNotifications({ canOffer, canNavigate: true });
  return null;
}
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  f.permission = 'denied';
  f.stored = null;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount(canOffer = true) {
  await act(async () => {
    tree = create(createElement(Harness, { canOffer }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });
}
it('offers Settings guidance to a previously denied user', async () => {
  await mount();
  expect(f.push).toHaveBeenCalledWith('/notification-setup');
});
it('offers the invitation for a first-time permission request', async () => {
  f.permission = 'undetermined';
  await mount();
  expect(f.push).toHaveBeenCalledOnce();
});
it('does not mark an invitation shown before its screen actually mounts', async () => {
  f.permission = 'undetermined';
  await mount();
  expect(f.set).not.toHaveBeenCalled();
});
it('does not reoffer after successfully completed setup', async () => {
  f.stored = 'completed';
  await mount();
  expect(f.push).not.toHaveBeenCalled();
});
it('does not offer while another flow blocks presentation', async () => {
  await mount(false);
  expect(f.push).not.toHaveBeenCalled();
});
it('requests fresh consent even with system permission already granted', async () => {
  f.permission = 'granted';
  await mount();
  expect(f.push).toHaveBeenCalledWith('/notification-setup');
});

it('uses a fresh invitation campaign for accounts created on earlier releases', () => {
  expect(notificationOfferKey('a')).toBe('beaver.notification-offer.v4:a');
});

it('shows the sheet again when an earlier release only recorded a screen impression', async () => {
  f.stored = 'shown';
  await mount();
  expect(f.push).toHaveBeenCalledWith('/notification-setup');
});

it('does not mistake legacy accepted consent for completed registration', async () => {
  f.stored = 'accepted';
  await mount();
  expect(f.push).toHaveBeenCalledWith('/notification-setup');
});
