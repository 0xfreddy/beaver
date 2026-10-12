import { beforeEach, expect, it, vi } from 'vitest';
import {
  notificationPermissionState,
  requestNotificationPermission,
  openNotificationSettings,
} from './notifications';
const mocks = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn(), settings: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { openSettings: mocks.settings },
}));
vi.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3, AUTHORIZED: 2 },
  getPermissionsAsync: mocks.get,
  requestPermissionsAsync: mocks.request,
}));
beforeEach(() => vi.resetAllMocks());
it('does not treat provisional permission as an explicit opt-in', async () => {
  mocks.get.mockResolvedValue({ granted: false, canAskAgain: true, ios: { status: 3 } });
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

it('requests native authorization for a fresh install', async () => {
  mocks.get.mockResolvedValue({ granted: false, canAskAgain: true, ios: { status: 0 } });
  mocks.request.mockResolvedValue({ granted: true, ios: { status: 2 } });
  expect(await requestNotificationPermission()).toBe('granted');
  expect(mocks.request).toHaveBeenCalledOnce();
});
it('propagates native request failure so the sheet can retry instead of showing denial', async () => {
  mocks.get.mockResolvedValue({ granted: false, canAskAgain: true, ios: { status: 0 } });
  mocks.request.mockRejectedValue(new Error('native request failed'));
  await expect(requestNotificationPermission()).rejects.toThrow('native request failed');
});
it('propagates Settings launch failure instead of silently doing nothing', async () => {
  mocks.settings.mockRejectedValue(new Error('settings unavailable'));
  await expect(openNotificationSettings()).rejects.toThrow('settings unavailable');
});
it('does not request again after a genuine denial', async () => {
  mocks.get.mockResolvedValue({ granted: false, canAskAgain: false, ios: { status: 1 } });
  expect(await requestNotificationPermission()).toBe('denied');
  expect(mocks.request).not.toHaveBeenCalled();
});
