import { homeAllocation } from '../lib/home-allocation';
import { BankSyncCard } from './bank-sync-card';
import { HomeBanners } from './home-banners';
import { PerformanceCard } from './performance-card';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { CryptoCard } from '@roundups/types';
import { apiRequest, fetchOnchainSpendingPreview } from '../lib/api';
import { refreshHomeBanks } from '../lib/bank-refresh';

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
  const cache = useQueryClient();
  const refreshInFlight = useRef(false);
  const [bankRefreshMessages, setBankRefreshMessages] = useState<string[]>([]);
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
  const banks = useLive<{ items: { status: string; disconnectRequested?: boolean }[] }>(
    '/v1/bank/connections',
  );
  const balances = useLive<Balances>('/v1/trading/balances');
  const recent = useLive<PurchasePage>('/v1/transactions?filter=purchases&limit=3');
  const holdings = useLive<Holdings>('/v1/portfolio');
  const allocationData = homeAllocation(holdings.data, balances.data, overview.data?.buckets);
  // Request bank data first; acceptance is not completion. Normal query polling follows the import.
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setBankRefreshMessages(['Requesting bank updates…']);
    try {
      const bankRequest = refreshHomeBanks((path, options) =>
        apiRequest(auth.getAccessToken, path, options),
      )
        .then(setBankRefreshMessages)
        .catch(() => setBankRefreshMessages(['Couldn’t request bank updates. Pull down to retry.']))
        .finally(() => cache.invalidateQueries({ queryKey: ['live', auth.user?.id] }));
      await Promise.allSettled([
        bankRequest,
        balances.refetch(),
        recent.refetch(),
        overview.refetch(),
        holdings.refetch(),
        cryptoCards.refetch(),
        ...savedCardPreviews.map((query) => query.refetch()),
      ]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [auth, cache, balances, recent, overview, holdings, cryptoCards, savedCardPreviews]);
  const allocation = useAllocationChart(allocationData.markets, {
    label: 'Your allocations',
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
  const loadingPurchases = recentItems.length === 0 && recent.isPending;
  const waitingForFirstTransaction = recent.isSuccess && recentItems.length === 0;

  return (
    <Screen
      atmosphere="home"
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
        <View style={styles.bankRefreshStatus}>
          <BankSyncCard />
          {bankRefreshMessages.map((message) => (
            <Type key={message} variant="caption" muted accessibilityLiveRegion="polite">
              {message}
            </Type>
          ))}
        </View>
        {allocationData.awaitingConversion ? (
          <Type variant="caption" muted>
            Some pending roundups are waiting for USD conversion.
          </Type>
        ) : null}
        {allocationData.unfundedCents > 0 ? (
          <Type variant="caption" muted>
            ${(allocationData.unfundedCents / 100).toFixed(2)} in pending roundups is waiting for
            funding.
          </Type>
        ) : null}
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
        <HomeBanners totalRoundupCents={totalRoundupCents} />
        <View style={{ gap: 0 }}>
          <RecentPurchasesHeading waiting={waitingForFirstTransaction} />
        </View>
        {recentItems.map((item) => (
          <LivePurchaseRow key={item.id} item={item} compact />
        ))}
        {loadingPurchases ? <RecentPurchaseSkeleton /> : null}
        {recent.error ? (
          <View style={{ gap: 8 }}>
            <Type accessibilityRole="alert" muted>
              {recentItems.length
                ? 'Couldn’t refresh purchases. Your last update is still shown.'
                : 'Couldn’t load purchases. Your bank connection has not been changed.'}
            </Type>
            <Button
              title="Retry purchases"
              appearance="onboarding"
              loading={recent.isFetching}
              onPress={() => void recent.refetch()}
            />
          </View>
        ) : null}
        {banks.data &&
        !banks.error &&
        !banks.data.items.some(
          (bank) => bank.status !== 'disconnected' && !bank.disconnectRequested,
        ) ? (
          <Button
            appearance="onboarding"
            title="Connect bank"
            onPress={() => router.push('/settings/banks')}
          />
        ) : null}
        <Button
          appearance="onboarding"
          title="Add a purchase manually"
          onPress={() => router.push('/receipt-scan')}
        />
        {[overview.error, cryptoCards.error, ...savedCardPreviews.map((query) => query.error)]
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
  bankRefreshStatus: { gap: 4 },
  recentHeading: {
    // Extra breathing room before the activity section (12 comes from the compact stack gap).
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
