import { BankSyncCard } from './bank-sync-card';
import { HomeBanners } from './home-banners';
import { PerformanceCard } from './performance-card';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, Screen, Type } from './ui';
import { dollars, useLive, type Balances, type Holdings } from '../lib/live';
import type { PurchasePage } from '../lib/purchases';
import { AccountGate } from './account-gate';
import { LivePurchaseRow } from './live-activity';
import { useAllocationChart } from './allocation-chart';
import { OverviewCards } from './overview-cards';
import { RecentPurchaseSkeleton } from './shimmer-skeleton';
import { OnboardingAnimation } from './onboarding-animation';
import { useOnchainPreview } from '../providers/onchain-preview-provider';
import { useTheme } from '../theme';
import {
  cryptoPreviewRequests,
  recentPurchases,
  retainedOnboardingPreview,
} from '../lib/recent-purchases';
import { useAuth } from '../providers/auth-provider';
import { useQueries } from '@tanstack/react-query';
import type { CryptoCard } from '@roundups/types';
import { fetchOnchainSpendingPreview } from '../lib/api';

function RecentPurchasesHeading({ waiting }: { waiting: boolean }) {
  return (
    <View style={styles.recentHeading}>
      <View style={styles.recentHeadingCopy}>
        <Type variant="headline" accessibilityRole="header">
          Recent purchases
        </Type>
        {waiting ? (
          <Type variant="caption" muted>
            Waiting for your first transaction
          </Type>
        ) : null}
      </View>
      {waiting ? (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.waitingAnimation}
        >
          <OnboardingAnimation name="wait" height={52} loop />
        </View>
      ) : null}
    </View>
  );
}

export function LiveHome() {
  const { preview } = useOnchainPreview();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const auth = useAuth();
  const cryptoCards = useLive<{ items: CryptoCard[] }>('/v1/bank/crypto-cards', true, false);
  const savedCardPreviews = useQueries({
    queries: cryptoPreviewRequests(cryptoCards.data?.items ?? []).map(
      ({ provider, addresses }) => ({
        queryKey: ['live', auth.user?.id, 'recent-crypto-card-purchases', provider, addresses],
        enabled: !!auth.session && !auth.sessionError,
        queryFn: () => fetchOnchainSpendingPreview(auth.getAccessToken, addresses, provider),
        staleTime: 5 * 60_000,
        retry: false,
      }),
    ),
  });
  const overview = useLive<{
    purchaseCount: number;
    buckets: {
      currency: string;
      symbol: string;
      status: string;
      amountCents: string;
      count: number;
    }[];
  }>('/v1/overview');
  const balances = useLive<Balances>('/v1/trading/balances');
  const recent = useLive<PurchasePage>('/v1/transactions?limit=3');
  const holdings = useLive<Holdings>('/v1/portfolio');
  const pending = overview.data?.buckets.filter((bucket) =>
    ['pending', 'below_market_minimum'].includes(bucket.status),
  );
  // Once the portfolio owns stock, the semicircle divides by holdings like the
  // mocked design; before that it previews where pending roundups are headed.
  const ownedMarkets = (holdings.data?.items ?? [])
    .filter((item) => BigInt(item.rawAmount) > 0n && item.valueUsdCents != null)
    .map((item) => ({ symbol: item.symbol, amountCents: Number(item.valueUsdCents) }));
  // With real holdings the wallet's USDC sits in the dome too: $1 in Netflix and
  // $1 in cash fill half the semicircle each.
  const cashCents =
    balances.data && !balances.error
      ? Number((BigInt(balances.data.availableUsdcRaw) * 100n) / 10n ** 6n)
      : 0;
  const allocationMarkets =
    ownedMarkets.length > 0
      ? cashCents > 0
        ? [...ownedMarkets, { symbol: 'USDC', amountCents: cashCents }]
        : ownedMarkets
      : Object.values(
          (pending ?? []).reduce<Record<string, { symbol: string; amountCents: number }>>(
            (markets, bucket) => {
              const market = markets[bucket.symbol] ?? { symbol: bucket.symbol, amountCents: 0 };
              market.amountCents += Number(bucket.amountCents);
              markets[bucket.symbol] = market;
              return markets;
            },
            {},
          ),
        );
  // Pull-to-refresh refetches everything the home screen renders.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        balances.refetch(),
        recent.refetch(),
        overview.refetch(),
        holdings.refetch(),
        cryptoCards.refetch(),
        ...savedCardPreviews.map((query) => query.refetch()),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, balances, recent, overview, holdings, cryptoCards, savedCardPreviews]);
  const allocation = useAllocationChart(allocationMarkets, {
    label: ownedMarkets.length > 0 ? 'Portfolio' : 'Pending roundups',
    refreshing,
    onRefresh: refresh,
  });
  const totalRoundupCents = (overview.data?.buckets ?? []).reduce(
    (total, bucket) => total + Number(bucket.amountCents),
    0,
  );
  const onboardingPreview = retainedOnboardingPreview(preview, cryptoCards.data?.items);
  const cryptoPreviews = [
    ...(onboardingPreview ? [onboardingPreview] : []),
    ...savedCardPreviews.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  const recentItems = recentPurchases(recent.data?.items ?? [], cryptoPreviews);
  const waitingForFirstTransaction = !recent.isPending && recentItems.length === 0;
  return (
    <Screen
      compact
      fadeTop
      onScroll={allocation.onScroll}
      scrollRef={allocation.scrollRef}
      overlay={allocation.overlay}
      refreshControl={
        Platform.OS === 'ios' ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.green}
            colors={[colors.green]}
          />
        )
      }
    >
      <AccountGate>
        {allocation.slot}
        <OverviewCards
          purchaseCount={overview.data?.purchaseCount}
          live={{
            availableUsdc:
              balances.data && !balances.error ? dollars(balances.data.availableUsdcRaw) : null,
            isZeroBalance:
              balances.data && !balances.error
                ? BigInt(balances.data.availableUsdcRaw) === 0n
                : false,
          }}
        />
        {balances.error ? (
          <View style={{ gap: 8 }}>
            <Type accessibilityRole="alert" muted>
              Wallet balance unavailable. Refresh it before adding a receipt.
            </Type>
            <Button
              secondary
              title="Refresh balance"
              loading={balances.isFetching}
              onPress={() => void balances.refetch()}
            />
          </View>
        ) : null}
        <PerformanceCard />
        <BankSyncCard />
        <HomeBanners totalRoundupCents={totalRoundupCents} />
        <RecentPurchasesHeading waiting={waitingForFirstTransaction} />
        {recentItems.map((item) => (
          <LivePurchaseRow key={item.id} item={item} compact />
        ))}
        {waitingForFirstTransaction ? <RecentPurchaseSkeleton /> : null}
        <Button
          appearance="onboarding"
          title="Add a purchase manually"
          onPress={() => router.push('/receipt-scan')}
        />
        {[
          overview.error,
          recent.error,
          cryptoCards.error,
          ...savedCardPreviews.map((query) => query.error),
        ]
          .filter(Boolean)
          .map((error, i) => (
            <Type key={i} accessibilityRole="alert">
              {error!.message}
            </Type>
          ))}
      </AccountGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  recentHeading: {
    // Extra breathing room above the section after the sync card (12 comes from the compact stack gap).
    marginTop: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  recentHeadingCopy: { flex: 1, minWidth: 0, gap: 3 },
  waitingAnimation: { width: 84, height: 52, flexShrink: 0 },
});
