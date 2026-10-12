import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Type, Button, TextButton } from '../../components/ui';
import { continueSaltEdgeLink } from '../../lib/bank-link-saltedge';
import {
  clearPendingSaltEdge,
  loadPendingSaltEdge,
  type PendingSaltEdgeCompletion,
} from '../../lib/saltedge-pending';
import { ApiError } from '../../lib/api';
import { completeBankConnection } from '../../lib/bank-completion';
import { useAuth } from '../../providers/auth-provider';
import { posthog } from '../../lib/telemetry';
import { SetupPage } from '../../components/setup-page';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { useTheme } from '../../theme';
import {
  bankConnectFailureKind,
  bankRecoveryAction,
  bankReturnDestination,
  type BankConnectFailureKind,
} from '../../lib/bank-connect-state';

type Phase =
  | { kind: 'waiting' }
  | { kind: 'finishing' }
  | { kind: 'success'; bank: string }
  | { kind: 'failed'; reason: BankConnectFailureKind; message: string };

// Keep the session durable across navigation and process death until completion succeeds.
export default function SaltEdgeCallback() {
  const auth = useAuth();
  const cache = useQueryClient();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'waiting' });
  const claimed = useRef<PendingSaltEdgeCompletion | null>(null);
  const handled = useRef<string | null>(null);
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
    };
  }, []);

  function backToBanks(connectAnother = false) {
    const returnTo = claimed.current?.returnTo || '/onboarding/bank';
    if (left.current) return;
    left.current = true;
    router.dismissTo(bankReturnDestination(returnTo, connectAnother) as never);
  }

  async function finalize(pending: PendingSaltEdgeCompletion) {
    setPhase({ kind: 'finishing' });
    try {
      const result = await completeBankConnection(
        { ...pending, recovery: true },
        auth.getAccessToken,
      );
      posthog?.capture('bank_connection_completed', {
        connection_mode: pending.mode,
        recovered: true,
        bank: result?.institutionName ?? null,
      });
      await cache.invalidateQueries({ queryKey: ['live', pending.userId] });
      // The banks list is the confirmation: the connection shows by name with
      // its in-progress sync, plus connect-another / skip affordances.
      if (!left.current)
        setPhase({ kind: 'success', bank: result?.institutionName ?? 'Your bank' });
    } catch (error) {
      if (left.current) return;
      setPhase({
        kind: 'failed',
        reason: bankConnectFailureKind(error instanceof ApiError ? error.code : undefined),
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }

  async function arrive(url: string) {
    const resumed = await continueSaltEdgeLink(url).catch(() => false);
    if (resumed) return; // The warm in-app flow finalizes itself.
    const stored = await loadPendingSaltEdge();
    if (!stored) {
      // Nothing to finish — a closed widget or an unrelated link; go home.
      backToBanks();
      return;
    }
    if (!auth.user?.id) return; // Session still resolving; the effect re-runs.
    if (stored.userId !== auth.user.id) {
      backToBanks();
      return;
    }
    claimed.current = stored;
    await finalize(stored);
  }

  useEffect(() => {
    // Do not consume the launch URL before authentication is ready.
    if (!auth.user?.id) return;
    let current = true;
    const handle = (incoming: string | null) => {
      if (!incoming || !current || handled.current === incoming) return;
      handled.current = incoming;
      void arrive(incoming).catch(() => {
        if (current) backToBanks();
      });
    };
    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    // A consumed or lost launch URL must not leave a dead spinner behind.
    const watchdog = setTimeout(() => {
      if (current && !handled.current) backToBanks();
    }, 4000);
    return () => {
      current = false;
      subscription.remove();
      clearTimeout(watchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  const recovery =
    phase.kind === 'failed' ? bankRecoveryAction(phase.reason, !!claimed.current) : null;
  return (
    <SetupPage
      animateTitle={false}
      title={
        phase.kind === 'success'
          ? `${phase.bank} connected`
          : phase.kind === 'failed'
            ? 'Couldn’t connect'
            : 'Finishing your connection'
      }
      actions={
        <>
          {phase.kind === 'failed' ? (
            <Button
              appearance="onboarding"
              title={
                recovery === 'view_banks'
                  ? 'View banks'
                  : recovery === 'connect'
                    ? 'Connect again'
                    : 'Try again'
              }
              onPress={() => {
                if (recovery === 'finalize' && claimed.current) void finalize(claimed.current);
                else
                  void (async () => {
                    await clearPendingSaltEdge(claimed.current?.linkSessionId);
                    backToBanks(recovery === 'connect');
                  })();
              }}
            />
          ) : null}
          {phase.kind === 'success' ? (
            <Button appearance="onboarding" title="Continue" onPress={() => backToBanks()} />
          ) : (
            <TextButton title="Back" onPress={() => backToBanks()} />
          )}
        </>
      }
    >
      <OnboardingAnimation name="bank-bridge-builder" height={180} loop={false} />
      <View style={styles.wait} accessibilityLiveRegion="polite">
        {phase.kind !== 'failed' && phase.kind !== 'success' ? (
          <ActivityIndicator color={colors.muted} />
        ) : null}
        <Type
          muted
          accessibilityRole={phase.kind === 'failed' ? 'alert' : undefined}
          style={styles.copy}
        >
          {phase.kind === 'success'
            ? 'Your purchases are syncing.'
            : phase.kind === 'failed'
              ? phase.message
              : 'Checking your bank’s response…'}
        </Type>
      </View>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  wait: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, fontSize: 16, lineHeight: 24 },
});
