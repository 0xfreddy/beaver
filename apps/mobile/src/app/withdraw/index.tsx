import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountGate } from '../../components/account-gate';
import { AppSymbol } from '../../components/app-symbol';
import { AssetMark } from '../../components/asset-mark';
import { CompanyMark } from '../../components/company-mark';
import { SlideToConfirm } from '../../components/slide-to-confirm';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { Button, Card, Screen, TextButton, Type } from '../../components/ui';
import { NumberFlow } from '../../components/reacticx/number-flow';
import { SpinButton } from '../../components/reacticx/spin-button';
import { useAuth } from '../../providers/auth-provider';
import { ApiError, apiRequest } from '../../lib/api';
import { authenticateWithBiometrics } from '../../lib/biometric-auth';
import { loadCanonicalMockData } from '../../lib/mock-data';
import { useLive, dollars } from '../../lib/live';
import type { Balances, Capabilities, Holdings } from '../../lib/live';
import { posthog } from '../../lib/telemetry';
import { useTheme } from '../../theme';

type Step = 'form' | 'wallet' | 'done';

// The counter card keeps a constant white face and black digits in both themes,
// like the raised onboarding button.
const COUNTER_CARD = '#FFFFFF';
const COUNTER_INK = '#111111';

interface WithdrawalReceipt {
  id: string;
  status: string;
  network: 'solana';
  destination?: string;
  /** Null until the payout executes; the estimate covers the gap. */
  totalUsdcRaw: string | null;
  asOf: string;
}

export default function Withdraw() {
  return (
    <AccountGate>
      <WithdrawAccount />
    </AccountGate>
  );
}

