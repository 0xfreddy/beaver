import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import type { AuthSession } from '@roundups/types';
import type { DepositAsset, DepositInstruction, DepositOption } from '../lib/deposit-options';

export type CardOnrampOutcome = 'completed' | 'dismissed';

export interface AuthState {
  configured: boolean;
  isReady: boolean;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    walletAddress: string | null;
  } | null;
  session: AuthSession | null;
  sessionError: string | null;
  isSyncing: boolean;
  cardOnramp: { available: boolean; sandbox: boolean };
  startCardOnramp(asset: DepositAsset): Promise<CardOnrampOutcome>;
  sendEmailCode(email: string): Promise<void>;
  loginWithEmail(email: string, code: string): Promise<void>;
  sendPhoneCode(phone: string): Promise<void>;
  loginWithPhone(phone: string, code: string): Promise<void>;
  loginWithApple(): Promise<void>;
  loginWithGoogle(): Promise<void>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  refreshSession(): Promise<void>;
  createSolanaWallet(): Promise<void>;
  listDepositOptions(): Promise<DepositOption[]>;
  createDeposit(option: DepositOption): Promise<DepositInstruction>;
  authorizeAutomation(address: string, signerId: string, policyId: string): Promise<void>;
  revokeAutomation(address: string): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function UnavailableAuthProvider({
  children,
  reason,
}: PropsWithChildren<{ reason: string }>) {
  const unavailable = async () => {
    throw new Error(reason);
  };
  return (
    <AuthContext.Provider
      value={{
        configured: false,
        isReady: true,
        user: null,
        session: null,
        sessionError: reason,
        isSyncing: false,
        cardOnramp: { available: false, sandbox: false },
        startCardOnramp: unavailable,
        sendEmailCode: unavailable,
        loginWithEmail: unavailable,
        sendPhoneCode: unavailable,
        loginWithPhone: unavailable,
        loginWithApple: unavailable,
        loginWithGoogle: unavailable,
        logout: async () => {},
        getAccessToken: async () => null,
        refreshSession: unavailable,
        createSolanaWallet: unavailable,
        listDepositOptions: unavailable,
        createDeposit: unavailable,
        authorizeAutomation: unavailable,
        revokeAutomation: unavailable,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
