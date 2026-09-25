import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Card, Type } from './ui';
import { useLive, type Capabilities } from '../lib/live';
import { useTheme } from '../theme';

const TICKS = 24;
/** One tick per hour of the daily 07:00 ET bank-sync cycle. */
const CYCLE_MINUTES = 24 * 60;

/** The same tick-mark line language as the allocation semicircle, flattened into a ruler. */
function SyncProgressBar({ fraction }: { fraction: number | null }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Progress since the last bank sync"
      accessibilityValue={
        fraction == null ? undefined : { min: 0, max: 1, now: Math.min(1, Math.max(0, fraction)) }
      }
      style={styles.track}
    >
      {Array.from({ length: TICKS }, (_, index) => (
        <View
          key={index}
          style={{
            width: 3,
            height: 20,
            borderRadius: 1.5,
            backgroundColor:
              fraction != null && (index + 1) / TICKS <= Math.min(1, Math.max(0, fraction))
                ? colors.ink
                : colors.muted,
          }}
        />
      ))}
    </View>
  );
}

export function BankSyncCard({ onboarding = false }: { onboarding?: boolean }) {
  const capabilities = useLive<Capabilities>('/v1/capabilities');
  const schedule = useLive<{
    nextExpectedAt: string;
    items: { status: string; initialSyncComplete: boolean; lastSyncedAt: string | null }[];
  }>('/v1/bank/sync-schedule', !!capabilities.data?.bankConnectionEnabled);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const listener = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  if (!onboarding && !schedule.data?.items.length) return null;
  const minutes = schedule.data
    ? Math.max(0, Math.ceil((Date.parse(schedule.data.nextExpectedAt) - now) / 60000))
    : null;
  // Hours elapsed in the daily cycle: a tick lights once its full hour has passed,
  // so 17h 28m remaining lights 6 of 24 ticks.
  const fraction =
    minutes == null
      ? null
      : minutes === 0
        ? 1
        : Math.max(0, CYCLE_MINUTES - minutes) / CYCLE_MINUTES;
  return (
    <Card>
      <Type variant="title" style={styles.title} numberOfLines={1}>
        {minutes === null
          ? 'Purchases arrive daily'
          : minutes === 0
            ? 'Checking for new purchases'
            : 'Next transaction sync'}
      </Type>
      <View style={styles.rulerRow}>
        <SyncProgressBar fraction={fraction} />
        {minutes !== null && minutes > 0 ? (
          <Type variant="title" style={styles.time}>
            {`${Math.floor(minutes / 60)}h ${minutes % 60}m`}
          </Type>
        ) : null}
      </View>
      {capabilities.data?.bankEnvironment === 'sandbox' ? (
        <Type variant="caption" muted>
          Sandbox · test transactions
        </Type>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, lineHeight: 25, fontWeight: '400' },
  rulerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  time: { fontSize: 20, lineHeight: 25, fontWeight: '400', fontVariant: ['tabular-nums'] },
  track: {
    flex: 1,
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