function WithdrawAccount() {
  const auth = useAuth();
  const cache = useQueryClient();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const balances = useLive<Balances>('/v1/trading/balances');
  const holdings = useLive<Holdings>('/v1/portfolio');
  const capability = useLive<Capabilities>('/v1/capabilities');
  const [step, setStep] = useState<Step>('form');
  const [amountCents, setAmountCents] = useState(0);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sliderReset, setSliderReset] = useState(0);
  const intent = useRef<{
    key: string;
    destination: string;
    cashRaw: string | null;
    assets: { symbol: string; rawAmount: string }[];
  } | null>(null);

  const stockRows = useMemo(() => holdings.data?.items ?? [], [holdings.data?.items]);
  // Mirrors the portfolio screen: stock sales need execution to be enabled.
  const tradingBlocked = !capability.data?.executionEnabled || capability.isError;
  const availableUsdcRaw = balances.data?.availableUsdcRaw ?? '0';
  const availableRaw = rawAmount(availableUsdcRaw);
  // The stepper moves whole cents, so sub-cent dust in the wallet is ignored.
  const availableCents = Number(availableRaw / 10_000n);
  const cashAvailable = availableRaw > 0n;
  const eligibleSymbols = useMemo(
    () =>
      stockRows
        .filter(
          (item) =>
            item.valueUsdCents !== null &&
            rawAmount(item.sellableRawAmount) > 0n &&
            !tradingBlocked,
        )
        .map((item) => item.symbol),
    [stockRows, tradingBlocked],
  );
  // Cash participates in the payout the moment any of it is selected.
  const cashSelected = amountCents > 0;
  const selectionCount = (cashSelected ? 1 : 0) + selectedSymbols.length;

  const selectedStocks = useMemo(
    () => stockRows.filter((item) => selectedSymbols.includes(item.symbol)),
    [selectedSymbols, stockRows],
  );
  const selectedStocksCents = selectedStocks.reduce(
    (total, item) => total + rawAmount(item.valueUsdCents),
    0n,
  );
  const payoutCents = BigInt(amountCents) + selectedStocksCents;
  const selectedTotal = dollars((payoutCents * 10_000n).toString(), 6);
  const hasSelectedStocks = selectedStocks.length > 0;
  const maxedOut =
    amountCents >= availableCents && selectedSymbols.length === eligibleSymbols.length;

  const withdraw = useMutation({
    mutationFn: async (): Promise<WithdrawalReceipt> => {
      await authenticateWithBiometrics('Approve withdrawal');
      // The whole request is frozen on the first attempt so a retry replays it
      // exactly; editing the selection mints a fresh intent and key instead.
      if (!intent.current)
        intent.current = {
          key: randomUUID(),
          destination: address.trim(),
          cashRaw: amountCents > 0 ? (BigInt(amountCents) * 10_000n).toString() : null,
          assets: selectedStocks.map((item) => ({
            symbol: item.symbol,
            rawAmount: item.sellableRawAmount,
          })),
        };
      const request = intent.current;
      return apiRequest<WithdrawalReceipt>(auth.getAccessToken, '/v1/withdrawals', {
        method: 'POST',
        headers: { 'Idempotency-Key': request.key },
        body: JSON.stringify({
          network: 'solana',
          destination: request.destination,
          cashRaw: request.cashRaw,
          assets: request.assets,
        }),
      });
    },
    onSuccess: async () => {
      intent.current = null;
      posthog?.capture('withdrawal_succeeded', { assets: selectionCount });
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      setStep('done');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onError: (cause) => {
      posthog?.capture('withdrawal_failed');
      setError(withdrawalErrorMessage(cause));
      setSliderReset((value) => value + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    },
  });

  usePreventRemove(withdraw.isPending, () => {
    setError('Please wait while your withdrawal request is submitted.');
  });

  function stepAmount(delta: number) {
    if (withdraw.isPending) return;
    void Haptics.selectionAsync().catch(() => {});
    setAmountCents((current) => clampCents(current + delta, availableCents));
    setError(null);
  }

  function setMaxAmount() {
    if (withdraw.isPending || maxedOut) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (availableCents > 0) setAmountCents(availableCents);
    if (eligibleSymbols.length > 0) setSelectedSymbols(eligibleSymbols);
    setError(null);
  }

  function toggleCash() {
    if (withdraw.isPending || !cashAvailable) return;
    void Haptics.selectionAsync().catch(() => {});
    setAmountCents((current) => (current > 0 ? 0 : availableCents));
    setError(null);
  }

  function toggleSymbol(symbol: string) {
    if (withdraw.isPending) return;
    void Haptics.selectionAsync().catch(() => {});
    setSelectedSymbols((current) =>
      current.includes(symbol) ? current.filter((entry) => entry !== symbol) : [...current, symbol],
    );
    setError(null);
  }

  function toggleAllStocks() {
    if (withdraw.isPending) return;
    void Haptics.selectionAsync().catch(() => {});
    setSelectedSymbols((current) =>
      current.length === eligibleSymbols.length ? [] : eligibleSymbols,
    );
    setError(null);
  }

  function continueToWallet() {
    if (selectionCount === 0) {
      setError('Choose what to withdraw.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    setError(null);
    posthog?.capture('withdrawal_reviewed', { assets: selectionCount });
    setStep('wallet');
  }

  function confirmWithdrawal() {
    if (withdraw.isPending) return;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim())) {
      setError('Enter a valid Solana wallet address.');
      setSliderReset((value) => value + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    setError(null);
    posthog?.capture('withdrawal_confirmed', { assets: selectionCount });
    withdraw.mutate();
  }

  // TEMP-DEMO-VERIFY: deep-link ?demo=amount / ?demo=review drives the flow for
  // headless simulator screenshots. Removed after verification.
  const params = useLocalSearchParams<{ demo?: string }>();
  const demoDone = useRef<string | null>(null);
  const [demoPending, setDemoPending] = useState(false);
  useEffect(() => {
    if (!params.demo || demoDone.current === params.demo) return;
    if (params.demo === 'reset') {
      demoDone.current = params.demo;
      void (async () => {
        if (auth.user) await loadCanonicalMockData(auth.user.id).catch(() => {});
        await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      })();
      return;
    }
    if (!balances.isSuccess) return;
    demoDone.current = params.demo;
    setDemoPending(false);
    if (params.demo === 'amount') {
      setAmountCents((current) => (current > 0 ? current : Math.min(4200, availableCents)));
    } else if (params.demo === 'stocks') {
      setAmountCents((current) => (current > 0 ? current : Math.min(4200, availableCents)));
      setSelectedSymbols(eligibleSymbols);
    } else if (params.demo === 'review') {
      setAmountCents((current) => (current > 0 ? current : Math.min(4200, availableCents)));
      setSelectedSymbols(eligibleSymbols);
      setAddress('BeaverDemoWithdrawDestinationAddr123456789');
      // continueToWallet() reads render-time state; jump straight to the step instead.
      setTimeout(() => setStep('wallet'), 600);
    } else if (params.demo === 'sending') {
      setAmountCents((current) => (current > 0 ? current : Math.min(4200, availableCents)));
      setSelectedSymbols(eligibleSymbols);
      setAddress('BeaverDemoWithdrawDestinationAddr123456789');
      setStep('wallet');
      setTimeout(() => setDemoPending(true), 700);
    } else if (params.demo === 'done') {
      setAmountCents((current) => (current > 0 ? current : Math.min(4200, availableCents)));
      setSelectedSymbols(eligibleSymbols);
      setAddress('BeaverDemoWithdrawDestinationAddr123456789');
      setStep('done');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.demo, balances.isSuccess, availableCents, eligibleSymbols]);

  const loading = balances.isLoading || holdings.isLoading;
  // Only a confirmed all-zero account may collapse the flow into the empty state;
  // missing or malformed fields must fall through to the full form instead.
  const emptyBalance =
    balances.isSuccess &&
    holdings.isSuccess &&
    availableRaw === 0n &&
    (holdings.data?.items ?? []).every((item) => rawAmount(item.sellableRawAmount) === 0n);
  if (step === 'form' && emptyBalance)
    return (
      <Screen title="Withdraw">
        <OnboardingAnimation name="empty-balance" height={240} loop />
        <Type variant="display" style={{ textAlign: 'center' }}>
          $0.00
        </Type>
        <Type variant="headline" style={{ textAlign: 'center' }}>
          Nothing to withdraw yet
        </Type>
        <Type muted style={{ textAlign: 'center' }}>
          Your account is empty. Add funds to get started.
        </Type>
        <Button appearance="raised" title="Add funds" onPress={() => router.replace('/funding')} />
        <TextButton title="Done" onPress={() => router.back()} />
      </Screen>
    );

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: !withdraw.isPending,
          sheetAllowedDetents: step === 'done' ? [0.62, 0.85] : [0.94, 1],
        }}
      />
      {/* formSheets lay out one ScrollView only — extra wrappers or pinned overlays
          beside it break the native sheet layout (blank body). The action bar
          therefore scrolls as the sheet's last block. */}
      <Screen compact keyboard title="Withdraw">
        {step === 'form' ? (
          <View style={styles.formStep}>
            <Card style={styles.amountCard}>
              <View
                accessibilityLabel={`Withdrawal total ${moneyLabel(Number(payoutCents))}`}
                style={styles.amountRow}
              >
                <StepButton
                  label="Decrease cash amount by one dollar"
                  icon="minus"
                  disabled={amountCents <= 0 || withdraw.isPending || !cashAvailable}
                  onPress={() => stepAmount(-100)}
                />
                <View style={styles.amountValue}>
                  <Type style={styles.amountPrefix}>$</Type>
                  <NumberFlow
                    value={Number(payoutCents) / 100}
                    decimals={2}
                    groupSeparator=","
                    fontSize={44}
                    color={COUNTER_INK}
                    fontWeight="600"
                  />
                </View>
                <StepButton
                  label="Increase cash amount by one dollar"
                  icon="plus"
                  disabled={amountCents >= availableCents || withdraw.isPending || !cashAvailable}
                  onPress={() => stepAmount(100)}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Withdraw the maximum amount"
                accessibilityState={{ disabled: maxedOut || withdraw.isPending }}
                disabled={maxedOut || withdraw.isPending}
                onPress={setMaxAmount}
                style={({ pressed }) => [
                  styles.maxButton,
                  { backgroundColor: COUNTER_INK },
                  pressed && { opacity: 0.82 },
                  maxedOut && { opacity: 0.4 },
                ]}
              >
                <Type style={styles.maxLabel}>Max</Type>
              </Pressable>
            </Card>

            {loading ? (
              <View accessibilityLabel="Loading balance" style={styles.loadingRows}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : (
              <>
                <AssetRow
                  mark={<AssetMark asset="USDC" size={42} />}
                  title="Cash"
                  subtitle="USDC"
                  value={moneyLabel(availableCents)}
                  selected={cashSelected}
                  disabled={!cashAvailable || withdraw.isPending}
                  onToggle={toggleCash}
                />
                {stockRows.length > 0 ? (
                  <>
                    <View style={[styles.listHeader, fontScale > 1.3 && styles.listHeaderStacked]}>
                      <Type variant="headline" accessibilityRole="header">
                        Sell stocks with it
                      </Type>
                      <TextButton
                        title={
                          selectedSymbols.length === eligibleSymbols.length &&
                          eligibleSymbols.length > 0
                            ? 'Deselect all'
                            : 'Select all'
                        }
                        align="leading"
                        disabled={eligibleSymbols.length === 0 || withdraw.isPending}
                        onPress={toggleAllStocks}
                      />
                    </View>
                    {stockRows.map((item) => {
                      const unavailable = item.valueUsdCents === null;
                      const blocked =
                        unavailable || rawAmount(item.sellableRawAmount) === 0n || tradingBlocked;
                      return (
                        <AssetRow
                          key={item.symbol}
                          mark={<CompanyMark symbol={item.symbol} size={42} />}
                          title={item.name}
                          subtitle={
                            unavailable
                              ? 'Price unavailable'
                              : blocked
                                ? 'Trading unavailable'
                                : formatShares(item.rawAmount, item.decimals ?? 6)
                          }
                          value={
                            item.valueUsdCents === null ? '—' : amountDollars(item.valueUsdCents, 2)
                          }
                          selected={selectedSymbols.includes(item.symbol)}
                          disabled={blocked || withdraw.isPending}
                          onToggle={() => toggleSymbol(item.symbol)}
                        />
                      );
                    })}
                    <Type variant="caption" muted>
                      Selected stocks are sold to USDC when the request executes, so their value can
                      shift with market prices.
                    </Type>
                  </>
                ) : null}
              </>
            )}
          </View>
        ) : step === 'wallet' ? (
          <View style={styles.formStep}>
            <Card>
              <Type variant="headline">Sending to your wallet</Type>
              {amountCents > 0 ? (
                <ReviewRow
                  mark={<AssetMark asset="USDC" size={34} />}
                  label="USDC cash"
                  value={moneyLabel(amountCents)}
                />
              ) : null}
              {selectedStocks.map((item) => (
                <ReviewRow
                  key={item.symbol}
                  mark={<CompanyMark symbol={item.symbol} size={34} />}
                  label={item.name}
                  value={`≈ ${item.valueUsdCents === null ? '—' : amountDollars(item.valueUsdCents, 2)}`}
                />
              ))}
              <View style={[styles.totalRow, { borderTopColor: colors.line }]}>
                <Type variant="headline">You’ll receive</Type>
                <View style={styles.totalValue}>
                  <Type variant="numeric">{selectedTotal}</Type>
                  <AssetMark asset="USDC" size={20} />
                </View>
              </View>
              {hasSelectedStocks ? (
                <Type variant="caption" muted>
                  Stock amounts are estimates at current prices.
                </Type>
              ) : null}
            </Card>
            <View style={styles.field}>
              <Type variant="caption" muted>
                Solana address
              </Type>
              <TextInput
                accessibilityLabel="Destination Solana wallet address"
                autoCapitalize="none"
                autoCorrect={false}
                value={address}
                onChangeText={(value) => {
                  setAddress(value.trim());
                  setError(null);
                }}
                placeholder="Destination wallet"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  styles.addressInput,
                  {
                    color: colors.ink,
                    borderColor: colors.line,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
            </View>
          </View>
        ) : (
          <Card>
            <View style={styles.securityRow}>
              <View style={[styles.successMark, { backgroundColor: colors.ink }]}>
                <AppSymbol name="check" color={colors.background} size={22} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Type variant="headline">Withdrawal requested</Type>
                <Type muted>
                  {amountDollars(
                    withdraw.data?.totalUsdcRaw ?? (payoutCents * 10_000n).toString(),
                    6,
                  )}{' '}
                  USDC is on its way to {shortAddress(address.trim())} on Solana. Stock sales finish
                  before the transfer is sent.
                </Type>
                {withdraw.data ? (
                  <Type variant="caption" muted>
                    Reference {withdraw.data.id}
                  </Type>
                ) : null}
              </View>
            </View>
          </Card>
        )}
        {balances.error ? (
          <Type accessibilityRole="alert">{balances.error.message}</Type>
        ) : holdings.error ? (
          <Type accessibilityRole="alert">{holdings.error.message}</Type>
        ) : capability.error ? (
          <Type accessibilityRole="alert">{capability.error.message}</Type>
        ) : error ? (
          <Type accessibilityRole="alert">{error}</Type>
        ) : null}
        <View
          style={[
            styles.actionBar,
            { borderColor: colors.line, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {step === 'form' ? (
            <Button title="Continue" disabled={withdraw.isPending} onPress={continueToWallet} />
          ) : step === 'wallet' ? (
            withdraw.isPending || demoPending ? (
              // The slide committed; the spin button carries the send-out state
              // until the conversion and transfer finish.
              <SpinButton
                controlled
                isActive
                idleText="Send withdrawal"
                activeText="Sending"
                colors={{
                  idle: { background: colors.accent, text: colors.accentInk },
                  active: { background: colors.accent, text: colors.accentInk },
                }}
                spinnerConfig={{
                  color: colors.accentInk,
                  containerBackground: colors.accent,
                  position: { right: 14, bottom: 10 },
                }}
                buttonStyle={{
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: '500',
                }}
              />
            ) : (
              <>
                <TextButton
                  title="Edit withdrawal"
                  disabled={withdraw.isPending}
                  onPress={() => {
                    if (withdraw.isPending) return;
                    // A retry must not mix a stale intent with edited inputs.
                    intent.current = null;
                    setDemoPending(false);
                    setStep('form');
                  }}
                />
                <SlideToConfirm
                  label="Slide to withdraw"
                  hint="Submits the withdrawal to your Solana wallet"
                  busy={withdraw.isPending}
                  resetSignal={sliderReset}
                  onConfirm={confirmWithdrawal}
                />
              </>
            )
          ) : (
            <Button title="Done" onPress={() => router.back()} />
          )}
        </View>
      </Screen>
    </>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: colors.soft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <AppSymbol name={icon} color={colors.ink} size={20} />
    </Pressable>
  );
}

function AssetRow({
  mark,
  title,
  subtitle,
  value,
  selected,
  disabled,
  onToggle,
}: {
  mark: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Withdraw ${title}, ${subtitle}, ${value}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.assetRow,
        { borderBottomColor: colors.line },
        pressed && { backgroundColor: colors.soft },
        disabled && styles.assetRowDisabled,
      ]}
    >
      {mark}
      <View style={styles.assetIdentity}>
        <Type style={styles.assetTitle}>{title}</Type>
        <Type variant="caption" muted>
          {subtitle}
        </Type>
      </View>
      <View style={styles.assetTrailing}>
        <Type style={styles.assetValue}>{value}</Type>
        <Check selected={selected} />
      </View>
    </Pressable>
  );
}

function Check({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.check,
        {
          borderColor: selected ? colors.ink : colors.line,
          backgroundColor: selected ? colors.ink : 'transparent',
        },
      ]}
    >
      {selected ? <AppSymbol name="check" color={colors.background} size={14} /> : null}
    </View>
  );
}

function ReviewRow({
  mark,
  label,
  value,
}: {
  mark: React.ReactNode;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.reviewRow, { borderBottomColor: colors.line }]}>
      {mark}
      <Type muted style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Type>
      <Type style={styles.reviewValue}>{value}</Type>
    </View>
  );
}

