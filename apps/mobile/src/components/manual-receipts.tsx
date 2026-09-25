import { money, roundupStateLabel, type Purchase } from '../lib/purchases';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Screen, TextButton, Type } from './ui';
import { OnboardingAnimation } from './onboarding-animation';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';
import { useLive, type Balances, type InvestmentPolicy } from '../lib/live';
import { apiRequest } from '../lib/api';
import { ManualGuideVideo } from './manual-guide-video';
import { ReceiptDatePicker } from './receipt-date-picker';
import { localReceiptDate } from '../lib/receipt-date';
import { posthog } from '../lib/telemetry';
import { solscanTxUrl } from '../lib/explorer';
import { CompanyMark, MerchantIcon } from './company-mark';

// Mirrors the currencies the confirm endpoint accepts; USD needs no conversion.
const RECEIPT_CURRENCIES = ['USD', 'EUR', 'CHF', 'AED', 'GBP', 'INR'] as const;
type ReceiptCurrency = (typeof RECEIPT_CURRENCIES)[number];
function receiptCurrency(code: string | null | undefined): ReceiptCurrency {
  return RECEIPT_CURRENCIES.find((currency) => currency === code) ?? 'USD';
}

/* eslint-disable @typescript-eslint/no-require-imports */
// Same artwork family as the USDC balance overview card.
const currencyCardArt = require('../../assets/illustrations/wallet-token.png');
/* eslint-enable @typescript-eslint/no-require-imports */

