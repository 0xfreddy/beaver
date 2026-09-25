import type { AuthSession } from '@roundups/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isInternalAccessEnabled, isSyntheticUserId } from './internal-access';
import { isMockDataEligible } from './mock-data';
import {
  accountKey,
  accountStoragePrefix,
  accountSpendingStoragePrefix,
} from './onboarding-storage';

export const REVIEW_AUTH_EMAIL = 'app-review@trybeaver.app';
/** Alphanumeric access code shared with App Review; the original six-digit form stays accepted. */
export const REVIEW_AUTH_CODE = 'A9RV';
export const REVIEW_AUTH_LEGACY_CODE = '000000';
/** Internal testing bypass: accepted for any email in an explicitly review-enabled build. */
export const TEAM_AUTH_CODE = 'BVR2';
export const REVIEW_AUTH_USER_ID = 'review:app-store';
export const REVIEW_AUTH_TOKEN = 'review-static-token';
export const REVIEW_AUTH_WALLET = 'mock_solana_wallet_full_account_v1';
const REVIEW_AUTH_STORAGE_KEY = 'roundups.review-auth.v1';
const TEAM_AUTH_STORAGE_KEY = 'roundups.team-auth.v1';

export function normalizeReviewEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isReviewAuthEmail(email: string) {
  return normalizeReviewEmail(email) === REVIEW_AUTH_EMAIL;
}

export function isReviewAuthEnabled() {
  return isMockDataEligible() || isInternalAccessEnabled();
}

const normalizeCode = (code: string) => code.trim().toUpperCase();

export function isReviewAuthCode(email: string, code: string) {
  if (!isReviewAuthEmail(email)) return false;
  const normalized = normalizeCode(code);
  return normalized === REVIEW_AUTH_CODE || normalized === REVIEW_AUTH_LEGACY_CODE;
}

export function isTeamAuthCode(code: string) {
  return normalizeCode(code) === TEAM_AUTH_CODE;
}

/** Synthetic sign-ins (review sample account, team bypass) run on mock data. */
export function isBypassUserId(userId: string) {
  return isSyntheticUserId(userId);
}

export function createReviewSession(): AuthSession {
  return {
    user: {
      id: REVIEW_AUTH_USER_ID,
      privyUserId: 'did:review:app-store',
      email: REVIEW_AUTH_EMAIL,
      onboardingState: 'new',
      jurisdictionStatus: 'eligible',
    },
    wallets: [
      {
        id: 'review-wallet',
        address: REVIEW_AUTH_WALLET,
        chain: 'solana',
        walletType: 'embedded',
      },
    ],
  };
}

export async function persistReviewSession() {
  // Every explicit reviewer sign-in starts the full introduction. Restoring an
  // existing session keeps its progress, just like an ordinary account.
  await Promise.all([
    AsyncStorage.removeItem(accountKey(accountStoragePrefix, REVIEW_AUTH_USER_ID)),
    AsyncStorage.removeItem(accountKey(accountSpendingStoragePrefix, REVIEW_AUTH_USER_ID)),
  ]);
  await AsyncStorage.setItem(REVIEW_AUTH_STORAGE_KEY, REVIEW_AUTH_USER_ID);
}

export async function restoreReviewSession() {
  if (!isReviewAuthEnabled()) return null;
  const value = await AsyncStorage.getItem(REVIEW_AUTH_STORAGE_KEY);
  return value === REVIEW_AUTH_USER_ID ? createReviewSession() : null;
}

export async function clearReviewSession() {
  await AsyncStorage.removeItem(REVIEW_AUTH_STORAGE_KEY);
}

/** Session for internal testers: one synthetic account per email address. */
export function createTeamSession(email: string): AuthSession {
  const normalized = normalizeReviewEmail(email);
  return {
    user: {
      id: `team:${normalized}`,
      privyUserId: `did:team:${normalized}`,
      email: normalized,
      onboardingState: 'new',
      jurisdictionStatus: 'eligible',
    },
    wallets: [
      {
        id: 'team-wallet',
        address: REVIEW_AUTH_WALLET,
        chain: 'solana',
        walletType: 'embedded',
      },
    ],
  };
}

export async function persistTeamSession(email: string) {
  // Like the reviewer sample account, every explicit team sign-in restarts onboarding.
  const userId = createTeamSession(email).user.id;
  await Promise.all([
    AsyncStorage.removeItem(accountKey(accountStoragePrefix, userId)),
    AsyncStorage.removeItem(accountKey(accountSpendingStoragePrefix, userId)),
  ]);
  await AsyncStorage.setItem(TEAM_AUTH_STORAGE_KEY, normalizeReviewEmail(email));
}

export async function restoreTeamSession() {
  if (!isReviewAuthEnabled()) return null;
  const email = await AsyncStorage.getItem(TEAM_AUTH_STORAGE_KEY);
  return email ? createTeamSession(email) : null;
}

export async function clearTeamSession() {
  await AsyncStorage.removeItem(TEAM_AUTH_STORAGE_KEY);
}

/** Restores whichever synthetic sign-in (review or team) is stored, if any. */
export async function restoreBypassSession() {
  return (await restoreReviewSession()) ?? (await restoreTeamSession());
}
