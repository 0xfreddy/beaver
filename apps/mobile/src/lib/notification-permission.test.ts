import { expect, it, vi } from 'vitest';
import { notificationPermissionState, requestNotificationPermission } from './notifications';
const mocks = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn(), platform: { OS: 'ios' } }));
vi.mock('react-native', () => ({ Platform: mocks.platform, Linking: {} }));
vi.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3, AUTHORIZED: 2 },
  getPermissionsAsync: mocks.get,
  requestPermissionsAsync: mocks.request,
}));
it('does not treat provisional permission as an explicit opt-in', async () => {
  mocks.get.mockResolvedValue({ granted: true, canAskAgain: true, ios: { status: 3 } });
  expect(await notificationPermissionState()).toBe('undetermined');
  mocks.request.mockResolvedValue({ granted: true, ios: { status: 2 } });
  expect(await requestNotificationPermission()).toBe('granted');
  expect(mocks.request).toHaveBeenCalledOnce();
});
it('recognizes explicit permission and denied permission', async () => {
  mocks.get.mockResolvedValue({ granted: true, ios: { status: 2 } });
  expect(await notificationPermissionState()).toBe('granted');
  mocks.get.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await notificationPermissionState()).toBe('denied');
});

it('accepts Android permission without iOS authorization metadata', async () => {
  mocks.platform.OS = 'android';
  try {
    mocks.get.mockResolvedValue({ granted: true, canAskAgain: true });
    expect(await notificationPermissionState()).toBe('granted');
    mocks.get.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await notificationPermissionState()).toBe('denied');
  } finally {
    mocks.platform.OS = 'ios';
  }
});