type Receipt = {
  id: string;
  hasPhoto: boolean;
  transactionId: string | null;
  merchant: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
  roundupCents: number | null;
  symbol: string | null;
  createdAt: string;
};
type Extraction = {
  merchant: string | null;
  total: string | null;
  date: string | null;
  currency: string | null;
  usdCents?: number | null;
};
function ReceiptPhoto({ id }: { id: string }) {
  const image = useLive<{ dataUrl: string | null }>(`/v1/manual/receipts/${id}/image`, true, false);
  return image.data?.dataUrl ? (
    <Image
      accessibilityLabel="Saved receipt photo"
      source={{ uri: image.data.dataUrl }}
      resizeMode="contain"
      style={{ height: 180, width: '100%' }}
    />
  ) : (
    <Type muted>{image.error ? 'Photo unavailable' : 'Loading photo…'}</Type>
  );
}
export function ManualReceipts() {
  const auth = useAuth();
  const cache = useQueryClient();
  const { colors, isDark } = useTheme();
  const receipts = useLive<{
    items: Receipt[];
    nextCursor: string | null;
    scanEnabled: boolean;
    photosEnabled: boolean;
  }>('/v1/manual/receipts');
  const balances = useLive<Balances>('/v1/trading/balances');
  const markets = useLive<{ items: { symbol: string; name: string }[] }>(
    '/v1/trading/markets',
    true,
    false,
  );
  const [searchingMerchant, setSearchingMerchant] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const [older, setOlder] = useState<Receipt[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>();
  const nextCursor = olderCursor === undefined ? receipts.data?.nextCursor : olderCursor;
  const gallery = [...(receipts.data?.items ?? []), ...older].filter(
    (item, i, all) => all.findIndex((r) => r.id === item.id) === i,
  );
  async function loadOlder() {
    if (!nextCursor) return;
    const page = await apiRequest<{ items: Receipt[]; nextCursor: string | null }>(
      auth.getAccessToken,
      `/v1/manual/receipts?before=${nextCursor}`,
    );
    setOlder((items) => [...items, ...page.items]);
    setOlderCursor(page.nextCursor);
  }
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localReceiptDate(new Date()));
  const [currency, setCurrency] = useState<ReceiptCurrency>('USD');
  const [usdCents, setUsdCents] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<null | {
    preview: boolean;
    alreadyConfirmed: boolean;
    roundupCents: number;
    currency: string;
    symbol: string | null;
    transactionId: string | null;
  }>(null);
  const key = useRef(Crypto.randomUUID());
  const lock = useRef(false);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function start() {
    setEditing(true);
    setDraft(null);
    setPhoto(null);
    setHasPhoto(false);
    setMerchant('');
    setSelectedSymbol(null);
    setAmount('');
    setDate(localReceiptDate(new Date()));
    setCurrency('USD');
    setUsdCents(null);
    key.current = Crypto.randomUUID();
    setMessage('');
    setSaved(null);
  }
  async function saveDraft(image = photo) {
    if (draft) return draft;
    const result = await apiRequest<{ id: string; transactionId: string | null }>(
      auth.getAccessToken,
      '/v1/manual/receipts',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': key.current },
        // Storage availability must not prevent selecting a local receipt.
        body: JSON.stringify({ image: receipts.data?.photosEnabled === false ? null : image }),
      },
    );
    setDraft(result.id);
    if (result.transactionId)
      throw new Error('This receipt has already been confirmed. It is saved in your gallery.');
    return result.id;
  }
  function applyExtraction(result: Extraction) {
    setMerchant(result.merchant ?? '');
    setAmount(result.total ?? '');
    setDate(result.date ?? localReceiptDate(new Date()));
    setCurrency(receiptCurrency(result.currency));
    setUsdCents(result.usdCents ?? null);
    setMessage(
      result.merchant && result.total
        ? ''
        : 'We could not read every detail. Retake the photo in better light and try again.',
    );
  }
  async function scan(id: string) {
    applyExtraction(
      await apiRequest<Extraction>(auth.getAccessToken, `/v1/manual/receipts/${id}/scan`, {
        method: 'POST',
        body: JSON.stringify({ aiConsent: true }),
      }),
    );
  }
  async function checkFunds(requiredCents = 0) {
    const result = await balances.refetch();
    if (result.error || !result.data)
      throw result.error ?? new Error('Could not check your balance. Please try again.');
    const available = BigInt(result.data.availableUsdcRaw);
    if (available <= 0n || available < BigInt(requiredCents) * 10_000n)
      throw new Error('Add enough USDC to cover your roundup before adding this receipt.');
  }
  async function capture(camera: boolean) {
    await checkFunds();
    if (camera) {
      // expo-image-picker crashes (uncatchable ObjC exception) launching a camera that
      // does not exist — e.g. the iOS Simulator, which has no camera hardware.
      if (Platform.OS === 'ios' && !Device.isDevice)
        throw new Error('No camera on this device. Choose from the camera roll instead.');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Allow camera access in Settings, then try again.');
    } else if (Platform.OS === 'ios') {
      // With allowsEditing the iOS picker runs in-process and shows nothing selectable
      // without photo access, so the library permission must be surfaced explicitly.
      // Android's system photo picker never needs a permission.
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Allow photo access in Settings, then try again.');
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.45,
      allowsEditing: true,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const base64 = result.assets[0]?.base64;
    if (!base64) throw new Error('Could not read this photo. Try a JPEG receipt photo.');
    const image = `data:image/jpeg;base64,${base64}`;
    if (image.length > 2800000)
      throw new Error('Crop closer to the receipt and try again. The photo is too large.');
    setPhoto(image);
    setHasPhoto(true);
    setDraft(null);
    key.current = Crypto.randomUUID();
    applyExtraction({ merchant: null, total: null, date: null, currency: null });
    if (!receipts.data?.scanEnabled) {
      setMessage('Enter the receipt details below to save your purchase.');
      return;
    }
    // Keep the photo local until the user explicitly allows AI processing or saves it.
  }
  const validAmount = /^\d{1,8}(\.\d{1,2})?$/.test(amount);
  const [whole = '0', fraction = ''] = amount.split('.');
  const cents = validAmount ? Number(whole) * 100 + Number(fraction.padEnd(2, '0')) : 0;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const effectiveCents = usdCents ?? cents;
  const percentage = policy.data?.roundupPercentage ?? 0;
  const calculatedRoundup = percentage
    ? Math.floor((effectiveCents * percentage + 50) / 100)
    : (100 - (effectiveCents % 100)) % 100;
  const roundup = Math.min(calculatedRoundup, policy.data?.maxRoundupCents ?? 900);
  const displayCurrency = currency;
  async function submit() {
    if (!validAmount || !cents || !validDate || !merchant.trim())
      throw new Error('This receipt is missing readable details. Retake the photo and try again.');
    await checkFunds(displayCurrency === 'USD' ? roundup : 0);
    const id = await saveDraft();
    const result = await apiRequest<{
      transactionId?: string;
      preview?: boolean;
      alreadyConfirmed?: boolean;
    }>(auth.getAccessToken, `/v1/manual/receipts/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        merchant,
        amountCents: cents,
        currency: displayCurrency,
        date,
        purchaseConfirmed: true,
        ...(selectedSymbol ? { symbol: selectedSymbol } : {}),
      }),
    });
    posthog?.capture('manual_purchase_confirmed', {
      outcome: result.alreadyConfirmed
        ? 'already_confirmed'
        : result.preview
          ? 'preview'
          : 'submitted',
    });
    setSaved({
      alreadyConfirmed: !!result.alreadyConfirmed,
      preview: !!result.preview,
      roundupCents: roundup,
      currency: usdCents != null ? 'USD' : displayCurrency,
      symbol: selectedSymbol,
      transactionId: result.transactionId ?? null,
    });
    setEditing(false);
    setDraft(null);
    setPhoto(null);
  }
  // The worker executes the roundup within seconds of confirmation; poll the
  // purchase so the confirmation itself can link to the on-chain transaction.
  const investable = !!saved?.transactionId && !saved.preview && !saved.alreadyConfirmed;
  const invested = useLive<Purchase & { signature?: string | null }>(
    saved?.transactionId ? `/v1/transactions/${saved.transactionId}` : '/v1/manual/receipts',
    investable,
    investable ? 5000 : false,
  );
  const purchaseSignature = investable ? (invested.data?.signature ?? null) : null;
  const funded = !!balances.data && BigInt(balances.data.availableUsdcRaw) > 0n;
  if (saved) {
    // The roundup buys the picked stock, or the policy fallback when none was picked.
    const purchasedSymbol = saved.symbol ?? policy.data?.fallbackSymbol ?? null;
    const purchasedName =
      saved.preview || saved.alreadyConfirmed
        ? null
        : purchasedSymbol
          ? (markets.data?.items.find((stock) => stock.symbol === purchasedSymbol)?.name ??
            purchasedSymbol)
          : null;
    return (
      <Screen fillContent compact>
        <Stack.Screen options={{ sheetAllowedDetents: [0.62, 0.85] }} />
        <View
          style={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
            paddingTop: 24,
          }}
        >
          <OnboardingAnimation name="funding-thumbs-up" height={120} loop={false} />
          {purchasedName ? (
            <View
              accessibilityRole="header"
              accessibilityLabel={`You got ${purchasedName}`}
              style={{ alignItems: 'center', gap: 12 }}
            >
              <Type variant="title" accessibilityElementsHidden style={{ textAlign: 'center' }}>
                You got
              </Type>
              <View
                style={styles.stockChip}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <CompanyMark symbol={purchasedSymbol ?? undefined} size={36} />
                <Type numberOfLines={1} style={styles.stockChipLabel}>
                  {purchasedName}
                </Type>
              </View>
            </View>
          ) : (
            <Type variant="headline" style={{ textAlign: 'center' }}>
              {saved.alreadyConfirmed
                ? 'Already saved'
                : saved.preview
                  ? 'Saved as preview'
                  : purchasedName
                    ? `${purchasedName} roundup completed`
                    : 'Roundup completed'}
            </Type>
          )}
          <Type muted style={{ textAlign: 'center' }}>
            {saved.alreadyConfirmed
              ? 'This purchase was already recorded. Check Activity for its roundup.'
              : saved.preview
                ? 'No money was invested yet. Automatic investing is paused — turn it on so your purchases invest.'
                : saved.roundupCents > 0
                  ? `${money(saved.roundupCents, saved.currency)} from this purchase is set aside${
                      purchasedSymbol ? ` for ${purchasedSymbol}` : ' for investing'
                    }.`
                  : 'This purchase was already at a whole amount, so its roundup is $0.00.'}
          </Type>
          {investable ? (
            purchaseSignature ? (
              <Button
                title="View on Solana"
                secondary
                onPress={() => void Linking.openURL(solscanTxUrl(purchaseSignature))}
              />
            ) : (
              <Type variant="caption" muted>
                Investing on Solana… the transaction link appears here once it lands.
              </Type>
            )
          ) : null}
        </View>
        <View style={{ gap: 10 }}>
          <Button appearance="onboarding" title="Add another purchase" onPress={start} />
          <TextButton title="Done" onPress={() => setSaved(null)} />
        </View>
      </Screen>
    );
  }
  if (editing && (!funded || balances.error))
    return (
      <Screen title="Manual mode" fillContent compact>
        <Stack.Screen options={{ sheetAllowedDetents: [0.42, 0.65] }} />
        <Type variant="headline">
          {balances.isPending
            ? 'Checking your balance…'
            : balances.error
              ? 'Check your wallet balance'
              : 'Add balance first'}
        </Type>
        <Type muted>
          {balances.error
            ? 'Your balance could not be refreshed. Try again before adding a receipt.'
            : 'Your roundups use USDC from your wallet. Add balance before recording a purchase.'}
        </Type>
        <View style={{ flexGrow: 1, justifyContent: 'flex-end', gap: 12 }}>
          {balances.error ? (
            <Button
              title="Try again"
              onPress={() => void balances.refetch()}
              loading={balances.isFetching}
            />
          ) : !balances.isPending ? (
            <Button
              appearance="onboarding"
              title="Add balance"
              onPress={() => router.push('/funding')}
            />
          ) : null}
          {gallery.length ? (
            <Button secondary title="View saved receipts" onPress={() => setEditing(false)} />
          ) : null}
        </View>
      </Screen>
    );
  // Suggestions are the investable stock universe, so every row carries the
  // ticker its brand logo resolves through.
  const suggestions =
    searchingMerchant && merchant.trim().length > 0
      ? (markets.data?.items ?? [])
          .filter(
            (stock) =>
              (stock.name.toLocaleLowerCase().includes(merchant.trim().toLocaleLowerCase()) ||
                stock.symbol.toLocaleLowerCase().includes(merchant.trim().toLocaleLowerCase())) &&
              stock.name.toLocaleLowerCase() !== merchant.trim().toLocaleLowerCase(),
          )
          .slice(0, 6)
      : [];
  if (editing && !hasPhoto)
    return (
      <Screen title="Manual mode" fillContent compact>
        <Stack.Screen options={{ sheetAllowedDetents: [0.42, 0.65] }} />
        {message ? <Type accessibilityRole="alert">{message}</Type> : null}
        <View style={{ flexGrow: 1, justifyContent: 'flex-end', gap: 12, paddingTop: 16 }}>
          <ManualGuideVideo />
          <Button
            appearance="onboarding"
            title="Take a photo"
            disabled={busy}
            onPress={() => void run(() => capture(true))}
          />
          <Button
            secondary
            title="Choose from gallery"
            disabled={busy}
            onPress={() => void run(() => capture(false))}
          />
          {gallery.length ? (
            <Button secondary title="View saved receipts" onPress={() => setEditing(false)} />
          ) : null}
        </View>
      </Screen>
    );
  return (
    <Screen title="Manual mode" keyboard fillContent={!editing && gallery.length === 0}>
      {/* The review form is taller than any partial detent leaves visible; open it full height. */}
      <Stack.Screen options={{ sheetAllowedDetents: editing && hasPhoto ? [1] : [0.92, 1] }} />
      {message && !editing ? <Type accessibilityRole="alert">{message}</Type> : null}
      {editing ? (
        <View style={{ gap: 20 }}>
          <Type variant="headline">Review your purchase</Type>
          {photo ? (
            <Image
              source={{ uri: photo }}
              accessibilityLabel="Receipt to review"
              resizeMode="contain"
              style={{ width: '100%', height: 180 }}
            />
          ) : hasPhoto && draft ? (
            <ReceiptPhoto id={draft} />
          ) : null}
          {hasPhoto && receipts.data?.photosEnabled && receipts.data?.scanEnabled ? (
            <Button
              title="AutoDetect"
              disabled={busy}
              onPress={() => void run(async () => scan(await saveDraft()))}
            />
          ) : null}
          {busy && hasPhoto && !merchant ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <OnboardingAnimation name="receipt-scanner" height={140} loop />
              <Type muted>Reading the receipt…</Type>
            </View>
          ) : null}
          {hasPhoto ? (
            <>
              {(
                [
                  ['Merchant', merchant],
                  ['Total', amount],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={{ gap: 2 }}>
                  {label === 'Merchant' ? (
                    <Type variant="caption" muted>
                      {label}
                    </Type>
                  ) : null}
                  <TextInput
                    accessibilityLabel={label}
                    value={value}
                    onChangeText={
                      label === 'Merchant'
                        ? (text) => {
                            setMerchant(text);
                            // Editing by hand drops the ticker picked from the suggestions.
                            setSelectedSymbol(null);
                            setSearchingMerchant(true);
                          }
                        : (text) => {
                            setAmount(text);
                            setUsdCents(null);
                          }
                    }
                    placeholder={label === 'Total' ? '0.00' : 'Search merchants'}
                    placeholderTextColor={colors.muted}
                    keyboardType={label === 'Total' ? 'decimal-pad' : 'default'}
                    editable={!busy}
                    style={{
                      color: colors.ink,
                      borderColor: colors.line,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 16,
                    }}
                  />
                  {label === 'Merchant'
                    ? suggestions.map((stock) => (
                        <Pressable
                          key={stock.symbol}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${stock.name} (${stock.symbol})`}
                          onPress={() => {
                            setMerchant(stock.name);
                            setSelectedSymbol(stock.symbol);
                            setSearchingMerchant(false);
                          }}
                          style={{
                            minHeight: 52,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            borderBottomWidth: 1,
                            borderColor: colors.line,
                          }}
                        >
                          <CompanyMark symbol={stock.symbol} size={40} />
                          <Type numberOfLines={1} style={{ flex: 1 }}>
                            {stock.name}
                          </Type>
                          <Type variant="caption" muted>
                            {stock.symbol}
                          </Type>
                        </Pressable>
                      ))
                    : null}
                </View>
              ))}
              <ReceiptDatePicker value={date} onChange={setDate} />
              <View style={{ gap: 8 }}>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Receipt currency"
                  style={styles.currencyGrid}
                >
                  {RECEIPT_CURRENCIES.map((code) => {
                    const selected = currency === code;
                    return (
                      <Pressable
                        key={code}
                        accessibilityRole="radio"
                        accessibilityLabel={code}
                        accessibilityState={{ selected }}
                        disabled={busy}
                        onPress={() => {
                          if (selected) return;
                          void Haptics.selectionAsync().catch(() => {});
                          setCurrency(code);
                          // The scanned USD conversion no longer applies once the
                          // currency is picked by hand.
                          setUsdCents(null);
                        }}
                        style={({ pressed }) => [
                          styles.currencyCard,
                          {
                            borderColor: selected ? colors.ink : colors.line,
                            backgroundColor: selected ? colors.ink : colors.surface,
                            opacity: pressed ? 0.72 : 1,
                          },
                        ]}
                      >
                        <Image
                          accessible={false}
                          accessibilityElementsHidden
                          source={currencyCardArt}
                          resizeMode="contain"
                          style={[styles.currencyCardArt, { opacity: isDark ? 0.3 : 0.2 }]}
                        />
                        <Type
                          style={{
                            color: selected ? colors.background : colors.ink,
                            fontWeight: '600',
                            fontSize: 15,
                          }}
                        >
                          {code}
                        </Type>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {usdCents != null ? (
                <Type variant="caption" muted>
                  Converted to USD {(usdCents / 100).toFixed(2)} at today’s rate.
                </Type>
              ) : null}
              {effectiveCents > 0 ? (
                <View
                  style={[
                    styles.roundupCard,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <View style={{ flexShrink: 1, gap: 2 }}>
                    <Type variant="headline">Roundup</Type>
                    <Type variant="caption" muted>
                      {percentage ? `${percentage}% of this purchase` : 'To the next whole dollar'}
                    </Type>
                  </View>
                  <Type variant="title" style={styles.roundupValue}>
                    {money(roundup, usdCents != null ? 'USD' : displayCurrency)}
                  </Type>
                </View>
              ) : null}
              {message ? <Type accessibilityRole="alert">{message}</Type> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="Retake photo"
                    disabled={busy}
                    onPress={() => void run(() => capture(true))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="Camera roll"
                    disabled={busy}
                    onPress={() => void run(() => capture(false))}
                  />
                </View>
              </View>
              <Type variant="caption" muted>
                {receipts.data?.photosEnabled === false
                  ? 'Photo storage is unavailable. Confirming saves the purchase details only; the photo stays on this screen until you close it.'
                  : 'Confirming saves the receipt to your Beaver account and submits the purchase.'}
              </Type>
              {message.includes('Add enough USDC') ? (
                <Button
                  appearance="onboarding"
                  title="Add balance"
                  onPress={() => router.push('/funding')}
                />
              ) : null}
              <Button
                title="Confirm purchase"
                appearance="onboarding"
                loading={busy}
                disabled={
                  !validAmount ||
                  cents <= 0 ||
                  !validDate ||
                  !merchant.trim() ||
                  policy.isPending ||
                  !!policy.error
                }
                onPress={() => void run(submit)}
              />
            </>
          ) : null}
        </View>
      ) : (
        <View
          style={{
            flexGrow: gallery.length === 0 ? 1 : 0,
            justifyContent: 'flex-end',
            gap: 20,
            paddingTop: 32,
          }}
        >
          <ManualGuideVideo />
          <Button appearance="onboarding" title="Add a purchase manually" onPress={start} />
        </View>
      )}
      {receipts.isPending ? <Type muted>Loading receipts…</Type> : null}
      {receipts.error ? <Type accessibilityRole="alert">{receipts.error.message}</Type> : null}
      {gallery.map((receipt) => {
        const merchantName = receipt.merchant ?? 'Receipt ready to review';
        const currencyCode = receipt.currency ?? 'USD';
        const amountLabel =
          receipt.amountCents == null ? 'Draft receipt' : money(receipt.amountCents, currencyCode);
        const statusLabel = receipt.transactionId
          ? roundupStateLabel(receipt.status)
          : 'Review receipt';
        const roundupLabel =
          receipt.status === 'preview'
            ? 'Preview'
            : receipt.status === 'redeemed' && receipt.roundupCents != null
              ? `+${money(receipt.roundupCents, currencyCode)}`
              : receipt.roundupCents != null
                ? money(receipt.roundupCents, currencyCode)
                : '—';
        const row = (
          <>
            <MerchantIcon merchant={merchantName} symbol={receipt.symbol} />
            <View style={{ flex: 1, gap: 4 }}>
              <Type style={{ fontWeight: '600' }}>{merchantName}</Type>
              <Type variant="caption" muted>
                {amountLabel} · {statusLabel}
              </Type>
              {receipt.status === 'preview' ? (
                <Type variant="caption" muted>
                  No money was invested.
                </Type>
              ) : null}
            </View>
            <Type style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{roundupLabel}</Type>
          </>
        );
        const rowStyle = {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: 14,
          minHeight: 72,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: colors.line,
        };
        return receipt.transactionId ? (
          <View key={receipt.id} style={rowStyle}>
            {row}
          </View>
        ) : (
          <Pressable
            key={receipt.id}
            accessibilityRole="button"
            accessibilityLabel={`Review ${merchantName} receipt`}
            disabled={busy}
            onPress={() => {
              start();
              setDraft(receipt.id);
              setHasPhoto(receipt.hasPhoto);
              setMerchant(receipt.merchant ?? '');
              setAmount(receipt.amountCents == null ? '' : (receipt.amountCents / 100).toFixed(2));
              setCurrency(receiptCurrency(currencyCode));
            }}
            style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.6 : 1 }]}
          >
            {row}
          </Pressable>
        );
      })}
      {nextCursor ? (
        <Button
          secondary
          title="Load older receipts"
          loading={busy}
          onPress={() => void run(loadOlder)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Six currencies in two wrapped rows of three; flexGrow keeps the cards evenly wide.
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyCard: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  currencyCardArt: {
    position: 'absolute',
    right: -14,
    top: -10,
    width: 56,
    height: 56,
  },
  roundupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: 20,
  },
  roundupValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  // White raised chip echoing the onboarding button surface; constant in both themes.
  stockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingVertical: 10,
    boxShadow: '0 8px 20px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.08)',
  },
  stockChipLabel: { color: '#1B1B1B', fontSize: 17, lineHeight: 22, fontWeight: '600' },
});
