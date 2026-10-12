import type { DepositInstruction, DepositOption } from '../lib/deposit-options';

export type MobileWalletDepositProps = {
  instruction: DepositInstruction;
  option: DepositOption;
  onConfirmed(): void;
};

// Metro resolves the Android implementation only on Android; MWA's native module
// and Solana transaction dependencies never enter the iOS/web funding screen.
export function MobileWalletDeposit(_props: MobileWalletDepositProps) {
  return null;
}
