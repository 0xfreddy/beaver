import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { apiRequest } from '../lib/api';
import { useLive } from '../lib/live';
import { solscanTxUrl } from '../lib/explorer';
import { Button, Type } from './ui';
import { AppSymbol } from './app-symbol';
import { CompanyMark } from './company-mark';
import { useTheme } from '../theme';

type OrderRow = {
  id: string;
  symbol: string;
  side: string;
  status: string;
  signature: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: string) {
  if (status === 'finalized') return 'Completed';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** "17th September 2026" — day with ordinal suffix, full month, year. */
function extendedDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDate();
  const ordinal =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = date.toLocaleString('en-US', { month: 'long' });
  return `${day}${ordinal} ${month} ${date.getFullYear()}`;
}

export function LiveOrders() {
  const auth = useAuth();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const orders = useLive<{ items: OrderRow[] }>('/v1/trading/orders');
  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiRequest(auth.getAccessToken, `/v1/trading/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['live', auth.user?.id] }),
  });
  if (!orders.error && (!orders.data || orders.data.items.length === 0)) return null;
  return (
    <View style={styles.section}>
      <Type variant="headline">Roundups</Type>
      {orders.error ? <Type accessibilityRole="alert">{orders.error.message}</Type> : null}
      {orders.data?.items.length ? (
        <View>
          {orders.data.items.map((order) => {
            const expanded = expandedId === order.id;
            const signature = order.signature;
            const label = statusLabel(order.status);
            // A finalized order completed when it was last touched; anything else
            // is still moving from when it was placed.
            const when = extendedDate(
              order.status === 'finalized' ? order.updatedAt : order.createdAt,
            );
            return (
              <View
                key={order.id}
                style={[styles.row, { borderBottomColor: colors.line }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${order.side === 'buy' ? 'Buy' : 'Sell'} ${order.symbol}, ${label}${when ? `, ${when}` : ''}`}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    setExpandedId(expanded ? null : order.id);
                  }}
                  style={({ pressed }) => [styles.summary, pressed && { opacity: 0.58 }]}
                >
                  <CompanyMark symbol={order.symbol} size={40} />
                  <View style={styles.identity}>
                    <Type style={styles.title}>
                      {order.side === 'buy' ? 'Buy' : 'Sell'} {order.symbol}
                    </Type>
                    <Type variant="caption" muted>
                      {when ? `${label} · ${when}` : label}
                    </Type>
                  </View>
                  <AppSymbol
                    name={expanded ? 'chevronDown' : 'next'}
                    color={colors.muted}
                    size={16}
                  />
                </Pressable>
                {expanded ? (
                  <View style={styles.details}>
                    {order.errorCode ? (
                      <Type muted>{order.errorCode.toLowerCase().replaceAll('_', ' ')}</Type>
                    ) : null}
                    {signature ? (
                      <Button
                        title="Open in Solscan"
                        secondary
                        onPress={() => void Linking.openURL(solscanTxUrl(signature))}
                      />
                    ) : null}
                    {!order.signature && ['pending', 'blocked'].includes(order.status) ? (
                      <Button
                        title="Cancel order"
                        secondary
                        disabled={cancel.isPending || orders.isError}
                        onPress={() => cancel.mutate(order.id)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {cancel.error ? <Type accessibilityRole="alert">{cancel.error.message}</Type> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  // Plain accordion rows matching the portfolio allocations list above, instead
  // of a bordered card container.
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summary: {
    minHeight: 64,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: '600' },
  details: { gap: 12, paddingBottom: 16 },
});
