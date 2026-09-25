import { createContext, useContext, useLayoutEffect, useState, type PropsWithChildren } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-provider';
import { captureMockDataEvent, setSyntheticSession } from '../lib/telemetry';
import {
  clearMockData,
  isMockDataEligible,
  loadCanonicalMockData,
  restoreMockData,
} from '../lib/mock-data';
import { MOCK_FIXTURE_VERSION } from '../lib/mock-fixture';
import { isBypassUserId } from '../lib/review-auth';

type MockDataContextValue = {
  available: boolean;
  active: boolean;
  ready: boolean;
  busy: boolean;
  error: string | null;
  version: typeof MOCK_FIXTURE_VERSION;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  clear: () => Promise<void>;
};

const Context = createContext<MockDataContextValue | null>(null);

async function resetAppQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries({
    predicate: (query) => query.queryKey[0] !== 'auth-session',
  });
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth-session' });
}

export function MockDataProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const ownerId = auth.user?.id ?? null;
  const available = isMockDataEligible();
  const [state, setState] = useState({
    ownerId: null as string | null,
    active: false,
    ready: !ownerId,
    busy: false,
    error: null as string | null,
  });

  useLayoutEffect(() => {
    let current = true;
    setState({ ownerId, active: false, ready: !ownerId, busy: false, error: null });
    if (!ownerId) {
      setSyntheticSession(false);
      void restoreMockData('__signed_out__');
      return () => {
        current = false;
      };
    }
    void restoreMockData(ownerId)
      .then(async (fixture) => {
        if (!current) return;
        const activeFixture =
          fixture ?? (isBypassUserId(ownerId) ? await loadCanonicalMockData(ownerId) : null);
        if (activeFixture) await resetAppQueries(queryClient);
        setSyntheticSession(!!activeFixture);
        if (current)
          setState({ ownerId, active: !!activeFixture, ready: true, busy: false, error: null });
      })
      .catch(() => {
        if (current)
          setState({
            ownerId,
            active: false,
            ready: true,
            busy: false,
            error: 'Couldn’t restore the sample account.',
          });
      });
    return () => {
      current = false;
    };
  }, [ownerId, queryClient]);

  async function run(operation: 'load' | 'clear') {
    if (!ownerId) throw new Error('Sign in before loading a sample account.');
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      if (operation === 'load') captureMockDataEvent('mock_data_load_started');
      if (operation === 'clear') await clearMockData(ownerId);
      else await loadCanonicalMockData(ownerId);
      await resetAppQueries(queryClient);
      setSyntheticSession(operation !== 'clear');
      captureMockDataEvent(
        operation === 'clear' ? 'mock_data_clear_succeeded' : 'mock_data_load_succeeded',
      );
      setState({
        ownerId,
        active: operation !== 'clear',
        ready: true,
        busy: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      setState((current) => ({ ...current, busy: false, error: message }));
      throw error;
    }
  }

  const ready = state.ownerId === ownerId && state.ready;
  return (
    <Context.Provider
      value={{
        available,
        active: ready && state.active,
        ready,
        busy: state.busy,
        error: state.error,
        version: MOCK_FIXTURE_VERSION,
        load: () => run('load'),
        reload: () => run('load'),
        clear: () => run('clear'),
      }}
    >
      {/* Account changes must never unmount Expo Router. Doing so during OTP completion loses the
          onboarding route and remounts the app at the tab navigator's initial route. */}
      {children}
    </Context.Provider>
  );
}

export function useMockData() {
  const value = useContext(Context);
  if (!value) throw new Error('useMockData must be used within MockDataProvider');
  return value;
}
