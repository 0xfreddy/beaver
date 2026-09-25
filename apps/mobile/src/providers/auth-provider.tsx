import { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PrivyProvider,
  usePrivy,
  useLoginWithEmail,
  useLoginWithSMS,
  useLoginWithOAuth,
  useEmbeddedSolanaWallet,
  useSigners,
  useDepositAddress,
} from '@privy-io/expo';
import { PrivyElements, PrivyUIError, useFundSolanaWallet } from '@privy-io/expo/ui';
import { fetchSession, sessionRetryDelay, shouldRetrySession } from '../lib/api';
import { devnetDepositOptions } from '../lib/deposit-options';
import { isMockDataActive } from '../lib/mock-data';
import { normalizePhoneNumber } from '../lib/phone';
import { isInternalTester, posthog, setInternalTeamTester } from '../lib/telemetry';
import { useTheme } from '../theme';
import {
  REVIEW_AUTH_TOKEN,
  REVIEW_AUTH_WALLET,
  clearReviewSession,
  clearTeamSession,
  createReviewSession,
  createTeamSession,
  isReviewAuthCode,
  isReviewAuthEmail,
  isReviewAuthEnabled,
  isTeamAuthCode,
  persistReviewSession,
  persistTeamSession,
  restoreBypassSession,
} from '../lib/review-auth';
import { AuthContext, UnavailableAuthProvider } from './auth-context';
export { useAuth } from './auth-context';

const solanaNetwork =
  process.env.EXPO_PUBLIC_SOLANA_NETWORK === 'devnet' ? ('devnet' as const) : ('mainnet' as const);

