import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import type { CryptoCard, OnchainSpendingPreview } from '@roundups/types';
import { deleteCryptoCard, fetchOnchainSpendingPreview } from '../lib/api';
import { useLive } from '../lib/live';
import { cryptoCardBrandLogos } from '../lib/onboarding-brand-assets';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';
import { Button, Type } from './ui';
import { SwipeToDeleteRow } from './swipe-to-delete-row';
import { OnchainTransactionPreview } from './onchain-transaction-preview';
import { AddCryptoCardSheet } from './add-crypto-card-sheet';

const providerLabels = { etherfi: 'EtherFi', tuyo: 'Tuyo' } as const;

export function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function mergePreviews(previews: readonly (OnchainSpendingPreview | null)[]) {
  const present = previews.filter((preview): preview is OnchainSpendingPreview => preview !== null);
  if (!present.length) return null;
  const months = present[0]!.months.map((_, index) => {
    const sameMonth = present.map((preview) => preview.months[index]!);
    return {
      month: sameMonth[0]!.month,
      spentCents: sameMonth.reduce((sum, month) => sum + month.spentCents, 0),
      roundupCents: sameMonth.reduce((sum, month) => sum + month.roundupCents, 0),
      purchaseCount: sameMonth.reduce((sum, month) => sum + month.purchaseCount, 0),
      roundupCount: sameMonth.reduce((sum, month) => sum + month.roundupCount, 0),
    };
  });
  return {
    mode: 'historical_preview',
    provider: 'etherfi',
    roundingIncrementCents: present[0]!.roundingIncrementCents,
    roundupPercentage: present[0]!.roundupPercentage,
    addresses: present.flatMap((preview) => preview.addresses),
    transactions: present
      .flatMap((preview) => preview.transactions)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 10),
    months,
    averageMonthlySpentCents: Math.round(
      months.reduce((sum, month) => sum + month.spentCents, 0) / months.length,
    ),
    averageMonthlyRoundupCents: Math.round(
      months.reduce((sum, month) => sum + month.roundupCents, 0) / months.length,
    ),
  } satisfies OnchainSpendingPreview;
}

/** Manages saved crypto card addresses. Multiple addresses per card are supported. */
export function CryptoCards() {
  const { colors } = useTheme();
  const auth = useAuth();
  const cards = useLive<{ items: CryptoCard[] }>('/v1/bank/crypto-cards', true, false);

  const items = cards.data?.items ?? [];
  const [preview, setPreview] = useState<OnchainSpendingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const refreshCards = useCallback(() => {
    void cards.refetch().catch(() => {});
  }, [cards]);

  // Scan all saved addresses together, grouped by provider because a preview
  // call covers one provider at a time. Re-run only when the saved set changes.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const signature = items.map((card) => `${card.provider}:${card.address}`).join('|');
  const scanId = useRef(0);
  useEffect(() => {
    if (!signature) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const currentScan = ++scanId.current;
    setPreviewLoading(true);
    setPreviewError(null);
    const groups = new Map<'etherfi' | 'tuyo', string[]>();
    for (const card of itemsRef.current)
      groups.set(card.provider, [...(groups.get(card.provider) ?? []), card.address]);
    Promise.all(
      [...groups.entries()].map(([provider, addresses]) =>
        fetchOnchainSpendingPreview(auth.getAccessToken, addresses, provider).catch(() => null),
      ),
    )
      .then((results) => {
        if (currentScan !== scanId.current) return;
        const merged = mergePreviews(results);
        setPreview(merged);
        if (!merged) setPreviewError('We couldn’t read your card activity. Try again in a moment.');
      })
      .finally(() => {
        if (currentScan === scanId.current) setPreviewLoading(false);
      });
  }, [signature, auth.getAccessToken]);

  async function removeCard(card: CryptoCard) {
    if (removingId) return;
    setRemovingId(card.id);
    try {
      await deleteCryptoCard(auth.getAccessToken, card.id);
      setOpenRowId(null);
      refreshCards();
    } catch (cause) {
      Alert.alert(
        'Could not remove',
        cause instanceof Error ? cause.message : 'Please try again in a moment.',
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <View style={styles.root}>
      {cards.error ? <Type accessibilityRole="alert">{cards.error.message}</Type> : null}
      {items.length ? (
        <View style={styles.savedCards}>
          {items.map((card) => (
            <SwipeToDeleteRow
              key={card.id}
              open={openRowId === card.id}
              busy={removingId === card.id}
              onOpenChange={(open) => setOpenRowId(open ? card.id : null)}
              onDelete={() => void removeCard(card)}
              accessibilityLabel={`${providerLabels[card.provider]} card ${shortAddress(card.address)}`}
              accessibilityHint="Swipe to reveal Delete, which stops reading purchases from this address"
            >
              <View style={[styles.cardRow, { borderBottomWidth: 1, borderColor: colors.line }]}>
                <Image
                  accessible={false}
                  accessibilityElementsHidden
                  source={cryptoCardBrandLogos[providerLabels[card.provider]]}
                  resizeMode="contain"
                  style={styles.providerLogo}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Type style={{ fontWeight: '500' }}>{providerLabels[card.provider]}</Type>
                  <Type variant="caption" muted selectable>
                    {shortAddress(card.address)}
                  </Type>
                </View>
              </View>
            </SwipeToDeleteRow>
          ))}
        </View>
      ) : null}
      {items.length && previewError ? <Type accessibilityRole="alert">{previewError}</Type> : null}
      {items.length ? (
        <OnchainTransactionPreview loading={previewLoading} transactions={preview?.transactions} />
      ) : null}
      <View style={styles.addAction}>
        <Button
          appearance="onboarding"
          title="Add crypto card"
          onPress={() => setSheetOpen(true)}
        />
      </View>
      <AddCryptoCardSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={refreshCards}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 20 },
  savedCards: { gap: 8 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingBottom: 16,
  },
  providerLogo: { width: 32, height: 32, borderRadius: 8, overflow: 'hidden' },
  addAction: { marginTop: 'auto', paddingTop: 8 },
});
