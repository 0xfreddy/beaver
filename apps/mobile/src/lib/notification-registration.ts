import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiRequest } from './api';
import { notificationPermissionState } from './notifications';
import { posthog } from './telemetry';

import { hasNotificationConsent, NOTIFICATION_CONSENT_VERSION } from './notification-consent';

const installationKey = 'beaver.notification-installation.v1';
let installationPromise: Promise<string> | undefined;
export function notificationInstallationId() {
  installationPromise ??= (async () => {
    const stored = await AsyncStorage.getItem(installationKey);
    if (stored) return stored;
    const id = Crypto.randomUUID();
    await AsyncStorage.setItem(installationKey, id);
    return id;
  })().catch((error) => {
    installationPromise = undefined;
    throw error;
  });
  return installationPromise;
}

// APNs can wait indefinitely offline. Release the queue so logout and later retries can proceed.
async function nativeToken() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Notifications.getDevicePushTokenAsync(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Notification registration timed out. Try again.')),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** OS permission and remote registration are separate; a local preview proves neither backend step. */
async function register(
  userId: string,
  getAccessToken: () => Promise<string | null>,
  isCurrent: () => boolean = () => true,
) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  const consent = await hasNotificationConsent(userId);
  const permission = consent ? await notificationPermissionState() : 'undetermined';
  const installationId = await notificationInstallationId();
  if (!isCurrent()) return false;
  if (permission !== 'granted') {
    await posthog?.unregisterPushNotificationToken();
    if (!isCurrent()) return false;
    if (Application.applicationId)
      await apiRequest(getAccessToken, '/v1/notification-devices', {
        method: 'PUT',
        body: JSON.stringify({
          installationId,
          permission,
          token: null,
          platform: Platform.OS,
          appId: Application.applicationId,
          appVersion: Application.nativeApplicationVersion,
          appBuild: Number(Application.nativeBuildVersion) || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
    return false;
  }
  if (!posthog || !Application.applicationId)
    throw new Error('Notifications are unavailable in this build.');
  const token = await nativeToken();
  if (!isCurrent()) return false;
  // Backend UUID, not the Privy DID: workflow events target this same identity.
  posthog.identify(userId);
  await posthog.registerPushNotificationToken(String(token.data), {
    appId: Application.applicationId,
  });
  if (!isCurrent()) return false;
  await apiRequest(getAccessToken, '/v1/notification-devices', {
    method: 'PUT',
    body: JSON.stringify({
      installationId,
      permission,
      consentVersion: NOTIFICATION_CONSENT_VERSION,
      token: String(token.data),
      platform: Platform.OS,
      appId: Application.applicationId,
      appVersion: Application.nativeApplicationVersion,
      appBuild: Number(Application.nativeBuildVersion) || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  return true;
}

async function disconnect(getAccessToken: () => Promise<string | null>) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  // PostHog queues a failed unregister durably, including while offline.
  await posthog?.unregisterPushNotificationToken();
  const id = await notificationInstallationId();
  await apiRequest(getAccessToken, `/v1/notification-devices/${id}`, { method: 'DELETE' });
}

// Serialize settings, foreground, token refresh, and logout so a slow registration cannot undo logout.
let generation = 0;
let tail: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = tail.catch(() => {}).then(operation);
  tail = next;
  return next;
}
export function syncNotificationRegistration(
  userId: string,
  getAccessToken: () => Promise<string | null>,
  isCurrent: () => boolean = () => true,
) {
  const epoch = generation;
  return serialized(() =>
    epoch === generation && isCurrent()
      ? register(userId, getAccessToken, () => epoch === generation && isCurrent())
      : Promise.resolve(false),
  );
}
export function disconnectNotificationDevice(getAccessToken: () => Promise<string | null>) {
  generation++;
  return serialized(() => disconnect(getAccessToken));
}
