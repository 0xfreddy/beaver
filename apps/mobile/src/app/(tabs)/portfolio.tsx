import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Type } from '../../components/ui';
import { AccountGate } from '../../components/account-gate';
import { LiveOrders } from '../../components/live-orders';
import { useAuth } from '../../providers/auth-provider';
import { apiRequest } from '../../lib/api';
import { useLive, dollars } from '../../lib/live';
import type { Balances, Capabilities, Holdings } from '../../lib/live';
import { useTheme } from '../../theme';
import { BarChart } from '../../components/reacticx/bar-chart';
import { SplitView } from '../../components/reacticx/split-view';
import { Tray } from '../../components/reacticx/tray';
import { RadiantButton } from '../../components/reacticx/radiant-button';
import { SkeletonBlock } from '../../components/shimmer-skeleton';
import { AppSymbol } from '../../components/app-symbol';

const holdingColors: Record<string, string> = {
  SBUX: '#00754A',
  CMG: '#A33325',
  AAPL: '#9BA0A6',
  UBER: '#353535',
  AMZN: '#FF9900',
  NFLX: '#E50914',
};

const RADIANT_THEME = {
  background: '#FFFFFF',
  backgroundSubtle: '#F2F2F2',
  foreground: '#111111',
  highlight: '#E37E19',
} as const;

export default function Portfolio() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <AccountGate>
        <LivePortfolio />
      </AccountGate>
    </View>
  );
}

