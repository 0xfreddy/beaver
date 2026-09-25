import { SpendingSetup } from '../../components/spending-setup';
import { useOnboardingFlow } from '../../lib/onboarding-flow';

export default function BankSetup() {
  const flow = useOnboardingFlow();
  return <SpendingSetup onContinue={(step) => flow.next(step)} />;
}
