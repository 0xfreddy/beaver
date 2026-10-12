import { useState, type PropsWithChildren } from 'react';
import { AuthContext } from './auth-context';
import {
  createReviewSession,
  REVIEW_AUTH_EMAIL,
  REVIEW_AUTH_TOKEN,
  REVIEW_AUTH_WALLET,
} from '../lib/review-auth';
import { devnetDepositOptions } from '../lib/deposit-options';

/** Credential-free source preview. The caller must enforce the non-production mock gate. */
export function SampleAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<ReturnType<typeof createReviewSession> | null>(
    createReviewSession,
  );
  const unavailable = async () => {
    throw new Error(
      'This is a sample account. Configure Privy and the account service for live sign-in.',
    );
  };
  const signIn = async () => {
    setSession(createReviewSession());
  };
  return (
    <AuthContext.Provider
      value={{
        configured: true,
        isReady: true,
        isSyncing: false,
        sessionError: null,
        session,
        user: session
          ? {
              id: session.user.id,
              email: REVIEW_AUTH_EMAIL,
              phone: null,
              walletAddress: REVIEW_AUTH_WALLET,
            }
          : null,
        cardOnramp: { available: false, sandbox: true },
        startCardOnramp: unavailable,
        sendEmailCode: async () => {},
        loginWithEmail: signIn,
        sendPhoneCode: unavailable,
        loginWithPhone: unavailable,
        loginWithApple: unavailable,
        loginWithGoogle: unavailable,
        logout: async () => {
          setSession(null);
        },
        getAccessToken: async () => (session ? REVIEW_AUTH_TOKEN : null),
        refreshSession: async () => {},
        createSolanaWallet: async () => {},
        listDepositOptions: async () => devnetDepositOptions(),
        createDeposit: async (option) => ({
          id: 'sample-deposit',
          address: REVIEW_AUTH_WALLET,
          sourceChain: option.caip2,
          createdAt: new Date().toISOString(),
          estimatedSeconds: 30,
        }),
        authorizeAutomation: async () => {},
        revokeAutomation: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
