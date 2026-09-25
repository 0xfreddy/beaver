/** Public session data. Provider tokens and credentials never belong in this contract. */
export interface AuthSession {
  user: {
    id: string;
    privyUserId: string;
    email: string | null;
    onboardingState: string;
    jurisdictionStatus: string;
  };
  wallets: {
    id: string;
    address: string;
    chain: string;
    walletType: string;
  }[];
}

/** Created only by the server after token verification and a Privy user lookup. */
export interface VerifiedIdentity {
  privyUserId: string;
  email: string | null;
  appleUserId: string | null;
  wallets: {
    privyWalletId: string;
    address: string;
    chain: 'ethereum' | 'solana';
    walletType: 'embedded';
  }[];
}
