import { useState } from 'react';
import { FlatList, Image, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';
import { apiRequest, cancelRoundup } from '../lib/api';
import {
  canCancelRoundup,
  needsStockChoice,
  purchaseAmount,
  purchaseStatus,
  purchaseRoundupDisplay,
  type Purchase,
  type PurchasePage,
} from '../lib/purchases';
import { cryptoProviderNames } from '../lib/recent-purchases';
import { Button, Type } from './ui';
import { CompanyMark, MerchantIcon } from './company-mark';
import { GooeySearchTabs } from './reacticx/gooey-search-tabs';
import { BankMark } from './bank-mark';
import { SwipeToDeleteRow } from './swipe-to-delete-row';
import { CancelRoundupTray } from './cancel-roundup-tray';

const cryptoCardLogos = {
  etherfi: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static image asset.
    logo: require('../../assets/brands/crypto-cards/etherfi.png'),
    name: cryptoProviderNames.etherfi,
  },
  tuyo: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static image asset.
    logo: require('../../assets/brands/crypto-cards/tuyo.png'),
    name: cryptoProviderNames.tuyo,
  },
} as const;

function purchaseDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function PurchaseAttribution({ item }: { item: Purchase }) {
  if (item.sourceName === 'Manual purchases') return <Type variant="caption" muted>Manual mode</Type>;
  const provider = item.cryptoCardProvider ? cryptoCardLogos[item.cryptoCardProvider] : undefined;
  if (!provider && !item.sourceName && !item.cardLastFour) return null;
  const lastFour = item.cardLastFour?.slice(-4);
  const label = provider
    ? provider.name
    : `${item.sourceName || 'Bank card'}${lastFour ? ` · •••• ${lastFour}` : ''}`;
  return (
    <View style={styles.attribution}>
      {provider ? (
        <Image
          accessible={false}
          source={provider.logo}
          resizeMode="contain"
          style={styles.sourceLogo}
        />
      ) : (
        <BankMark name={item.sourceName || 'Bank card'} uri={item.sourceLogoUrl} size={16} />
      )}
      <Type variant="caption" muted numberOfLines={1} style={styles.attributionLabel}>
        {label}
      </Type>
    </View>
  );
}