function withdrawalErrorMessage(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 404)
    return 'Withdrawals aren’t enabled on this service yet. The backend needs a withdrawal endpoint before funds can move.';
  if (cause instanceof Error && cause.message) return cause.message;
  return 'The withdrawal could not be submitted. Please try again.';
}

function clampCents(value: number, max: number) {
  return Math.max(0, Math.min(Math.round(value), Math.max(0, max)));
}

function moneyLabel(cents: number) {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

// The live API can drift from the shapes the sample fixtures guarantee; a missing
// or malformed raw amount must degrade to zero instead of crashing the whole
// sheet (which blanks the wallet input and the confirmation slider).
function rawAmount(value: string | null | undefined): bigint {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function amountDollars(value: string | null | undefined, decimals = 6) {
  return dollars(rawAmount(value).toString(), decimals);
}

function formatShares(raw: string, decimals: number) {
  const value = Number(rawAmount(raw)) / 10 ** decimals;
  const fixed =
    decimals > 0
      ? value
          .toFixed(Math.min(6, decimals))
          .replace(/(\.\d*?)0+$/, '$1')
          .replace(/\.$/, '')
      : String(value);
  const quantity = fixed === '' ? '0' : fixed;
  return `${quantity} ${value === 1 ? 'share' : 'shares'}`;
}

function shortAddress(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

const styles = StyleSheet.create({
  formStep: { gap: 14 },
  amountCard: { backgroundColor: COUNTER_CARD, borderColor: 'transparent', gap: 12 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    minHeight: 92,
  },
  amountValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  amountPrefix: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '600',
    marginBottom: 4,
    color: COUNTER_INK,
  },
  maxButton: {
    alignSelf: 'center',
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 22,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxLabel: { color: COUNTER_CARD, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  stepButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
  },
  listHeaderStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  assetRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  assetRowDisabled: { opacity: 0.55 },
  assetIdentity: { flex: 1, gap: 1 },
  assetTitle: { fontWeight: '600' },
  assetTrailing: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assetValue: { fontVariant: ['tabular-nums'], fontWeight: '600' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRows: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  field: { gap: 7 },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    fontSize: 15,
  },
  addressInput: { fontVariant: ['tabular-nums'] },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  reviewRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewValue: { fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  totalRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  totalValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 14,
    marginTop: 4,
  },
});
