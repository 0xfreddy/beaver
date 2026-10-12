import type { WithdrawalDestinationProof } from '@roundups/types';
export type MobileWalletDestinationProps = {
  disabled: boolean;
  onVerified: (proof: WithdrawalDestinationProof) => void;
  onBusy: (busy: boolean) => void;
};
export function MobileWalletDestination(_props: MobileWalletDestinationProps) {
  return null;
}
