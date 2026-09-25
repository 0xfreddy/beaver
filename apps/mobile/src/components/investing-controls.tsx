import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Slider from '@expo/ui/community/slider';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { apiRequest } from '../lib/api';
import { useLive } from '../lib/live';
import type { Authorization, InvestmentPolicy } from '../lib/live';
import { Screen, Type } from './ui';
import { useTheme } from '../theme';
import { posthog } from '../lib/telemetry';

const DAILY_LIMIT_MIN = 1_000;
const DAILY_LIMIT_MAX = 100_000;
const DAILY_LIMIT_STEP = 1_000;
const DEFAULT_DAILY_LIMIT = 5_000;
// Maximum roundup moves in 50-cent increments; the minimum sits on the same grid.
const MAX_ROUNDUP_MIN = 50;
const MAX_ROUNDUP_MAX = 10_000;
const MAX_ROUNDUP_STEP = 50;
const DEFAULT_MAX_ROUNDUP = 900;
// Sliders emit continuously; persist shortly after the drag settles.
const SAVE_DEBOUNCE_MS = 700;

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCents(cents: number) {
  return usd.format(cents / 100);
}

/**
 * Automatic investing is always on and cannot be paused. This screen only tunes the two
 * limits; changes save by themselves, and a disabled policy re-activates on open.
 */
export function InvestingControls() {
  const auth = useAuth();
  return <Investing key={auth.user?.id ?? 'signed-out'} />;
}

function Investing() {
  const { colors } = useTheme();
  const auth = useAuth();
  const cache = useQueryClient();
  const authorization = useLive<Authorization>('/v1/automation/authorization');
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const [dailyLimitCents, setDailyLimitCents] = useState(DEFAULT_DAILY_LIMIT);
  const [maxRoundupCents, setMaxRoundupCents] = useState(DEFAULT_MAX_ROUNDUP);
  const [hydrated, setHydrated] = useState(false);
  const lastDailyLimitStep = useRef(DEFAULT_DAILY_LIMIT);
  const lastMaximumStep = useRef(DEFAULT_MAX_ROUNDUP);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!policy.data || hydrated) return;
    setDailyLimitCents(policy.data.dailyLimitCents ?? DEFAULT_DAILY_LIMIT);
    setMaxRoundupCents(policy.data.maxRoundupCents ?? DEFAULT_MAX_ROUNDUP);
    lastDailyLimitStep.current = policy.data.dailyLimitCents ?? DEFAULT_DAILY_LIMIT;
    lastMaximumStep.current = policy.data.maxRoundupCents ?? DEFAULT_MAX_ROUNDUP;
    setHydrated(true);
  }, [hydrated, policy.data]);

  const mutation = useMutation({
    mutationFn: async (activating: boolean) => {
      if (!authorization.data) throw new Error('Refresh your account and try again.');
      if (!authorization.data.authorized) {
        await auth.authorizeAutomation(
          authorization.data.address,
          authorization.data.signerId,
          authorization.data.policyId,
        );
        posthog?.capture('wallet_access_approved');
      }
      const confirmed = await apiRequest<InvestmentPolicy>(auth.getAccessToken, '/v1/activation', {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          policyVersion: 'automatic-spot-v1',
          dailyLimitCents,
          maxRoundupCents,
        }),
      });
      if (!confirmed.enabled)
        throw new Error('Automatic investing was not enabled. Please try again.');
      posthog?.capture(activating ? 'investing_activated' : 'investing_limits_saved', {
        daily_limit_cents: dailyLimitCents,
        max_roundup_cents: maxRoundupCents,
      });
      return confirmed;
    },
    onSuccess: async () => {
      await auth.refreshSession().catch(() => {});
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
    },
    onError: async () => {
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] }).catch(() => {});
    },
  });
  const save = useRef(mutation.mutate);
  save.current = mutation.mutate;

  // On by default: activate once the account state has loaded, if the policy is paused.
  const activationAttempted = useRef(false);
  useEffect(() => {
    if (activationAttempted.current || !hydrated || !authorization.data || !policy.data) return;
    if (policy.data.enabled) return;
    activationAttempted.current = true;
    save.current(true);
  }, [hydrated, authorization.data, policy.data]);

  useEffect(
    () => () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      // A drag that was still debouncing when the screen closed still persists.
      save.current(false);
    },
    [],
  );

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = undefined;
      save.current(false);
    }, SAVE_DEBOUNCE_MS);
  }

  function updateDailyLimit(value: number) {
    const next = Math.round(value / DAILY_LIMIT_STEP) * DAILY_LIMIT_STEP;
    if (next !== lastDailyLimitStep.current) {
      lastDailyLimitStep.current = next;
      void Haptics.selectionAsync().catch(() => {});
    }
    setDailyLimitCents(next);
    scheduleSave();
  }

  function updateMaximum(value: number) {
    const next = Math.round(value / MAX_ROUNDUP_STEP) * MAX_ROUNDUP_STEP;
    if (next !== lastMaximumStep.current) {
      lastMaximumStep.current = next;
      void Haptics.selectionAsync().catch(() => {});
    }
    setMaxRoundupCents(next);
    scheduleSave();
  }

  const failure = mutation.error?.message ?? policy.error?.message ?? authorization.error?.message;

  return (
    <Screen title="Automatic investing">
      <View style={styles.body}>
        <View style={[styles.limitSection, { borderColor: colors.line }]}>
          <View style={styles.valueRow}>
            <Type variant="headline">Daily limit</Type>
            <Type style={styles.value}>{formatCents(dailyLimitCents)}</Type>
          </View>
          <Type muted>
            The daily limit is the most Beaver can invest from your wallet across all roundups in
            one day. It starts at $50.
          </Type>
          <Slider
            value={dailyLimitCents}
            minimumValue={DAILY_LIMIT_MIN}
            maximumValue={DAILY_LIMIT_MAX}
            step={DAILY_LIMIT_STEP}
            minimumTrackTintColor={colors.ink}
            style={styles.slider}
            onValueChange={updateDailyLimit}
          />
          <View style={styles.rangeRow}>
            <Type muted>{formatCents(DAILY_LIMIT_MIN)}</Type>
            <Type muted>{formatCents(DAILY_LIMIT_MAX)}</Type>
          </View>
        </View>

        <View style={[styles.limitSection, { borderColor: colors.line }]}>
          <View style={styles.valueRow}>
            <Type variant="headline">Maximum roundup</Type>
            <Type style={styles.value}>{formatCents(maxRoundupCents)}</Type>
          </View>
          <Type muted>
            No single purchase can create a roundup above this amount. The default is $9.
          </Type>
          <Slider
            value={maxRoundupCents}
            minimumValue={MAX_ROUNDUP_MIN}
            maximumValue={MAX_ROUNDUP_MAX}
            step={MAX_ROUNDUP_STEP}
            minimumTrackTintColor={colors.ink}
            style={styles.slider}
            onValueChange={updateMaximum}
          />
          <View style={styles.rangeRow}>
            <Type muted>{formatCents(MAX_ROUNDUP_MIN)}</Type>
            <Type muted>{formatCents(MAX_ROUNDUP_MAX)}</Type>
          </View>
        </View>

        {failure ? (
          <Type accessibilityRole="alert">{failure}</Type>
        ) : mutation.isPending ? (
          <Type muted>Saving…</Type>
        ) : (
          <Type muted>Changes save automatically. Investing stays on.</Type>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 28 },
  limitSection: { gap: 12, paddingVertical: 8, paddingBottom: 24, borderBottomWidth: 1 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  value: { fontSize: 24, lineHeight: 30, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { width: '100%', height: 44 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
