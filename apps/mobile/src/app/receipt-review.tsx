import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { useLive, type InvestmentPolicy } from '../lib/live';
import { apiRequest } from '../lib/api';
import { money } from '../lib/purchases';
import { posthog } from '../lib/telemetry';
import {
  clearReceiptScanDraft,
  getReceiptScanDraft,
  receiptAmountCents,
  receiptCurrency,
} from '../lib/receipt-scan-session';
import { AppSymbol } from '../components/app-symbol';
import { Button, Type } from '../components/ui';
import { OnboardingAnimation } from '../components/onboarding-animation';
import { ReviewReceiptCard } from '../components/receipt-scan/review-receipt-card';
import {
  EditReceiptTray,
  type EditableReceipt,
} from '../components/receipt-scan/edit-receipt-tray';

type Saved = {
  preview: boolean;
  alreadyConfirmed: boolean;
  roundupCents: number;
  currency: string;
  stockName: string | null;
};

/** The scanned receipt as a card to check, edit in a tray, and confirm. */
export default function ReceiptReview() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const cache = useQueryClient();
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const markets = useLive<{ items: { symbol: string; name: string }[] }>('/v1/trading/markets');
  const merchants = useLive<{ items: { name: string; symbol: string }[] }>(
    '/v1/manual/merchants',
  );
  const { width } = useWindowDimensions();
  // The draft is written by the scan screen and consumed once, here.
  const [draft] = useState(() => getReceiptScanDraft());
  const [merchant, setMerchant] = useState(draft?.merchant ?? '');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [date, setDate] = useState(draft?.date ?? '');
  const [currency, setCurrency] = useState(receiptCurrency(draft?.currency));
  const [totalCents, setTotalCents] = useState(draft ? receiptAmountCents(draft.total) : null);
  const [usdCents, setUsdCents] = useState(draft?.usdCents ?? null);
  const [trayVisible, setTrayVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const cardData = useMemo(
    () => ({
      merchant,
      category: draft?.category ?? null,
      date,
      paymentMethod: draft?.paymentMethod ?? null,
      items: draft?.items ?? null,
      subtotalCents: receiptAmountCents(draft?.subtotal ?? null),
      taxCents: receiptAmountCents(draft?.tax ?? null),
      totalCents,
      currency,
      usdCents,
    }),
    [currency, date, draft, merchant, totalCents, usdCents],
  );

  // A merchant the catalogue knows maps the roundup straight to its stock;
  // anything else invests through the fallback stock.
  const matchedSymbol = useMemo(() => {
    const normalized = merchant.trim().toLowerCase();
    if (normalized.length < 2) return null;
    return (
      merchants.data?.items.find((item) => item.name.toLowerCase() === normalized)?.symbol ?? null
    );
  }, [merchant, merchants.data]);
  const targetSymbol = selectedSymbol ?? matchedSymbol ?? policy.data?.fallbackSymbol ?? null;
  const targetName =
    targetSymbol == null
      ? null
      : (markets.data?.items.find((stock) => stock.symbol === targetSymbol)?.name ?? targetSymbol);

  const percentage = policy.data?.roundupPercentage ?? 0;
  const effectiveCents = usdCents ?? totalCents ?? 0;
  const calculatedRoundup = percentage
    ? Math.floor((effectiveCents * percentage + 50) / 100)
    : (100 - (effectiveCents % 100)) % 100;
  const roundup = Math.min(calculatedRoundup, policy.data?.maxRoundupCents ?? 900);
  const valid =
    merchant.trim().length >= 2 &&
    !!totalCents &&
    totalCents > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date);
  const missingDetails = !totalCents || merchant.trim().length < 2;
  const needsFallbackStock =
    (selectedSymbol ?? matchedSymbol) == null && !policy.data?.fallbackSymbol;

  async function confirm() {
    if (!valid || busy || !draft?.receiptId) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiRequest<{
        transactionId?: string;
        preview?: boolean;
        alreadyConfirmed?: boolean;
      }>(auth.getAccessToken, `/v1/manual/receipts/${draft.receiptId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          merchant: merchant.trim(),
          amountCents: totalCents,
          currency,
          date,
          purchaseConfirmed: true,
          ...(selectedSymbol ?? matchedSymbol
            ? { symbol: (selectedSymbol ?? matchedSymbol)! }
            : {}),
        }),
      });
      posthog?.capture('manual_purchase_confirmed', {
        outcome: result.alreadyConfirmed
          ? 'already_confirmed'
          : result.preview
            ? 'preview'
            : 'submitted',
        flow: 'scan',
      });
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      clearReceiptScanDraft();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSaved({
        alreadyConfirmed: !!result.alreadyConfirmed,
        preview: !!result.preview,
        roundupCents: roundup,
        currency: usdCents != null ? 'USD' : currency,
        stockName: targetName,
      });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Stable identity between renders: the edit tray resets its fields whenever
  // this object changes, and live-query polls re-render this screen often.
  const editable: EditableReceipt = useMemo(
    () => ({
      merchant,
      symbol: selectedSymbol,
      date,
      currency,
      amountCents: totalCents ?? 0,
    }),
    [merchant, selectedSymbol, date, currency, totalCents],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      {saved ? (
        <View
          style={[
            styles.success,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={{ alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center' }}>
            <OnboardingAnimation name="funding-thumbs-up" height={120} loop={false} />
            <Type variant="title" style={styles.successTitle}>
              {saved.alreadyConfirmed
                ? 'Already saved'
                : saved.preview
                  ? 'Saved as preview'
                  : saved.stockName
                    ? `${saved.stockName} roundup completed`
                    : 'Roundup completed'}
            </Type>
            <Type style={styles.successBody}>
              {saved.alreadyConfirmed
                ? 'This purchase was already recorded. Check Activity for its roundup.'
                : saved.preview
                  ? 'No money was invested yet. Automatic investing is paused — turn it on so your purchases invest.'
                  : saved.roundupCents > 0
                    ? `${money(saved.roundupCents, saved.currency)} from this purchase is invested${
                        saved.stockName ? ` in ${saved.stockName}` : ''
                      }.`
                    : 'This purchase was already at a whole amount, so its roundup is $0.00.'}
            </Type>
          </View>
          <View style={{ gap: 10, alignSelf: 'stretch', alignItems: 'center' }}>
            <Button
              appearance="onboarding"
              title="Scan another receipt"
              onPress={() => {
                clearReceiptScanDraft();
                router.replace('/receipt-scan');
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.dismissTo('/')}
              style={({ pressed }) => [styles.successSecondary, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Type style={styles.successSecondaryLabel}>Done</Type>
            </Pressable>
          </View>
        </View>
      ) : !draft ? (
        <View style={[styles.empty, { paddingTop: insets.top + 24 }]}>
          <Type variant="headline" style={styles.emptyTitle}>
            No receipt to review
          </Type>
          <Type style={styles.emptyBody}>Scan a receipt first and it will land here.</Type>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/receipt-scan')}
            style={({ pressed }) => [
              styles.successPrimary,
              { opacity: pressed ? 0.85 : 1, marginTop: 10 },
            ]}
          >
            <Type style={styles.successPrimaryLabel}>Scan a receipt</Type>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 132 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Type
              accessibilityElementsHidden
              style={[styles.watermark, { fontSize: Math.min(width * 0.28, 130) }]}
            >
              Receipt
            </Type>
            <Type style={styles.heading}>Review your receipt</Type>
            <ReviewReceiptCard data={cardData} />
            {needsFallbackStock ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/settings/fallback')}
                style={({ pressed }) => [
                  styles.selectStock,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <AppSymbol name="next" color="#0E1118" size={15} />
                <Type style={styles.selectStockLabel}>Select stock</Type>
              </Pressable>
            ) : targetName ? (
              <Type style={styles.targetStock}>Rounds up into {targetName}</Type>
            ) : null}
            {missingDetails ? (
              <View style={styles.warningPill} accessibilityRole="alert">
                <Type style={styles.warningText}>
                  We couldn’t read every detail. Tap Edit to finish the receipt.
                </Type>
              </View>
            ) : null}
            {message ? (
              <View style={styles.warningPill} accessibilityRole="alert">
                <Type style={styles.warningText}>{message}</Type>
                {message.includes('Add enough USDC') ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/funding')}
                    hitSlop={8}
                  >
                    <Type
                      style={[
                        styles.warningText,
                        { fontWeight: '700', textDecorationLine: 'underline' },
                      ]}
                    >
                      Add balance
                    </Type>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.dock, { bottom: insets.bottom + 14 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to camera"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.dockCircle,
                styles.dockBack,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <AppSymbol name="back" color="#1C2438" size={19} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit receipt"
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                setTrayVisible(true);
              }}
              style={({ pressed }) => [styles.dockEdit, { opacity: pressed ? 0.85 : 1 }]}
            >
              <AppSymbol name="edit" color="#FFFFFF" size={16} />
              <Type style={styles.dockEditLabel}>Edit</Type>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm receipt"
              accessibilityState={{ disabled: !valid || busy }}
              disabled={!valid || busy}
              onPress={() => void confirm()}
              style={({ pressed }) => [
                styles.dockCircle,
                styles.dockConfirm,
                { opacity: !valid ? 0.35 : pressed ? 0.85 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <AppSymbol name="check" color="#FFFFFF" size={22} />
              )}
            </Pressable>
          </View>
          <EditReceiptTray
            visible={trayVisible}
            onClose={() => setTrayVisible(false)}
            value={editable}
            policy={{
              percentage,
              maxRoundupCents: policy.data?.maxRoundupCents ?? 900,
              usdCents,
            }}
            onSave={(next, conversionStale) => {
              setMerchant(next.merchant);
              setSelectedSymbol(next.symbol);
              setDate(next.date);
              setCurrency(receiptCurrency(next.currency));
              setTotalCents(next.amountCents);
              if (conversionStale) setUsdCents(null);
              setTrayVisible(false);
              setMessage(null);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  content: { alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  watermark: {
    position: 'absolute',
    top: 8,
    color: 'rgba(255,255,255,0.20)',
    fontWeight: '700',
    letterSpacing: 2,
  },
  heading: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  targetStock: { color: 'rgba(255,255,255,0.66)', fontSize: 13.5 },
  selectStock: {
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  selectStockLabel: { color: '#0E1118', fontSize: 15, fontWeight: '600' },
  warningPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 6,
    maxWidth: 340,
  },
  warningText: { color: '#232B52', fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  dock: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 38,
    borderCurve: 'continuous',
    padding: 9,
    boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
  },
  dockCircle: { alignItems: 'center', justifyContent: 'center' },
  dockBack: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EEF2FC' },
  dockEdit: {
    minHeight: 52,
    paddingHorizontal: 30,
    borderRadius: 26,
    backgroundColor: '#161A24',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dockEditLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  dockConfirm: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#0A0D15' },
  success: { flex: 1, paddingHorizontal: 30, gap: 18 },
  successTitle: { color: '#FFFFFF', textAlign: 'center' },
  successBody: { color: 'rgba(255,255,255,0.72)', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  successPrimary: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
  },
  successPrimaryLabel: { color: '#131A38', fontSize: 16, fontWeight: '700' },
  successSecondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  successSecondaryLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', opacity: 0.8 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 30,
  },
  emptyTitle: { color: '#FFFFFF' },
  emptyBody: { color: 'rgba(255,255,255,0.66)', textAlign: 'center' },
});
