import { CompanyMark } from './company-mark';
import { OnboardingAnimation } from './onboarding-animation';
import { OnboardingNotificationCard } from './onboarding-notification-stack';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, TextButton, Type } from './ui';
import { useLive, type Holdings, type InvestmentPolicy } from '../lib/live';
import { matchesStockQuery } from '../lib/stock-search';
import { useAuth } from '../providers/auth-provider';
import { apiRequest } from '../lib/api';
import { useTheme } from '../theme';

// The white selected face and its dark label deliberately stay constant in both appearances.
const selectedCardText = '#1B1B1B';
const selectedCardCaption = '#686868';
const PAGE_SIZE = 24;
const letterFor = (name: string) => {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter >= 'A' && letter <= 'Z' ? letter : '#';
};

type MarketItem = {
  symbol: string;
  name: string;
  issuer: 'xstocks' | 'prestocks';
};

export function FallbackStock({ onContinue }: { onContinue?: () => void }) {
  const [revealed, setRevealed] = useState(!onContinue);
  const reveal = useCallback(() => setRevealed(true), []);
  const auth = useAuth();
  const cache = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const catalog = useLive<{ items: MarketItem[] }>('/v1/trading/markets');
  const holdings = useLive<Holdings>('/v1/portfolio');
  const [selection, setSelection] = useState<string | null | undefined>();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<FlashListRef<MarketItem>>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const chosen = selection === undefined ? (policy.data?.fallbackSymbol ?? null) : selection;
  const owned = useMemo(
    () =>
      new Set(holdings.data?.items.filter((h) => BigInt(h.rawAmount) > 0n).map((h) => h.symbol)),
    [holdings.data?.items],
  );
  const items = useMemo(
    () =>
      [...(catalog.data?.items ?? [])].sort(
        (a, b) => a.name.localeCompare(b.name) || a.symbol.localeCompare(b.symbol),
      ),
    [catalog.data?.items],
  );
  const filteredItems = useMemo(
    () =>
      items.filter((stock) =>
        matchesStockQuery(stock.symbol, stock.name, deferredSearch, stock.issuer),
      ),
    [deferredSearch, items],
  );
  const visibleItems = filteredItems.slice(0, visibleCount);
  const letters = useMemo(
    () => [...new Set(filteredItems.map((stock) => letterFor(stock.name)))],
    [filteredItems],
  );
  const loadMore = useCallback(() => {
    setVisibleCount((count) =>
      count >= filteredItems.length ? count : Math.min(filteredItems.length, count + PAGE_SIZE),
    );
  }, [filteredItems.length]);
  const jumpToLetter = useCallback(
    (letter: string) => {
      const index = filteredItems.findIndex((stock) => letterFor(stock.name) === letter);
      if (index < 0) return;
      setVisibleCount((count) =>
        Math.max(count, Math.min(filteredItems.length, index + PAGE_SIZE)),
      );
      setPendingIndex(index);
    },
    [filteredItems],
  );
  useEffect(() => {
    if (pendingIndex === null || pendingIndex >= visibleItems.length) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: pendingIndex, animated: true, viewPosition: 0.08 });
      setPendingIndex(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingIndex, visibleItems.length]);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(auth.getAccessToken, '/v1/investment-policy/fallback', {
        method: 'PATCH',
        body: JSON.stringify({ symbol: chosen }),
      });
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      if (onContinue) onContinue();
      else {
        // Confirm the save on the button itself, then dismiss the sheet.
        setSaved(true);
        setTimeout(() => router.back(), 500);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  const body = (
    <View style={{ gap: 14 }}>
      {onContinue ? (
        <OnboardingNotificationCard
          merchant="Unknown merchant"
          detail="Example purchase · No stock match"
          amount="$4.65"
          onComplete={reveal}
        />
      ) : null}
      {revealed ? (
        <>
          {onContinue ? (
            <View style={styles.animation}>
              <OnboardingAnimation name="spare" height={180} loop />
            </View>
          ) : null}
          {onContinue ? <Type variant="title">What about unknown transactions?</Type> : null}
          <Type muted>
            Eligible purchases without a stock match can round up into a stock of your choice, or be
            left unmatched.
          </Type>
          <TextInput
            accessibilityLabel="Search supported stocks"
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setVisibleCount(PAGE_SIZE);
              setPendingIndex(null);
            }}
            placeholder="Search stocks"
            placeholderTextColor={colors.muted}
            style={{
              color: colors.ink,
              paddingHorizontal: 16,
              paddingVertical: 12,
              minHeight: 52,
              lineHeight: 22,
              textAlignVertical: 'center',
              borderRadius: 12,
              backgroundColor: colors.surface,
              fontSize: 17,
              letterSpacing: 0,
            }}
          />
          {catalog.isPending ? <Type muted>Loading purchasable stocks…</Type> : null}
          {catalog.error ? <Type accessibilityRole="alert">{catalog.error.message}</Type> : null}
          {catalog.data ? (
            <Type variant="caption" muted style={styles.resultCount}>
              {search.trim()
                ? `${filteredItems.length.toLocaleString()} matches · ${items.length.toLocaleString()} supported stocks`
                : `${items.length.toLocaleString()} supported stocks`}
            </Type>
          ) : null}
        </>
      ) : null}
    </View>
  );
  const action = (
    <>
      <Button
        appearance="onboarding"
        title={
          onContinue ? 'Save and continue' : saved ? 'Saved' : 'Save stock'
        }
        loading={busy}
        disabled={
          saved ||
          !revealed ||
          (onContinue && selection === undefined) ||
          policy.isPending ||
          !!policy.error ||
          !!catalog.error
        }
        onPress={() => void save()}
      />
      {onContinue ? (
        <TextButton
          title={
            selection === null ? '✓ Don’t match unknown purchases' : 'Don’t match unknown purchases'
          }
          disabled={busy}
          onPress={() => setSelection(null)}
        />
      ) : (
        revealed && (
          <TextButton
            title="Don’t use fallback stocks"
            disabled={busy || saved}
            onPress={() => setSelection(null)}
          />
        )
      )}
    </>
  );
  const letterRail =
    revealed && catalog.data && letters.length > 1 ? (
      <View
        accessibilityLabel="Stock list alphabet index"
        style={[styles.letterRail, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        {letters.map((letter) => (
          <Pressable
            key={letter}
            accessibilityRole="button"
            accessibilityLabel={`Jump to stocks beginning with ${letter}`}
            hitSlop={{ left: 8, right: 8, top: 2, bottom: 2 }}
            onPress={() => jumpToLetter(letter)}
            style={styles.letterButton}
          >
            <Type style={styles.letter}>{letter}</Type>
          </Pressable>
        ))}
      </View>
    ) : null;
  const footer = (
    <View style={styles.footer}>
      {catalog.data && filteredItems.length === 0 ? (
        <Type muted>No supported stocks match “{search.trim()}”.</Type>
      ) : null}
      {message ? <Type accessibilityRole="alert">{message}</Type> : null}
      {fontScale > 1.3 ? action : null}
    </View>
  );
  return (
    // Both variants paint the app background: the settings sheet sits on solid
    // black like every other screen instead of the system sheet material.
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        ref={listRef}
        data={revealed ? visibleItems : []}
        extraData={{ chosen, busy, owned }}
        keyExtractor={(stock) => stock.symbol}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: onContinue ? insets.top + 24 : 24,
          paddingLeft: 28,
          paddingRight: 42,
          paddingBottom: 24,
        }}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {!onContinue ? (
              <Type variant="title" accessibilityRole="header">
                Fallback stock
              </Type>
            ) : null}
            {body}
          </View>
        }
        renderItem={({ item: stock }) => {
          const selected = chosen === stock.symbol;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${stock.name}, ${stock.symbol}${owned.has(stock.symbol) ? ', in your portfolio' : ''}`}
              accessibilityState={{ selected }}
              disabled={busy}
              onPress={() => setSelection(stock.symbol)}
              style={[
                styles.stockRow,
                { borderBottomColor: selected ? 'transparent' : colors.line },
                selected && styles.stockRowSelected,
              ]}
            >
              <CompanyMark symbol={stock.symbol} size={44} unframed />
              <View style={{ flex: 1 }}>
                <Type style={selected ? { color: selectedCardText } : undefined}>{stock.name}</Type>
                <Type
                  variant="caption"
                  muted={!selected}
                  style={selected ? { color: selectedCardCaption } : undefined}
                >
                  {stock.symbol}
                  {` · ${stock.issuer === 'prestocks' ? 'PreStocks' : 'xStocks'}`}
                  {owned.has(stock.symbol) ? ' · In your portfolio' : ''}
                </Type>
              </View>
              <Type
                style={{ color: selected ? selectedCardText : colors.muted, fontWeight: '600' }}
              >
                {selected ? '✓' : '○'}
              </Type>
            </Pressable>
          );
        }}
        ListFooterComponent={footer}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
      />
      {fontScale <= 1.3 ? (
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {action}
        </View>
      ) : null}
      {letterRail}
    </View>
  );
}

const styles = StyleSheet.create({
  // The spare artwork carries empty margin inside its frames; trim it so the
  // headline sits close to the illustration.
  animation: { marginBottom: -26 },
  container: { flex: 1 },
  listHeader: { gap: 14, paddingBottom: 8 },
  footer: { gap: 14, paddingTop: 14 },
  actions: {
    gap: 12,
    paddingHorizontal: 28,
    paddingTop: 16,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  stockRow: {
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  stockRowSelected: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
  },
  resultCount: { fontVariant: ['tabular-nums'] },
  letterRail: {
    position: 'absolute',
    right: 4,
    top: 148,
    bottom: 132,
    minWidth: 24,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderRadius: 12,
    borderCurve: 'continuous',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  letterButton: {
    minWidth: 22,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontSize: 10, lineHeight: 12, fontWeight: '600' },
});
