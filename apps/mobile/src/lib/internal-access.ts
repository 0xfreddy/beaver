import Constants from 'expo-constants';

/** Explicit build-time gate for internal-team and App Review synthetic accounts. */
export function isInternalAccessEnabled() {
  const extra = Constants.expoConfig?.extra as { internalAccessEnabled?: unknown } | undefined;
  return extra?.internalAccessEnabled === true;
}

export function isSyntheticUserId(userId: string) {
  return userId === 'review:app-store' || userId.startsWith('team:');
}
