import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useAuth } from '../providers/auth-provider';
import { useOnboarding } from '../providers/onboarding-provider';
import { shouldShowOnboarding } from '../lib/auth-routing';
import { pendingInvite } from '../lib/pending-invite';
export function InviteContinuation() {
  const auth = useAuth(),
    onboarding = useOnboarding(),
    path = usePathname();
  const needsOnboarding = shouldShowOnboarding(
    onboarding.completedUserIds,
    auth.user?.id ?? null,
    auth.session?.user.onboardingState ?? null,
  );
  useEffect(() => {
    let active = true;
    // Returning users resume straight at the invitation screen. New users keep
    // their pending code so the invite-code onboarding step can prefill it.
    if (auth.session && !needsOnboarding && path === '/onboarding/account')
      void pendingInvite().then((token) => {
        if (active && token) router.replace({ pathname: '/invite', params: { token } });
      });
    return () => {
      active = false;
    };
  }, [auth.session, auth.user?.id, needsOnboarding, path]);
  return null;
}
