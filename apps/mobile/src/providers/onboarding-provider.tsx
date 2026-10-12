import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './auth-provider';
import { apiRequest, timeoutSignal } from '../lib/api';

import {
  accountStoragePrefix,
  accountSpendingStoragePrefix,
  accountKey,
} from '../lib/onboarding-storage';
export type SpendingProfile = { monthlySpend: number; transactions: number };
const defaultSpendingProfile: SpendingProfile = { monthlySpend: 500, transactions: 10 };
type AccountOnboarding = { completed: boolean; spendingProfile: SpendingProfile };
const Context = createContext<{
  ready: boolean;
  resumePath: string | null;
  rememberPath: (path: string) => void;
  completedUserIds: readonly string[];
  spendingProfile: SpendingProfile;
  complete: () => Promise<void>;
  reset: () => Promise<void>;
  saveSpendingProfile: (profile: SpendingProfile) => Promise<void>;
} | null>(null);

function parseSpendingProfile(value: string | null): SpendingProfile {
  if (!value) return defaultSpendingProfile;
  try {
    const parsed = JSON.parse(value) as Partial<SpendingProfile>;
    if (
      Number.isFinite(parsed.monthlySpend) &&
      Number.isFinite(parsed.transactions) &&
      parsed.monthlySpend! >= 0 &&
      parsed.monthlySpend! <= 20000 &&
      parsed.transactions! >= 5 &&
      parsed.transactions! <= 100
    ) {
      return {
        monthlySpend: Math.round(parsed.monthlySpend!),
        transactions: Math.round(parsed.transactions!),
      };
    }
  } catch {
    return defaultSpendingProfile;
  }
  return defaultSpendingProfile;
}

/** Account-scoped presentation state only. This never activates an account or trading. */
export function OnboardingProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null | undefined>(undefined);
  const [accounts, setAccounts] = useState<Record<string, AccountOnboarding>>({});
  const userId = auth.user?.id ?? null;
  const owner = useRef(userId);
  owner.current = userId;

  useEffect(() => {
    if (!auth.isReady) return;
    if (!userId) {
      setLoadedUserId(null);
      setResumePath(null);
      setAccounts({});
      return;
    }
    let active = true;
    const introductionKey = accountKey(accountStoragePrefix, userId);
    const spendingKey = accountKey(accountSpendingStoragePrefix, userId);
    void Promise.all([
      AsyncStorage.getItem(introductionKey),
      AsyncStorage.getItem(spendingKey),
      AsyncStorage.getItem(`beaver.onboarding-route:${userId}`),
    ])
      .then(([introduction, spending, savedPath]) => {
        if (!active) return;
        setResumePath(
          savedPath?.startsWith('/onboarding/') && savedPath !== '/onboarding/account'
            ? savedPath
            : null,
        );
        const completed = introduction === 'seen';
        const spendingProfile = parseSpendingProfile(spending);
        setAccounts((current) => ({ ...current, [userId]: { completed, spendingProfile } }));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadedUserId(userId);
      });
    return () => {
      active = false;
    };
  }, [auth.isReady, userId]);

  const ready = auth.isReady && loadedUserId === userId;
  const current = userId ? accounts[userId] : undefined;
  const spendingProfile = current?.spendingProfile ?? defaultSpendingProfile;
  const completedUserIds = useMemo(
    () =>
      (ready ? Object.entries(accounts) : []).flatMap(([id, value]) =>
        value.completed ? [id] : [],
      ),
    [accounts, ready],
  );

  function rememberPath(path: string) {
    if (!userId || !path.startsWith('/onboarding/') || path === '/onboarding/account') return;
    setResumePath(path);
    void AsyncStorage.setItem(`beaver.onboarding-route:${userId}`, path).catch(() => {});
  }
  async function complete() {
    if (!userId) throw new Error('Sign in before completing onboarding.');
    // Storage failure must not trap someone in an introduction.
    await AsyncStorage.setItem(accountKey(accountStoragePrefix, userId), 'seen').catch(() => {});
    if (owner.current !== userId) throw new Error('Your account changed. Please sign in again.');
    setAccounts((accounts) => ({
      ...accounts,
      [userId]: { completed: true, spendingProfile },
    }));
    // This only records a completed introduction. A slow or offline server must
    // not hold navigation hostage; no investing/funding state is inferred here.
    void apiRequest(auth.getAccessToken, '/v1/onboarding/complete', {
      method: 'POST',
      signal: timeoutSignal(10_000),
      body: JSON.stringify({}),
    })
      .then(() => (owner.current === userId ? auth.refreshSession() : undefined))
      .catch(() => {});
  }
  async function reset() {
    if (!userId) return;
    setResumePath(null);
    await Promise.all([
      AsyncStorage.removeItem(`beaver.onboarding-route:${userId}`),
      AsyncStorage.removeItem(accountKey(accountStoragePrefix, userId)),
      AsyncStorage.removeItem(accountKey(accountSpendingStoragePrefix, userId)),
    ]).catch(() => {});
    setAccounts((accounts) => ({
      ...accounts,
      [userId]: { completed: false, spendingProfile: defaultSpendingProfile },
    }));
  }
  async function saveSpendingProfile(profile: SpendingProfile) {
    if (!userId) throw new Error('Sign in before saving onboarding preferences.');
    setAccounts((accounts) => ({
      ...accounts,
      [userId]: { completed: accounts[userId]?.completed ?? false, spendingProfile: profile },
    }));
    await AsyncStorage.setItem(
      accountKey(accountSpendingStoragePrefix, userId),
      JSON.stringify(profile),
    ).catch(() => {});
  }
  return (
    <Context.Provider
      value={{
        ready,
        resumePath,
        rememberPath,
        completedUserIds,
        spendingProfile,
        complete,
        reset,
        saveSpendingProfile,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error('OnboardingProvider is missing');
  return value;
}
