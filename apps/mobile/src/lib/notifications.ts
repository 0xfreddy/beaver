// Native presentation and permission handling. Registration lives in notification-registration.
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { NotificationPreferences } from '@roundups/types';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

export type NotificationCategory = keyof NotificationPreferences;

/**
 * Representative samples per category, shown on demand from the notification
 * settings so people know what they are toggling. Real sends come from the
 * PostHog workflows; these previews are local and never leave the device.
 */
export const NOTIFICATION_SAMPLES: Record<
  NotificationCategory,
  { title: string; body: string; deepLink: string }
> = {
  roundupsSummary: {
    title: 'Your spare change just bought stock',
    body: 'Your roundups invested — tap to see your portfolio.',
    deepLink: '/portfolio',
  },
  readyToRedeem: {
    title: 'You’re ready to redeem',
    body: 'Review your available balance in Beaver.',
    deepLink: '/withdraw',
  },
  bankIssues: {
    title: 'Reconnect your bank',
    body: 'Beaver lost access to your bank connection — reconnect so your roundups keep running.',
    deepLink: '/settings/banks',
  },
  deposits: {
    title: 'Deposit detected',
    body: 'Funds landed at your deposit address — ready to round up.',
    deepLink: '/funding',
  },
  trades: {
    title: 'Your roundups bought stocks',
    body: 'Your roundups just bought more stock.',
    deepLink: '/portfolio',
  },
  riskAlerts: {
    title: 'Daily limit reached',
    body: 'You hit your roundup limit — tap to review your controls.',
    deepLink: '/settings',
  },
  withdrawals: {
    title: 'Your money was sent',
    body: 'Your money was sent to your wallet.',
    deepLink: '/portfolio',
  },
  weeklySummary: {
    title: 'Your week in roundups',
    body: '$4.20 bought stocks across 8 roundups this week.',
    deepLink: '/portfolio',
  },
  milestones: {
    title: 'Little by little, look at you go',
    body: 'Your roundups have bought $10 of stocks.',
    deepLink: '/portfolio',
  },
  appUpdates: {
    title: 'A fresh Beaver update is ready',
    body: 'Get the latest version to see what’s new.',
    deepLink: '/settings',
  },
  setupReminders: {
    title: 'Your roundups start with a connection',
    body: 'Connect your bank whenever you’re ready.',
    deepLink: '/settings/banks',
  },
  social: {
    title: 'Your invite was accepted',
    body: 'Someone just joined Beaver with your code — you’re friends in the app now.',
    deepLink: '/leaderboards',
  },
};

/** Presents one local sample notification immediately (settings-screen preview). */
export async function previewNotification(category: NotificationCategory) {
  if (!supportsNotifications) return;
  const sample = NOTIFICATION_SAMPLES[category];
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: sample.title,
        body: sample.body,
        data: { deepLink: sample.deepLink },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Presenting a sample must never disturb the settings screen.
  }
}

const supportsNotifications = Platform.OS === 'ios' || Platform.OS === 'android';

export async function notificationPermissionState(): Promise<NotificationPermissionState> {
  if (!supportsNotifications) return 'denied';
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (
      settings.granted &&
      settings.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
    )
      return 'granted';
    return settings.canAskAgain === false ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** Only a deliberate opt-in action may show the OS prompt. Remote setup runs separately. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!supportsNotifications) return 'denied';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted && settings.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL)
    return 'granted';
  if (settings.canAskAgain === false) return 'denied';
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Beaver',
      importance: Notifications.AndroidImportance.HIGH,
    });
  const requested = await Notifications.requestPermissionsAsync();
  if (!requested.granted) return 'denied';
  return 'granted';
}

export async function openNotificationSettings() {
  await Linking.openSettings();
}

/**
 * Notification routing. Server sends carry an in-app route (e.g. '/portfolio')
 * in the payload data; landing the tap on that screen is the whole point of a
 * transactional push. (PostHog also captures $push_notification_opened
 * natively; the explicit capture keeps our own event naming in the dashboards.)
 */
export function attachNotificationListeners(
  onResponse: (response: Notifications.NotificationResponse) => void,
  onForeground?: (notification: Notifications.Notification) => Promise<boolean>,
): () => void {
  if (!supportsNotifications) return () => {};
  // Prefer the unlocked in-app host when it accepts a saved event. Previews,
  // unsupported flows and failed lookups retain Apple's foreground banner.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      if ((await notificationPermissionState()) !== 'granted')
        return {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      const handled = (await onForeground?.(notification).catch(() => false)) ?? false;
      return {
        shouldShowBanner: !handled,
        shouldShowList: true,
        shouldPlaySound: !handled,
        shouldSetBadge: false,
      };
    },
  });
  const subscription = Notifications.addNotificationResponseReceivedListener(onResponse);
  const initial = Notifications.getLastNotificationResponse();
  if (initial) onResponse(initial);
  return () => subscription.remove();
}

const allowedNotificationRoutes = new Set([
  '/activity',
  '/portfolio',
  '/funding',
  '/withdraw',
  '/settings',
  '/settings/banks',
  '/settings/controls',
  '/leaderboards',
]);
export function notificationRoute(value: unknown) {
  return typeof value === 'string' &&
    (allowedNotificationRoutes.has(value) ||
      /^\/notification\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    ? value
    : null;
}
