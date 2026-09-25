export function shouldShowOnboarding(
  completedUserIds: readonly string[],
  authenticatedUserId: string | null,
  serverOnboardingState: string | null,
) {
  if (!authenticatedUserId) return true;
  if (completedUserIds.includes(authenticatedUserId)) return false;
  return serverOnboardingState === null || serverOnboardingState === 'new';
}

export function shouldWaitForSession(
  authenticatedUserId: string | null,
  hasSession: boolean,
  isSyncing: boolean,
) {
  return authenticatedUserId !== null && !hasSession && isSyncing;
}

export function onboardingRedirect(
  pathname: string,
  needsOnboarding: boolean,
  sessionCompletionPending: boolean,
  authenticated: boolean,
): '/onboarding/account' | '/onboarding/invite-code' | '/' | null {
  if (sessionCompletionPending) return null;
  const inOnboarding = pathname.startsWith('/onboarding');
  const bankLinkRoute = ['/moneykit/callback', '/saltedge/link', '/saltedge/callback'].includes(
    pathname,
  );
  if (authenticated && bankLinkRoute) return null;
  if (authenticated && needsOnboarding && pathname === '/onboarding/account')
    return '/onboarding/invite-code';
  if (needsOnboarding && !inOnboarding && pathname !== '/invite') return '/onboarding/account';
  if (!needsOnboarding && pathname === '/onboarding/account') return '/';
  return null;
}
