import { RoundupRules } from '../../components/roundup-rules';
import { useOnboardingFlow } from '../../lib/onboarding-flow';

export default function Rules() {
  const flow = useOnboardingFlow();
  return <RoundupRules onContinue={() => void flow.next('fallback')} />;
}
