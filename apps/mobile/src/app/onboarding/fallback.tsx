import { FallbackStock } from '../../components/fallback-stock';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
export default function Fallback() {
  const flow = useOnboardingFlow();
  return <FallbackStock onContinue={() => void flow.next('enter-app')} />;
}
