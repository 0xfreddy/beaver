import { StyleSheet, View } from 'react-native';
import type { OnchainSpendingTransaction } from '@roundups/types';
import { formatUsd } from '@roundups/domain';
import { Type } from './ui';
import { SkeletonBlock } from './shimmer-skeleton';
import { useTheme } from '../theme';

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
}

export function formatOnchainTransactionDate(value: string) {
  const date = new Date(value);
  const month = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(date);
  return `${ordinal(date.getUTCDate())} of ${month}`;
}

export function OnchainTransactionPreview({
  loading,
  transactions,
}: {
  loading: boolean;
  transactions?: readonly OnchainSpendingTransaction[];
}) {
  const { colors } = useTheme();

  if (loading)
    return (
      <View
        accessible
        accessibilityLabel="Looking for recent crypto card transactions"
        style={styles.root}
      >
        <Type variant="headline">Latest transactions</Type>
        {[0, 1, 2].map((row) => (
          <View key={row} style={[styles.row, { borderColor: colors.line }]}>
            <View style={styles.skeletonCopy}>
              <SkeletonBlock style={styles.skeletonAmount} />
              <SkeletonBlock style={styles.skeletonDate} />
            </View>
            <View style={[styles.skeletonCopy, styles.skeletonRight]}>
              <SkeletonBlock style={styles.skeletonRoundup} />
              <SkeletonBlock style={styles.skeletonLabel} />
            </View>
          </View>
        ))}
        <Type variant="caption" muted>
          Reading public stablecoin activity…
        </Type>
      </View>
    );

  if (!transactions) return null;

  return (
    <View style={styles.root}>
      <Type variant="headline" style={styles.heading}>
        Latest transactions
      </Type>
      {transactions.length ? (
        transactions.map((transaction) => {
          const date = formatOnchainTransactionDate(transaction.occurredAt);
          return (
            <View
              accessible
              accessibilityLabel={`${formatUsd(transaction.amountCents)} spent, ${formatUsd(transaction.roundupCents)} could have been invested, ${date}`}
              key={transaction.id}
              style={[styles.row, { borderColor: colors.line }]}
            >
              <View style={styles.copy}>
                <Type selectable style={styles.amount}>
                  {formatUsd(transaction.amountCents)}
                </Type>
                <Type variant="caption" muted>
                  {date}
                </Type>
              </View>
              <View style={[styles.copy, styles.roundupCopy]}>
                <Type selectable style={[styles.amount, { color: colors.green }]}>
                  +{formatUsd(transaction.roundupCents)}
                </Type>
                <Type variant="caption" muted>
                  could invest
                </Type>
              </View>
            </View>
          );
        })
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.surface }]}>
          <Type style={styles.emptyTitle}>No supported purchases found</Type>
          <Type variant="caption" muted>
            We could not find outgoing stablecoin activity for this address on the supported
            networks.
          </Type>
        </View>
      )}
      <Type variant="caption" muted>
        Estimates follow your roundup rule and invest in your fallback stock. Saved card purchases
        become real roundups once automatic investing is active.
      </Type>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  heading: { minHeight: 32 },
  row: {
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  copy: { flex: 1, gap: 2 },
  roundupCopy: { alignItems: 'flex-end' },
  amount: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: {
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    gap: 4,
  },
  emptyTitle: { fontWeight: '600' },
  skeletonCopy: { flex: 1, gap: 8 },
  skeletonRight: { alignItems: 'flex-end' },
  skeletonAmount: { width: 72, height: 14, borderRadius: 7 },
  skeletonDate: { width: 96, height: 10, borderRadius: 5 },
  skeletonRoundup: { width: 64, height: 14, borderRadius: 7 },
  skeletonLabel: { width: 76, height: 10, borderRadius: 5 },
});