function SessionBridge({ children }: PropsWithChildren) {
  const privy = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const signers = useSigners();
  const deposits = useDepositAddress();
  const fundSolana = useFundSolanaWallet();
  const theme = useTheme();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const {
    sendCode: sendSmsCode,
    loginWithCode: loginWithSmsCode,
  } = useLoginWithSMS();
  const { login } = useLoginWithOAuth();
  const queryClient = useQueryClient();
  const [reviewSession, setReviewSession] = useState<ReturnType<typeof createReviewSession> | null>(
    null,
  );
  const [reviewSessionLoaded, setReviewSessionLoaded] = useState(false);
  const cardOnrampSandbox = solanaNetwork === 'devnet';
  const cardOnrampAvailable = !reviewSession && !isMockDataActive();
  const userId = reviewSession?.user.id ?? privy.user?.id;
  const previousUserId = useRef(userId);
  const identifiedUserId = useRef<string | null>(null);
  const wallet = privy.user?.linked_accounts.find(
    (account) =>
      account.type === 'wallet' &&
      account.wallet_client_type === 'privy' &&
      account.chain_type === 'solana',
  );
  const walletAddress = wallet?.type === 'wallet' ? wallet.address : null;
  const activeWalletAddress = reviewSession ? REVIEW_AUTH_WALLET : walletAddress;
  const email = privy.user?.linked_accounts.find((account) => account.type === 'email');
  const apple = privy.user?.linked_accounts.find((account) => account.type === 'apple_oauth');
  const google = privy.user?.linked_accounts.find((account) => account.type === 'google_oauth');
  const phoneAccount = privy.user?.linked_accounts.find((account) => account.type === 'phone');
  const userPhone = phoneAccount?.type === 'phone' ? phoneAccount.phoneNumber : null;
  const userEmail = reviewSession?.user.email ??
    (email?.type === 'email'
      ? email.address
      : apple?.type === 'apple_oauth'
        ? apple.email
        : google?.type === 'google_oauth'
          ? google.email
          : null);
  const sessionQuery = useQuery({
    queryKey: ['auth-session', userId, walletAddress],
    queryFn: ({ signal }) => fetchSession(privy.getAccessToken, signal),
    enabled: !reviewSession && privy.isReady && !!userId && !privy.error,
    staleTime: 60000,
    gcTime: 0,
    retry: shouldRetrySession,
    retryDelay: sessionRetryDelay,
  });

  useEffect(() => {
    let active = true;
    void restoreBypassSession()
      .then((session) => {
        if (!active) return;
        setReviewSession(session);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReviewSessionLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) {
      if (identifiedUserId.current) posthog?.reset();
      identifiedUserId.current = null;
      setInternalTeamTester(false);
      return;
    }
    if (identifiedUserId.current && identifiedUserId.current !== userId) posthog?.reset();
    // Review/sample sessions and the team's own accounts are marked as persons
    // and on every event, so product dashboards can exclude them cleanly.
    const internal = !!reviewSession || isInternalTester(userEmail);
    posthog?.identify(userId, {
      ...(userEmail ? { email: userEmail } : {}),
      internal_team: internal,
      ...(reviewSession ? { synthetic_user: true } : {}),
    });
    setInternalTeamTester(internal);
    identifiedUserId.current = userId;
  }, [userId, userEmail, reviewSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) {
        void queryClient.invalidateQueries({ queryKey: ['auth-session', userId] });
      }
    });
    return () => subscription.remove();
  }, [userId, queryClient]);

  const requireReady = () => {
    if (!privy.isReady || privy.error)
      throw new Error('Sign-in is still loading. Please try again.');
  };
  return (
    <AuthContext.Provider
      value={{
        configured: true,
        // Initialization errors must release the splash so the error is visible.
        isReady: (privy.isReady || !!privy.error) && reviewSessionLoaded,
        user: reviewSession
          ? {
              id: reviewSession.user.id,
              email: reviewSession.user.email,
              phone: null,
              walletAddress: REVIEW_AUTH_WALLET,
            }
          : privy.isReady && privy.user
            ? {
                id: privy.user.id,
                email: userEmail,
                phone: userPhone,
                walletAddress,
              }
            : null,
        session:
          reviewSession ??
          (privy.isReady && userId && !sessionQuery.isError ? (sessionQuery.data ?? null) : null),
        sessionError: reviewSession
          ? null
          : privy.error
            ? 'Sign-in could not start. Please reopen the app.'
            : sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : null,
        isSyncing: reviewSession ? false : sessionQuery.isFetching,
        cardOnramp: { available: cardOnrampAvailable, sandbox: cardOnrampSandbox },
        async startCardOnramp(asset) {
          requireReady();
          if (!cardOnrampAvailable)
            throw new Error('Card purchases aren’t available in this preview.');
          if (!activeWalletAddress)
            throw new Error('Create your account wallet before adding money.');
          // MoonPay test mode cannot sell USDC on Solana (usdc_sol has no test
          // environment), so devnet builds exercise the widget with sandbox SOL.
          // The amount must be explicit: the dashboard default would otherwise be
          // sent as the fiat quote amount and fall below MoonPay's minimum.
          const sandboxAsset: 'USDC' | 'native-currency' = 'native-currency';
          try {
            await fundSolana.fundWallet({
              address: activeWalletAddress,
              asset: cardOnrampSandbox
                ? sandboxAsset
                : asset === 'USDC'
                  ? 'USDC'
                  : 'native-currency',
              amount: cardOnrampSandbox ? '20' : '50',
              cluster: { name: cardOnrampSandbox ? 'devnet' : 'mainnet-beta' },
              defaultPaymentMethod: 'card',
              card: { preferredProvider: 'moonpay' },
              moonpay: {
                useSandbox: cardOnrampSandbox,
                uiConfig: { theme: theme.isDark ? 'dark' : 'light' },
              },
            });
            return 'completed';
          } catch (error) {
            if (
              error instanceof PrivyUIError &&
              (error.code === 'funding_flow_cancelled' || error.code === 'ui_flow_closed')
            ) {
              return 'dismissed';
            }
            throw error;
          }
        },
        async sendEmailCode(address) {
          if (isReviewAuthEnabled() && isReviewAuthEmail(address)) return;
          requireReady();
          const result = await sendCode({ email: address.trim().toLowerCase() });
          if (!result.success)
            throw new Error('The email provider did not accept the code request. Please retry.');
        },
        async loginWithEmail(address, code) {
          // The team bypass code admits any email; the review sample account keeps
          // its dedicated identity so App Review sees a stable account.
          if (isReviewAuthEnabled() && isTeamAuthCode(code)) {
            await queryClient.cancelQueries();
            await persistTeamSession(address);
            queryClient.clear();
            setReviewSession(createTeamSession(address));
            return;
          }
          if (isReviewAuthEnabled() && isReviewAuthEmail(address)) {
            if (!isReviewAuthCode(address, code)) throw new Error('Invalid review code.');
            await queryClient.cancelQueries();
            await persistReviewSession();
            queryClient.clear();
            setReviewSession(createReviewSession());
            return;
          }
          requireReady();
          await loginWithCode({ email: address.trim().toLowerCase(), code: code.trim() });
        },
        async sendPhoneCode(number) {
          requireReady();
          const phone = normalizePhoneNumber(number);
          if (!phone) throw new Error('Enter a valid phone number with its country code.');
          const result = await sendSmsCode({ phone });
          if (!result.success)
            throw new Error('The SMS provider did not accept the code request. Please retry.');
        },
        async loginWithPhone(number, code) {
          requireReady();
          const phone = normalizePhoneNumber(number);
          if (!phone) throw new Error('Enter a valid phone number with its country code.');
          await loginWithSmsCode({ phone, code: code.trim() });
        },
        async loginWithApple() {
          requireReady();
          await login({ provider: 'apple' });
        },
        async loginWithGoogle() {
          requireReady();
          await login({ provider: 'google' });
        },
        async logout() {
          await queryClient.cancelQueries();
          setReviewSession(null);
          await clearReviewSession();
          await clearTeamSession();
          if (privy.user) await privy.logout();
          queryClient.clear();
        },
        getAccessToken: reviewSession ? async () => REVIEW_AUTH_TOKEN : privy.getAccessToken,
        async createSolanaWallet() {
          requireReady();
          if (!userId) throw new Error('Sign in to create your wallet.');
          if (reviewSession || isMockDataActive()) return;
          if (!activeWalletAddress) {
            if (!solana.create) throw new Error('Wallet creation is not ready. Please retry.');
            await solana.create();
          }
          await sessionQuery.refetch({ throwOnError: true });
        },
        async listDepositOptions() {
          requireReady();
          if (reviewSession || isMockDataActive()) return devnetDepositOptions();
          if (!activeWalletAddress)
            throw new Error('Create your account wallet before adding money.');
          if (solanaNetwork === 'devnet') return devnetDepositOptions();
          const config = await deposits.getConfig();
          const usdc = config.currencies.find(
            (currency) => currency.symbol.toUpperCase() === 'USDC',
          );
          if (!usdc) throw new Error('USDC deposits are not enabled for this app.');
          // Deposits are credited from finalized Solana transfers only; relay
          // deposits from other chains are deliberately not offered.
          const destination = usdc.chains.find((entry) => entry.caip2.startsWith('solana:'));
          if (!destination) throw new Error('The Beaver USDC wallet is not available.');
          const chain = config.chains[destination.caip2];
          return [
            {
              asset: 'USDC' as const,
              caip2: destination.caip2,
              name: chain?.displayName ?? destination.caip2,
              iconUrl: chain?.iconUrl ?? null,
              tokenAddress: destination.address,
              decimals: destination.decimals,
            },
          ];
        },
        async createDeposit(network) {
          requireReady();
          if (reviewSession || isMockDataActive())
            return {
              id: `mock_deposit_${network.asset.toLowerCase()}`,
              address: 'mock_solana_wallet_full_account_v1',
              sourceChain: network.caip2,
              createdAt: new Date().toISOString(),
              estimatedSeconds: 30,
            };
          if (!activeWalletAddress)
            throw new Error('Create your account wallet before adding money.');
          return {
            id: null,
            address: activeWalletAddress,
            sourceChain: network.caip2,
            createdAt: new Date().toISOString(),
            estimatedSeconds: 30,
          };
        },
        async authorizeAutomation(address, signerId, policyId) {
          requireReady();
          if (reviewSession || isMockDataActive()) return;
          if (address !== activeWalletAddress)
            throw new Error('Wallet does not match your account.');
          await signers.addSigners({ address, signers: [{ signerId, policyIds: [policyId] }] });
        },
        async revokeAutomation(address) {
          requireReady();
          if (reviewSession || isMockDataActive()) return;
          if (address !== activeWalletAddress)
            throw new Error('Wallet does not match your account.');
          await signers.removeSigners({ address });
        },
        async refreshSession() {
          requireReady();
          if (!userId) throw new Error('Sign in to continue.');
          if (reviewSession) return;
          await sessionQuery.refetch({ throwOnError: true });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID?.trim();
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID?.trim();
  if (!appId || !clientId)
    return (
      <UnavailableAuthProvider reason="Sign-in is not configured for this build.">
        {children}
      </UnavailableAuthProvider>
    );
  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{ embedded: { solana: { createOnLogin: 'all-users' } } }}
    >
      <SessionBridge>{children}</SessionBridge>
      <PrivyElements />
    </PrivyProvider>
  );
}
