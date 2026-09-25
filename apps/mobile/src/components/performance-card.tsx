import { StyleSheet, View } from 'react-native';
import { Card, Type } from './ui';
import { useLive } from '../lib/live';

const money = (cents: string | number) => {
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '−' : '+'}$${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};
// TEMPORARY: the all-time return figures are wrong right now (fresh accounts
// show small losses like -3.16% / -$0.05), so the summary stays hidden until
// the backend computes them correctly. Delete this flag to restore the cards.
const PERFORMANCE_CARD_HIDDEN = true;
export function PerformanceCard() {
  const result = useLive<{
    status: string;
    percent: number | null;
    gainCents: string | null;
    equivalent: { merchant: string; amountCents: number } | null;
  }>('/v1/portfolio/performance');
  const data = result.data;
  const available = data?.status === 'available' && data.percent != null;
  // Nothing to summarize until the first investment exists; an empty wallet shows no card.
  if (PERFORMANCE_CARD_HIDDEN || !data || data.status === 'empty') return null;
  return (
    <View style={{ gap: 12 }}>
      {available ? (
        <View style={styles.valueRow}>
          <View
            accessible
            accessibilityLabel={`All-time return ${data.percent!.toFixed(2)} percent`}
            style={styles.valueCardWrap}
          >
            <Card style={styles.valueCard}>
              <Type variant="title" numberOfLines={1} style={styles.value}>
                {data.percent! >= 0 ? '+' : '−'}
                {Math.abs(data.percent!).toFixed(2)}%
              </Type>
            </Card>
          </View>
          <View
            accessible
            accessibilityLabel={`All-time change ${money(data.gainCents ?? 0)}`}
            style={styles.valueCardWrap}
          >
            <Card style={styles.valueCard}>
              <Type variant="title" numberOfLines={1} style={styles.value}>
                {money(data.gainCents ?? 0)}
              </Type>
            </Card>
          </View>
        </View>
      ) : (
        <Card>
          <Type variant="title">—</Type>
          <Type muted>
            {data?.status === 'empty'
              ? 'Your performance starts with your first investment.'
              : result.isPending
                ? 'Updating portfolio…'
                : 'Performance is unavailable until prices and holdings can be verified.'}
          </Type>
        </Card>
      )}
      {available && data?.equivalent ? (
        <Type>
          Beaver gains cover your {money(data.equivalent.amountCents).replace('+', '')}{' '}
          {data.equivalent.merchant} purchase.
        </Type>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  valueRow: { flexDirection: 'row', gap: 12 },
  valueCardWrap: { flex: 1, minWidth: 0 },
  valueCard: { alignItems: 'center', justifyContent: 'center', minHeight: 88 },
  value: { fontVariant: ['tabular-nums'] },
});
