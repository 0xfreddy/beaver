import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { bankSyncStatus, type BankSyncItem, type BankSyncSchedule } from '../lib/bank-sync-status';
import { Type } from './ui';
import { useLive, type Capabilities } from '../lib/live';

export function BankSyncStatusCard({
  items,
  now,
  unavailable = false,
  loading = false,
  sandbox = false,
  onRetry,
  onReconnect,
}: {
  items: BankSyncItem[];
  now: number;
  unavailable?: boolean;
  loading?: boolean;
  sandbox?: boolean;
  onRetry?: () => void;
  onReconnect?: () => void;
}) {
  const states = items.map((item) => bankSyncStatus(item, now));
  const issue =
    states.find((state) => state.needsReconnect) ??
    states.find((state) => /delayed|Couldn’t/.test(state.label));
  const working = states.find((state) =>
    /Importing|Checking|Waiting for bank data/.test(state.label),
  );
  const name = items.length === 1 ? states[0]!.bank : `${items.length} banks`;
  const status = unavailable
    ? 'Status unavailable'
    : (issue?.label ??
      working?.label ??
      (items.length === 1 ? states[0]?.label.replace('Last checked', 'Checked') : 'Connected'));
  const label =
    loading && !items.length
      ? 'Checking bank status…'
      : items.length
        ? `${name} · ${status}`
        : unavailable
          ? 'Bank status unavailable'
          : 'Connect a bank';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${states.map((state) => state.detail).join('. ')}. Manage connected banks`}
      onPress={unavailable && !items.length ? onRetry : onReconnect}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Type variant="caption" muted>
          {label}
        </Type>
        {states.map((state, index) => (
          <Type key={items[index]!.id} variant="caption" muted>
            {items.length > 1 ? `${state.bank} · ${state.label} · ` : ''}
            {state.detail}
          </Type>
        ))}
        {sandbox ? (
          <Type variant="caption" muted>
            Sandbox · test transactions
          </Type>
        ) : null}
      </View>
      <Type muted>›</Type>
    </Pressable>
  );
}

export function BankSyncCard({ onboarding = false }: { onboarding?: boolean }) {
  const capabilities = useLive<Capabilities>('/v1/capabilities');
  const enabled = !!capabilities.data?.bankConnectionEnabled;
  const schedule = useLive<BankSyncSchedule>('/v1/bank/sync-schedule', enabled);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const items = (schedule.data?.items ?? []).filter(
    (item) => item.status !== 'disconnected' && !item.disconnectRequested,
  );
  const unavailable = capabilities.isError || (enabled && schedule.isError);
  const loading = capabilities.isPending || (enabled && schedule.isPending);
  if (!onboarding && !items.length && !unavailable && !loading) return null;
  return (
    <BankSyncStatusCard
      items={items}
      now={now}
      unavailable={unavailable}
      loading={loading}
      sandbox={capabilities.data?.bankEnvironment === 'sandbox'}
      onRetry={() => {
        void capabilities.refetch();
        if (enabled) void schedule.refetch();
      }}
      onReconnect={() => router.push('/settings/banks')}
    />
  );
}
