import Constants from 'expo-constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void storage.set(key, value)),
    removeItem: vi.fn(async (key: string) => void storage.delete(key)),
  },
}));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { environment: 'staging', mockDataEnabled: true, internalAccessEnabled: false },
    },
  },
}));

import {
  REVIEW_AUTH_CODE,
  REVIEW_AUTH_EMAIL,
  REVIEW_AUTH_LEGACY_CODE,
  REVIEW_AUTH_USER_ID,
  REVIEW_AUTH_WALLET,
  TEAM_AUTH_CODE,
  clearReviewSession,
  clearTeamSession,
  createReviewSession,
  createTeamSession,
  isReviewAuthCode,
  isReviewAuthEmail,
  isReviewAuthEnabled,
  isTeamAuthCode,
  persistReviewSession,
  persistTeamSession,
  restoreBypassSession,
  restoreReviewSession,
  restoreTeamSession,
} from './review-auth';

beforeEach(() => {
  Constants.expoConfig!.extra!.environment = 'staging';
  Constants.expoConfig!.extra!.mockDataEnabled = true;
  Constants.expoConfig!.extra!.internalAccessEnabled = false;
  storage.clear();
  vi.clearAllMocks();
});

describe('review auth', () => {
  it('does not restore synthetic sessions in production even with the flag enabled', async () => {
    await persistTeamSession('dev@example.com');
    await persistReviewSession();
    Constants.expoConfig!.extra!.environment = 'production';
    Constants.expoConfig!.extra!.mockDataEnabled = true;
    expect(isReviewAuthEnabled()).toBe(false);
    expect(await restoreBypassSession()).toBeNull();
  });

  it('is available only through the sample-account build gate', () => {
    expect(isReviewAuthEnabled()).toBe(true);
  });

  it('enables synthetic access in an explicitly review-enabled production build', async () => {
    Constants.expoConfig!.extra!.environment = 'production';
    Constants.expoConfig!.extra!.mockDataEnabled = false;
    Constants.expoConfig!.extra!.internalAccessEnabled = true;
    expect(isReviewAuthEnabled()).toBe(true);
    await persistTeamSession('dev@example.com');
    expect(await restoreBypassSession()).toMatchObject({ user: { id: 'team:dev@example.com' } });
  });

  it('accepts the reviewer email with its alphanumeric or legacy code', () => {
    expect(isReviewAuthEmail(` ${REVIEW_AUTH_EMAIL.toUpperCase()} `)).toBe(true);
    expect(isReviewAuthCode(REVIEW_AUTH_EMAIL, REVIEW_AUTH_CODE)).toBe(true);
    expect(isReviewAuthCode(REVIEW_AUTH_EMAIL, REVIEW_AUTH_CODE.toLowerCase())).toBe(true);
    expect(isReviewAuthCode(REVIEW_AUTH_EMAIL, REVIEW_AUTH_LEGACY_CODE)).toBe(true);
    expect(isReviewAuthCode(REVIEW_AUTH_EMAIL, '123456')).toBe(false);
    expect(isReviewAuthCode('someone@example.com', REVIEW_AUTH_CODE)).toBe(false);
  });

  it('creates a new synthetic account so onboarding starts from the beginning', () => {
    expect(createReviewSession()).toMatchObject({
      user: {
        id: REVIEW_AUTH_USER_ID,
        email: REVIEW_AUTH_EMAIL,
        onboardingState: 'new',
      },
      wallets: [{ chain: 'solana', walletType: 'embedded' }],
    });
  });

  it('persists and clears the synthetic review session across app remounts', async () => {
    expect(await restoreReviewSession()).toBeNull();
    await persistReviewSession();
    expect(await restoreReviewSession()).toMatchObject({ user: { id: REVIEW_AUTH_USER_ID } });
    await clearReviewSession();
    expect(await restoreReviewSession()).toBeNull();
  });
});

describe('reviewer onboarding lifecycle', () => {
  const introduction = 'roundups.introduction.account.v1:review%3Aapp-store';
  const spending = 'roundups.spending-profile.account.v1:review%3Aapp-store';

  it('replays onboarding on an explicit reviewer login without clearing another account', async () => {
    storage.set(introduction, 'seen');
    storage.set(spending, '{"monthlySpend":1500,"transactions":30}');
    storage.set('roundups.introduction.account.v1:someone-else', 'seen');
    await persistReviewSession();
    expect(storage.has(introduction)).toBe(false);
    expect(storage.has(spending)).toBe(false);
    expect(storage.get('roundups.introduction.account.v1:someone-else')).toBe('seen');
  });

  it('keeps completed onboarding when reopening the same reviewer session', async () => {
    await persistReviewSession();
    storage.set(introduction, 'seen');
    await restoreReviewSession();
    expect(storage.get(introduction)).toBe('seen');
    await clearReviewSession();
    await persistReviewSession();
    expect(storage.has(introduction)).toBe(false);
  });
});

describe('team bypass auth', () => {
  const reviewIntroduction = 'roundups.introduction.account.v1:review%3Aapp-store';
  it('accepts the team code for any email, case-insensitively', () => {
    expect(isTeamAuthCode(TEAM_AUTH_CODE)).toBe(true);
    expect(isTeamAuthCode(` ${TEAM_AUTH_CODE.toLowerCase()} `)).toBe(true);
    expect(isTeamAuthCode(REVIEW_AUTH_CODE)).toBe(false);
    expect(isTeamAuthCode('123456')).toBe(false);
  });

  it('creates one synthetic account per email on the shared mock wallet', () => {
    expect(createTeamSession('  Test@Example.COM ')).toMatchObject({
      user: {
        id: 'team:test@example.com',
        email: 'test@example.com',
        onboardingState: 'new',
      },
      wallets: [{ address: REVIEW_AUTH_WALLET, chain: 'solana', walletType: 'embedded' }],
    });
  });

  it('persists and restores the team session until logout', async () => {
    expect(await restoreTeamSession()).toBeNull();
    await persistTeamSession('dev@example.com');
    expect(await restoreTeamSession()).toMatchObject({ user: { id: 'team:dev@example.com' } });
    expect(await restoreBypassSession()).toMatchObject({ user: { id: 'team:dev@example.com' } });
    await clearTeamSession();
    expect(await restoreTeamSession()).toBeNull();
  });

  it('prefers the reviewer sample account when both sign-ins are stored', async () => {
    await persistTeamSession('dev@example.com');
    await persistReviewSession();
    expect(await restoreBypassSession()).toMatchObject({ user: { id: REVIEW_AUTH_USER_ID } });
    await clearReviewSession();
    await clearTeamSession();
  });

  it('restarts onboarding for the signing-in tester only', async () => {
    const own = 'roundups.introduction.account.v1:team%3Adev%40example.com';
    storage.set(own, 'seen');
    storage.set(reviewIntroduction, 'seen');
    await persistTeamSession('dev@example.com');
    expect(storage.has(own)).toBe(false);
    expect(storage.get(reviewIntroduction)).toBe('seen');
  });
});
