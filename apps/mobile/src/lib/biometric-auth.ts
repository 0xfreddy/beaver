import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const keyPrefix = 'beaver.biometric-unlock.v1';
const offerKeyPrefix = 'beaver.biometric-offer.v1';

export type BiometricAvailability = {
  available: boolean;
  enrolled: boolean;
  label: string;
  reason: string | null;
};

function accountKey(prefix: string, userId: string) {
  // SecureStore keys may only contain alphanumerics, '.', '-', and '_'.
  const safeId = encodeURIComponent(userId).replace(/[^A-Za-z0-9._-]/g, '');
  return `${prefix}.${safeId}`;
}

function preferenceKey(userId: string) {
  return accountKey(keyPrefix, userId);
}

function offerKey(userId: string) {
  return accountKey(offerKeyPrefix, userId);
}

function labelFor(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
  if (Platform.OS === 'ios') return 'Face ID';
  return 'biometrics';
}

export async function biometricAvailability(): Promise<BiometricAvailability> {
  const [types, level, biometricsEnrolled] = await Promise.all([
    LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
    LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE),
    LocalAuthentication.isEnrolledAsync().catch(() => false),
  ]);
  const label = labelFor(types);
  const enrolled = biometricsEnrolled || level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  // authenticateAsync runs LocalAuthentication with the device passcode as a
  // fallback, so an enrolled passcode alone is enough; biometrics are not
  // required. isEnrolledAsync also covers states getEnrolledLevelAsync can
  // miss, like Face ID enrolled on a simulator without a passcode.
  const canAuthenticate =
    enrolled || biometricsEnrolled || level >= LocalAuthentication.SecurityLevel.SECRET;
  if (!canAuthenticate) {
    const withBiometrics = types.length > 0 ? `${label} or a device passcode` : 'a device passcode';
    return {
      available: false,
      enrolled: false,
      label,
      reason: `Set up ${withBiometrics} before enabling this.`,
    };
  }
  return {
    available: true,
    enrolled,
    label: enrolled ? label : 'Device passcode',
    reason: null,
  };
}

// The system passcode screen deactivates the app mid-prompt, so lock logic
// must not treat that as the user leaving the app.
let authInFlight = false;
const authSettledListeners = new Set<() => void>();

export function biometricAuthInFlight() {
  return authInFlight;
}

export function subscribeBiometricAuthSettled(listener: () => void) {
  authSettledListeners.add(listener);
  return () => {
    authSettledListeners.delete(listener);
  };
}

export async function authenticateWithBiometrics(promptMessage: string) {
  const availability = await biometricAvailability();
  if (!availability.available)
    throw new Error(availability.reason ?? 'Biometric unlock is unavailable.');
  authInFlight = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    if (!result.success) {
      const message =
        result.error === 'user_cancel' || result.error === 'app_cancel'
          ? 'Authentication was cancelled.'
          : 'Authentication failed. Please try again.';
      throw new Error(message);
    }
    return availability;
  } finally {
    authInFlight = false;
    for (const listener of authSettledListeners) listener();
  }
}

export async function isBiometricUnlockEnabled(userId: string) {
  if (!userId) return false;
  const enabled = await SecureStore.getItemAsync(preferenceKey(userId)).catch(() => null);
  return enabled === 'enabled';
}

export async function hasSeenBiometricOffer(userId: string) {
  if (!userId) return false;
  const seen = await SecureStore.getItemAsync(offerKey(userId)).catch(() => null);
  return seen === 'seen';
}

export async function markBiometricOfferSeen(userId: string) {
  if (!userId) return;
  await SecureStore.setItemAsync(offerKey(userId), 'seen');
}

const preferenceListeners = new Set<() => void>();

export function subscribeBiometricPreference(listener: () => void) {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
}

function notifyPreferenceChanged() {
  for (const listener of preferenceListeners) listener();
}

export async function enableBiometricUnlock(userId: string) {
  const availability = await biometricAvailability();
  if (!availability.available)
    throw new Error(availability.reason ?? 'Biometric unlock is unavailable.');
  await authenticateWithBiometrics(`Enable ${availability.label} for Beaver`);
  await SecureStore.setItemAsync(preferenceKey(userId), 'enabled');
  notifyPreferenceChanged();
  return availability;
}

export async function disableBiometricUnlock(userId: string) {
  await SecureStore.deleteItemAsync(preferenceKey(userId));
  notifyPreferenceChanged();
}
