import { useAuth } from '../providers/auth-provider';
import { recordIntroduction } from './introduction-event';
import { router, type Href } from 'expo-router';
import { useOnboarding } from '../providers/onboarding-provider';
type OnboardingStep =
  | 'welcome'
  | 'account'
  | 'invite-code'
  | 'name'
  | 'intro'
  | 'bank'
  | 'rules'
  | 'fallback'
  | 'manual'
  | 'spending'
  | 'controls'
  | 'enter-app';

// The two “Did you know…” stories are retired; their routes were removed with the screens.
export const POST_WELCOME_STEP = 'spending' satisfies OnboardingStep;

export function useOnboardingFlow() {
  const onboarding = useOnboarding();
  const auth = useAuth();
  return {
    push: (step: OnboardingStep) => router.push(`/onboarding/${step}` as Href),
    next: async (step: OnboardingStep) => {
      router.push(`/onboarding/${step}` as Href);
    },
    reviewIntroduction: () => {
      if (auth.session && auth.user)
        void recordIntroduction(auth.user.id, auth.getAccessToken).catch(() => {});
    },
    finish: async () => {
      await onboarding.complete();
      router.dismissAll();
      router.replace('/');
    },
  };
}