function LivePortfolio() {
  const auth = useAuth();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const holdings = useLive<Holdings>('/v1/portfolio');
  const capability = useLive<Capabilities>('/v1/capabilities');
  const balances = useLive<Balances>('/v1/trading/balances');
  const [selected, setSelected] = useState<Holdings['items'][number] | null>(null);
  const intent = useRef<{ key: string; symbol: string; rawAmount: string } | null>(null);
  const sell = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a holding.');
      if (!intent.current)
        intent.current = {
          key: randomUUID(),
          symbol: selected.symbol,
          rawAmount: selected.sellableRawAmount,
        };
      const { key, symbol, rawAmount } = intent.current;
      return apiRequest(auth.getAccessToken, '/v1/portfolio/sell', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ symbol, rawAmount }),
      });
    },
    onSuccess: async () => {
      intent.current = null;
      setSelected(null);
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
    },
  });
  const chartData = useMemo(
    () =>
      (holdings.data?.items ?? [])
        .filter((item) => item.valueUsdCents !== null && BigInt(item.valueUsdCents) > 0n)
        .map((item) => ({
          label: item.symbol,
          value: Number(item.valueUsdCents),
          formattedValue: dollars(item.valueUsdCents!, 2),
          color: holdingColors[item.symbol],
        })),
    [holdings.data?.items],
  );
  const portfolioValue = useMemo(() => {
    if (!holdings.data) return '—';
    const cash =
      (BigInt(holdings.data.cash.rawAmount) * 100n) / 10n ** BigInt(holdings.data.cash.decimals);
    const invested = holdings.data.items.reduce(
      (total, item) => total + BigInt(item.valueUsdCents ?? '0'),
      0n,
    );
    return dollars((cash + invested).toString(), 2);
  }, [holdings.data]);

  const selectHolding = (item: Holdings['items'][number]) => {
    void Haptics.selectionAsync().catch(() => {});
    sell.reset();
    setSelected(item);
  };

  return (
    <>
      <SplitView.Root
        fullBleed
        gap={25}
        initialTopHeight={820}
        minTopHeight={120}
        minBottomHeight={150}
      >
        <SplitView.Top style={{ backgroundColor: colors.surface }}>
          <ScrollView
            bounces={false}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.allocationContent}
          >
            <View style={styles.balanceBlock}>
              <Type variant="caption" muted>
                Portfolio value
              </Type>
              <Type variant="display" adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.7}>
                {portfolioValue}
              </Type>
            </View>
            <Type variant="headline" style={styles.allocationTitle}>
              Portfolio allocations
            </Type>
            {holdings.data?.items.map((item) => {
              const disabled =
                item.sellableRawAmount === '0' ||
                !capability.data?.executionEnabled ||
                capability.isError ||
                holdings.isError ||
                !!selected;
              return (
                <Pressable
                  key={item.symbol}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${
                    item.valueUsdCents === null
                      ? 'price unavailable'
                      : dollars(item.valueUsdCents, 2)
                  }`}
                  accessibilityHint="Opens sale review when trading is available"
                  disabled={disabled}
                  onPress={() => selectHolding(item)}
                  style={({ pressed }) => [
                    styles.holdingRow,
                    { borderColor: colors.line, opacity: pressed ? 0.56 : disabled ? 0.72 : 1 },
                  ]}
                >
                  <View
                    accessible={false}
                    style={[
                      styles.holdingMark,
                      { backgroundColor: holdingColors[item.symbol] ?? colors.muted },
                    ]}
                  />
                  <View style={styles.holdingIdentity}>
                    <Type style={styles.holdingName}>{item.name}</Type>
                    <Type variant="caption" muted>
                      {item.symbol}
                    </Type>
                  </View>
                  <Type style={styles.holdingValue}>
                    {item.valueUsdCents === null ? '—' : dollars(item.valueUsdCents, 2)}
                  </Type>
                </Pressable>
              );
            })}
            {holdings.error ? (
              <Type accessibilityRole="alert">{holdings.error.message}</Type>
            ) : null}
            <View style={styles.fundingAction}>
              <RadiantButton
                accessibilityLabel="Feed Beaver"
                onPress={() => router.push('/funding')}
                style={styles.feedButton}
                theme={RADIANT_THEME}
                dotOpacity={1}
                glowWidth={0.5}
                shimmerOpacity={0.5}
              >
                <View style={styles.feedButtonContent}>
                  <Type style={styles.feedButtonLabel}>Feed Beaver</Type>
                  <AppSymbol name="next" color="#111111" size={18} />
                </View>
              </RadiantButton>
              {balances.data &&
              !balances.error &&
              (BigInt(balances.data.availableUsdcRaw) > 0n || (holdings.data?.items.length ?? 0) > 0) ? (
                <Button title="Withdraw" secondary onPress={() => router.push('/withdraw')} />
              ) : null}
            </View>
            <LiveOrders />
          </ScrollView>
        </SplitView.Top>
        <SplitView.Handle />
        <SplitView.Bottom style={{ backgroundColor: colors.surface }}>
          <View style={styles.chartPanel}>
            {chartData.length ? (
              <BarChart
                data={chartData}
                accessibilityLabel="Current xStock allocation bar chart"
                showValueRow={false}
              />
            ) : (
              <PortfolioChartSkeleton />
            )}
          </View>
        </SplitView.Bottom>
      </SplitView.Root>
      <Tray
        visible={!!selected}
        title={selected ? `Sell your ${selected.symbol} holding?` : 'Confirm sale'}
        subtitle="Review this request before it is submitted."
        dismissible={!sell.isPending}
        onClose={() => {
          if (!sell.isPending) setSelected(null);
        }}
        footer={
          selected ? (
            <>
              <Button
                title={sell.isError ? 'Retry this sale request' : 'Confirm sale'}
                loading={sell.isPending}
                onPress={() => sell.mutate()}
              />
              {!sell.isPending ? (
                <Button title="Keep holding" secondary onPress={() => setSelected(null)} />
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <>
            <Type muted>
              This submits all {selected.symbol} tokens in your trading account for sale to USDC,
              within the configured slippage limit. Prices can change. The order is complete only
              after finalization.
            </Type>
            {intent.current && sell.isError ? (
              <Type muted>
                A request may already exist. Retry uses the same request ID; check Roundups before
                starting another sale.
              </Type>
            ) : null}
            {sell.error ? <Type accessibilityRole="alert">{sell.error.message}</Type> : null}
          </>
        ) : null}
      </Tray>
    </>
  );
}

function PortfolioChartSkeleton() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Portfolio chart loading"
      style={styles.chartSkeleton}
    >
      <View style={styles.skeletonBars}>
        {[0.42, 0.72, 0.55, 0.88, 0.62].map((height, index) => (
          <SkeletonBlock key={index} style={[styles.skeletonBar, { height: `${height * 100}%` }]} />
        ))}
      </View>
      <SkeletonBlock style={styles.skeletonCaption} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  allocationContent: { paddingTop: 24, paddingBottom: 24 },
  balanceBlock: { gap: 2, paddingBottom: 20 },
  allocationTitle: { paddingBottom: 6 },
  holdingRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  holdingMark: { width: 8, height: 32, borderRadius: 4 },
  holdingIdentity: { flex: 1, gap: 1 },
  holdingName: { fontWeight: '600' },
  holdingValue: { fontVariant: ['tabular-nums'] },
  fundingAction: { paddingTop: 24, paddingBottom: 28, gap: 10 },
  feedButton: { width: '100%', minHeight: 60 },
  feedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  feedButtonLabel: { color: '#111111', fontWeight: '500', letterSpacing: 0.2 },
  chartPanel: { flex: 1, paddingTop: 24, paddingBottom: 82 },
  chartSkeleton: { flex: 1, minHeight: 180, paddingTop: 20, gap: 16 },
  skeletonBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  skeletonBar: { flex: 1, minHeight: 28, borderRadius: 9 },
  skeletonCaption: { alignSelf: 'center', width: '54%', height: 12, borderRadius: 6 },
});
