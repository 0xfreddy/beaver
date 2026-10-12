import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';
import { useLive, type InvestmentPolicy } from '../lib/live';
import {
  goldenProgress,
  newGoldenConfirmations,
  type GoldenBucket,
  type GoldenMarket,
  type GoldenOrder,
} from '../theme/golden-hour';

export function GoldenHourSync() {
  const { user } = useAuth();
  return <AccountSky key={user?.id ?? 'signed-out'} />;
}
function AccountSky() {
  const { choice, responsive, setGoldenProgress, setGoldenBloom } = useTheme();
  const enabled = choice === 'golden' && responsive;
  const overview = useLive<{ buckets: GoldenBucket[] }>('/v1/overview', enabled);
  const markets = useLive<{ items: GoldenMarket[] }>('/v1/trading/markets', enabled, false);
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy', enabled);
  const orders = useLive<{ items: GoldenOrder[] }>('/v1/trading/orders', enabled);
  const seen = useRef<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setGoldenProgress(0);
    setGoldenBloom(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setGoldenBloom(false);
        seen.current = null;
      }
    });
    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [setGoldenProgress, setGoldenBloom]);
  useEffect(() => {
    if (!enabled) {
      seen.current = null;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setGoldenBloom(false);
      return;
    }
    // Retain the last known sky on network errors; never turn errors into a mood.
    if (
      overview.error ||
      markets.error ||
      policy.error ||
      !overview.data ||
      !markets.data ||
      !policy.data
    )
      return;
    if (!policy.data.enabled) setGoldenBloom(false);
    setGoldenProgress(
      goldenProgress(overview.data.buckets, markets.data.items, policy.data.enabled),
    );
  }, [
    enabled,
    overview.data,
    markets.data,
    policy.data,
    overview.error,
    markets.error,
    policy.error,
    setGoldenProgress,
    setGoldenBloom,
  ]);
  useEffect(() => {
    if (!enabled || !orders.data || orders.error || AppState.currentState !== 'active') return;
    const next = newGoldenConfirmations(orders.data.items, seen.current);
    seen.current = next.ids;
    if (!next.bloom || !policy.data?.enabled) return;
    setGoldenBloom(true);
    // One bounded bloom for a burst of confirmations; a busy stream cannot extend it forever.
    if (!timer.current)
      timer.current = setTimeout(() => {
        setGoldenBloom(false);
        timer.current = null;
      }, 6000);
  }, [enabled, orders.data, orders.error, policy.data?.enabled, setGoldenBloom]);
  return null;
}