export function LivePurchaseRow({
  item,
  compact = false,
  onOpen,
}: {
  item: Purchase;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const auth = useAuth();
  const cache = useQueryClient();
  const { colors } = useTheme();
  // Only the client-built onboarding previews lack a server-side detail page; synced
  // crypto-card purchases route to their transaction screen like any other purchase.
  const hasDetails = !item.id.startsWith('onchain:');
  const cardRow = compact && !!item.cryptoCardProvider;
  const status = purchaseStatus(item);
  const roundupDisplay = purchaseRoundupDisplay(item);
  // Long status copy belongs with the purchase, not in the amount column:
  // otherwise it consumes the row width and squeezes merchant names to one word.
  const statusBelow = compact && !cardRow && roundupDisplay === status;
  return (
    <Pressable
      accessibilityRole={hasDetails ? 'button' : undefined}
      disabled={!hasDetails}
      onPress={() => {
        if (!hasDetails) return;
        void Haptics.selectionAsync().catch(() => {});
        Keyboard.dismiss();
        if (needsStockChoice(item)) {
          router.push('/settings/fallback');
          return;
        }
        if (onOpen) {
          onOpen();
          return;
        }
        cache.setQueryData(
          ['live', auth.user?.id, `/v1/transactions/${encodeURIComponent(item.id)}`],
          item,
        );
        router.push({
          pathname: '/transaction/[id]',
          params: { id: item.id, mode: 'live' },
        });
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 17,
        borderBottomWidth: 1,
        borderColor: colors.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {item.sourceName === 'Manual purchases' && item.symbol ? (
        <CompanyMark symbol={item.symbol} size={46} />
      ) : item.sourceName && !item.cryptoCardProvider ? (
        <BankMark name={item.sourceName} uri={item.sourceLogoUrl} size={46} />
      ) : (
        <MerchantIcon merchant={(item.merchant || 'Purchase').replace(/\s+xStock$/i, '')} symbol={item.symbol} />
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Type style={{ fontWeight: '600' }}>{(item.merchant || 'Purchase').replace(/\s+xStock$/i, '')}</Type>
        <Type variant="caption" muted>
          {cardRow
            ? purchaseDate(item.occurredAt)
            : compact
              ? `${purchaseAmount(item)}${item.symbol ? ` · ${item.symbol}` : ''}`
              : `${purchaseStatus(item)}${item.symbol ? ` · ${item.symbol}` : ''}`}
        </Type>
        {!compact ? (
          <Type variant="caption" muted>
            {purchaseAmount(item)}
          </Type>
        ) : null}
        {statusBelow ? (
          <Type variant="caption" muted>
            {status}
          </Type>
        ) : null}
        <PurchaseAttribution item={item} />
      </View>
      {cardRow && !needsStockChoice(item) ? (
        <Type variant="numeric" style={{ flexShrink: 0 }}>
          {purchaseAmount(item)}
        </Type>
      ) : !statusBelow && (compact || roundupDisplay !== status) ? (
        <Type style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{roundupDisplay}</Type>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  attribution: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  attributionLabel: { flexShrink: 1 },
});

export function LiveActivity() {
  const auth = useAuth();
  const cache = useQueryClient();
  const { colors } = useTheme();
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'roundups' | 'excluded'>('all');
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Purchase | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['live', auth.user?.id, 'activity', term, filter],
    enabled: !!auth.session && !auth.sessionError,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<PurchasePage>(
        auth.getAccessToken,
        `/v1/transactions?${new URLSearchParams({ search: term, filter, limit: '30', ...(pageParam ? { cursor: pageParam } : {}) })}`,
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  });
  const cancel = useMutation({
    mutationFn: (item: Purchase) => cancelRoundup(auth.getAccessToken, item.id),
    onSuccess: async () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOpenRowId(null);
      setPendingCancel(null);
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
    },
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  function openPurchase(item: Purchase) {
    cache.setQueryData(
      ['live', auth.user?.id, `/v1/transactions/${encodeURIComponent(item.id)}`],
      item,
    );
    router.push({ pathname: '/transaction/[id]', params: { id: item.id, mode: 'live' } });
  }
  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const open = () => openPurchase(item);
          const row = <LivePurchaseRow item={item} onOpen={open} />;
          return canCancelRoundup(item) ? (
            <SwipeToDeleteRow
              open={openRowId === item.id}
              busy={cancel.isPending && pendingCancel?.id === item.id}
              actionLabel="Cancel"
              onActivate={open}
              onOpenChange={(open) => setOpenRowId(open ? item.id : null)}
              onDelete={() => {
                cancel.reset();
                setOpenRowId(null);
                setPendingCancel(item);
              }}
              accessibilityLabel={`${(item.merchant || 'Purchase').replace(/\s+xStock$/i, '')}, ${purchaseStatus(item)}`}
              accessibilityHint="Swipe left to reveal Cancel roundup"
            >
              {row}
            </SwipeToDeleteRow>
          ) : (
            row
          );
        }}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 48,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onAccessibilityEscape={() => router.back()}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 12 }}>
            <Type variant="title">Activity</Type>
            <GooeySearchTabs
              activeTab={filter}
              tabs={[
                { value: 'all', label: 'All' },
                { value: 'roundups', label: 'Roundups' },
                { value: 'excluded', label: 'Excluded' },
              ]}
              initialSearch={term}
              onTabChange={setFilter}
              onSearch={setTerm}
              onClear={() => setTerm('')}
            />
            {query.error ? (
              <>
                <Type accessibilityRole="alert">{query.error.message}</Type>
                <Button title="Try again" onPress={() => void query.refetch()} />
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !query.error && auth.session ? (
            <View style={{ gap: 12, paddingVertical: 24 }}>
              <Type variant="headline">
                {query.isPending ? 'Loading activity…' : 'No activity here yet'}
              </Type>
            </View>
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <Button
              title="Load more activity"
              secondary
              loading={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          ) : null
        }
      />
      <CancelRoundupTray
        item={pendingCancel}
        busy={cancel.isPending}
        error={cancel.error?.message ?? null}
        onClose={() => {
          if (!cancel.isPending) setPendingCancel(null);
        }}
        onConfirm={() => {
          if (pendingCancel) cancel.mutate(pendingCancel);
        }}
      />
    </>
  );
}
