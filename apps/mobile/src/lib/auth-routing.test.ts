import { describe, expect, it } from 'vitest';
import { onboardingRedirect, shouldShowOnboarding, shouldWaitForSession } from './auth-routing';

describe('session restoration', () => {
  it('keeps a restored user behind the splash while the backend session resolves', () => {
    expect(shouldWaitForSession('user-a', false, true)).toBe(true);
  });

  it('does not wait once a session exists or the user is signed out', () => {
    expect(shouldWaitForSession('user-a', true, true)).toBe(false);
    expect(shouldWaitForSession(null, false, true)).toBe(false);
  });
});

describe('authenticated startup routing', () => {
  it('keeps a restored user in the app while the backend session refreshes', () => {
    expect(shouldShowOnboarding(['user-a'], 'user-a', null)).toBe(false);
  });

  it('routes an actually signed-out user to onboarding', () => {
    expect(shouldShowOnboarding(['user-a'], null, null)).toBe(true);
  });

  it('keeps an unfinished introduction in onboarding', () => {
    expect(shouldShowOnboarding([], 'user-a', 'new')).toBe(true);
  });

  it('does not reuse one account’s completed onboarding for a new email', () => {
    expect(shouldShowOnboarding(['user-a'], 'user-b', 'new')).toBe(true);
  });

  it('recognizes a returning account from its server onboarding state', () => {
    expect(shouldShowOnboarding([], 'user-a', 'paused')).toBe(false);
  });

  it('redirects a new account away from every app tab once its session resolves', () => {
    for (const pathname of ['/', '/portfolio', '/leaderboards', '/settings']) {
      expect(onboardingRedirect(pathname, true, false, false)).toBe('/onboarding/account');
    }
  });

  it('does not interrupt the account screen while authentication is still resolving', () => {
    expect(onboardingRedirect('/onboarding/account', true, true, true)).toBeNull();
    expect(onboardingRedirect('/onboarding/account', true, false, false)).toBeNull();
  });

  it('moves an authenticated new account from sign-in to the invite code step', () => {
    expect(onboardingRedirect('/onboarding/account', true, false, true)).toBe(
      '/onboarding/invite-code',
    );
  });
});

it.each(['/moneykit/callback', '/saltedge/link', '/saltedge/callback'])(
  'allows authenticated onboarding bank navigation to %s',
  (path) => {
    expect(onboardingRedirect(path, true, false, true)).toBeNull();
    expect(onboardingRedirect(path, true, false, false)).toBe('/onboarding/account');
  },
);
it('keeps other destinations gated until onboarding is complete', () => {
  expect(onboardingRedirect('/funding', true, false, true)).toBe('/onboarding/account');
});
