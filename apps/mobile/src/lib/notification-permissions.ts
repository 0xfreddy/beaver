import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

const supportsNotifications = Platform.OS === 'ios' || Platform.OS === 'android';

export async function notificationPermissionState(): Promise<NotificationPermissionState> {
  if (!supportsNotifications) return 'denied';
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL)
      return 'granted';
    return settings.canAskAgain === false ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** Ask the OS for permission once; a user who already declined stays in system settings. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!supportsNotifications) return 'denied';
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    if (settings.canAskAgain === false) return 'denied';
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function openNotificationSettings() {
  try {
    await Linking.openSettings();
  } catch {
    // Opening the settings pane can fail on some devices; the caption already
    // explains where to find the toggle.
  }
}
