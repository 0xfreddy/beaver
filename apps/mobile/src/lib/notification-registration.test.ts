import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  permission: 'granted',
  consent: true,
  token: vi.fn(),
  identify: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  api: vi.fn(),
  store: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) =>
      key.includes('notification-consent')
        ? f.consent
          ? 'accepted'
          : null
        : '00000000-0000-4000-8000-000000000001',
    setItem: f.store,
  },
}));
vi.mock('expo-application', () => ({
  applicationId: 'com.roundups.app',
  nativeApplicationVersion: '1',
  nativeBuildVersion: '57',
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'installation' }));
vi.mock('expo-notifications', () => ({ getDevicePushTokenAsync: f.token }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('./api', () => ({ apiRequest: f.api }));
vi.mock('./notifications', () => ({ notificationPermissionState: async () => f.permission }));
vi.mock('./telemetry', () => ({
  posthog: {
    identify: f.identify,
    registerPushNotificationToken: f.register,
    unregisterPushNotificationToken: f.unregister,
  },
}));
import {
  syncNotificationRegistration,
  enableAllNotifications,
  disconnectNotificationDevice,
} from './notification-registration';
const access = async () => 'auth';
beforeEach(() => {
  vi.clearAllMocks();
  f.permission = 'granted';
  f.consent = true;
  f.token.mockResolvedValue({ data: 'native-token' });
  f.register.mockResolvedValue(undefined);
  f.api.mockResolvedValue({ registered: true });
});
it('registers existing permission under the backend identity and stores the native token', async () => {
  await expect(syncNotificationRegistration('backend-uuid', access)).resolves.toBe(true);
  expect(f.identify).toHaveBeenCalledWith('backend-uuid');
  expect(f.register).toHaveBeenCalledWith('native-token', { appId: 'com.roundups.app' });
  expect(JSON.parse(f.api.mock.calls[0]![2].body)).toMatchObject({
    token: 'native-token',
    permission: 'granted',
  });
});
it('revokes provider registration and stores denied permission after system settings change', async () => {
  f.permission = 'denied';
  await expect(syncNotificationRegistration('backend-uuid', access)).resolves.toBe(false);
  expect(f.unregister).toHaveBeenCalledOnce();
  expect(f.token).not.toHaveBeenCalled();
  expect(JSON.parse(f.api.mock.calls[0]![2].body)).toMatchObject({
    permission: 'denied',
    token: null,
  });
});
it('propagates setup failure so the UI does not claim success', async () => {
  f.api.mockRejectedValueOnce(new Error('offline'));
  await expect(syncNotificationRegistration('backend-uuid', access)).rejects.toThrow('offline');
});
it('does not register a token after the account changed while fetching it', async () => {
  let current = true;
  f.token.mockImplementationOnce(async () => {
    current = false;
    return { data: 'old-token' };
  });
  await expect(syncNotificationRegistration('old-user', access, () => current)).resolves.toBe(
    false,
  );
  expect(f.register).not.toHaveBeenCalled();
  expect(f.api).not.toHaveBeenCalled();
});
it('logout invalidates a pending registration, then removes the device', async () => {
  let resolve!: (value: { data: string }) => void;
  f.token.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = syncNotificationRegistration('user', access);
  await vi.waitFor(() => expect(f.token).toHaveBeenCalled());
  const logout = disconnectNotificationDevice(access);
  resolve({ data: 'late-token' });
  await pending;
  await logout;
  expect(f.register).not.toHaveBeenCalled();
  expect(f.unregister).toHaveBeenCalledOnce();
  expect(f.api.mock.calls[0]![2]).toEqual({ method: 'DELETE' });
});

it('releases the registration queue when APNs never returns, allowing logout', async () => {
  vi.useFakeTimers();
  try {
    f.token.mockImplementationOnce(() => new Promise(() => {}));
    const pending = syncNotificationRegistration('user', access);
    const rejected = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15001);
    await rejected;
    await disconnectNotificationDevice(access);
    expect(f.unregister).toHaveBeenCalledOnce();
    expect(f.api.mock.calls[0]![2]).toEqual({ method: 'DELETE' });
  } finally {
    vi.useRealTimers();
  }
});

it('keeps push disabled until fresh consent even when OS permission is granted', async () => {
  f.consent = false;
  await expect(syncNotificationRegistration('user', access)).resolves.toBe(false);
  expect(f.token).not.toHaveBeenCalled();
  expect(f.register).not.toHaveBeenCalled();
  expect(JSON.parse(f.api.mock.calls[0]![2].body)).toMatchObject({
    token: null,
    permission: 'undetermined',
  });
});

it('does not report success when the backend rejects device registration', async () => {
  f.api.mockResolvedValueOnce({ registered: false });
  await expect(syncNotificationRegistration('user', access)).resolves.toBe(false);
});

it('explicit opt-in enables every category and completes consent only after server success', async () => {
  f.consent = false;
  await expect(enableAllNotifications('user', access)).resolves.toBe(true);
  expect(JSON.parse(f.api.mock.calls[0]![2].body)).toMatchObject({
    enableAllPreferences: true,
    consentVersion: 4,
    permission: 'granted',
  });
  expect(f.store).toHaveBeenCalledWith('beaver.notification-consent.v4:user', 'completed');
});
it('failed activation leaves setup incomplete for the next invitation', async () => {
  f.consent = false;
  f.api.mockResolvedValueOnce({ registered: false });
  await expect(enableAllNotifications('user', access)).resolves.toBe(false);
  expect(f.store).not.toHaveBeenCalled();
});
it('denied permission never completes setup or enables categories', async () => {
  f.permission = 'denied';
  await expect(enableAllNotifications('user', access)).resolves.toBe(false);
  expect(f.register).not.toHaveBeenCalled();
  expect(f.store).not.toHaveBeenCalled();
  expect(JSON.parse(f.api.mock.calls[0]![2].body).enableAllPreferences).not.toBe(true);
});
it('background token refresh never resets category opt-outs', async () => {
  await syncNotificationRegistration('user', access);
  expect(JSON.parse(f.api.mock.calls[0]![2].body).enableAllPreferences).toBe(false);
  expect(f.store).not.toHaveBeenCalled();
});
