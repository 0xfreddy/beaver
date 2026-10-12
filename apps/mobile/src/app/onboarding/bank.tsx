import { useLocalSearchParams } from 'expo-router';
import { SpendingSetup } from '../../components/spending-setup';
import { useOnboardingFlow } from '../../lib/onboarding-flow';

export default function BankSetup() {
  const params = useLocalSearchParams<{ stage?: string; link?: string }>();
  const flow = useOnboardingFlow();
  return (
    <SpendingSetup
      initialStage={params.stage === 'connect' || params.link === '1' ? 'connect' : 'bank'}
      onContinue={(step) => flow.next(step)}
    />
  );
}
