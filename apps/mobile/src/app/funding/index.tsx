import { ApplePayMark } from '../../components/apple-pay-mark';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import QRCodeStyled from 'react-native-qrcode-styled';
import { Button, Screen, Type } from '../../components/ui';
import { AccountGate } from '../../components/account-gate';
import { AppSymbol } from '../../components/app-symbol';
import { depositBalanceRaw, formatDepositAmount } from '../../lib/deposit-options';
import type { DepositAsset, DepositInstruction, DepositOption } from '../../lib/deposit-options';
import { useLive } from '../../lib/live';
import type { Balances } from '../../lib/live';
import { useAuth } from '../../providers/auth-provider';
import { useTheme } from '../../theme';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { AssetMark } from '../../components/asset-mark';
import { useMockData } from '../../providers/mock-data-provider';
import { posthog } from '../../lib/telemetry';

const chainStyle: Record<string, { seconds: number }> = {
  Solana: { seconds: 30 },
  'Solana Devnet': { seconds: 30 },
};
const confettiPieces = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: (index * 37) % 100,
  delay: (index % 7) * 45,
  drift: ((index * 29) % 70) - 35,
  rotation: 180 + ((index * 53) % 260),
  height: 7 + (index % 3) * 3,
}));

export default function Funding() {
  return (
    <AccountGate>
      <FundingAccount />
    </AccountGate>
  );
}

function FundingAccount() {
  const auth = useAuth();
  const mockData = useMockData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const balances = useLive<Balances>('/v1/trading/balances');
  const receipts = useLive<{
    items: {
      id?: string;
      signature?: string;
      network?: string;
      asset?: 'USDC';
      amountRaw: string;
      status?: string;
      createdAt?: string;
      recordedAt?: string;
    }[];
  }>('/v1/funding/receipts', true, false);
  const [selected, setSelected] = useState<DepositOption | null>(null);
  const [instruction, setInstruction] = useState<DepositInstruction | null>(null);
  const [copied, setCopied] = useState(false);
  const initialBalance = useRef<bigint | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networks = useQuery({
    queryKey: ['deposit-options', auth.user?.id],
    enabled: mockData.active || !!auth.user?.walletAddress,
    queryFn: () => auth.listDepositOptions(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const createDeposit = useMutation({
    mutationFn: async (network: DepositOption) => {
      const current = balances.data ?? (await balances.refetch()).data;
      initialBalance.current = current ? depositBalanceRaw(current, network.asset) : null;
      return auth.createDeposit(network);
    },
    onMutate: (network) => {
      setSelected(network);
      setInstruction(null);
      setCopied(false);
      initialBalance.current = null;
    },
    onSuccess: (nextInstruction, network) => {
      setInstruction(nextInstruction);
      posthog?.capture('deposit_instruction_created', {
        asset: network.asset,
        network: network.name,
        direct: true,
      });
    },
  });
  const cardPurchase = useMutation({
    mutationFn: (asset: DepositAsset) => auth.startCardOnramp(asset),
    onSuccess: (outcome, asset) => {
      if (outcome !== 'completed') return;
      posthog?.capture('card_onramp_completed', { asset, sandbox: auth.cardOnramp.sandbox });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void balances.refetch();
    },
  });
  const receivedRaw = useMemo(
    () =>
      instruction !== null && initialBalance.current !== null && balances.data !== undefined
        ? depositBalanceRaw(balances.data, selected?.asset ?? 'USDC') - initialBalance.current
        : 0n,
    [balances.data, instruction, selected?.asset],
  );
  const received = receivedRaw > 0n;
  const solanaOptions = useMemo(
    () =>
      (networks.data ?? []).filter(
        (option) => option.name === 'Solana' || option.name === 'Solana Devnet',
      ),
    [networks.data],
  );

  useEffect(() => {
    if (!instruction || received) return;
    const timer = setInterval(() => void balances.refetch(), 4_000);
    return () => clearInterval(timer);
  }, [balances, instruction, received]);
  useEffect(() => {
    if (!received) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [received]);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  async function copyDepositAddress(address: string) {
    await Clipboard.setStringAsync(address);
    posthog?.capture('deposit_address_copied', {
      asset: selected?.asset ?? null,
      network: selected?.name ?? null,
    });
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function buyWithCard() {
    posthog?.capture('card_onramp_started', { asset: 'USDC', sandbox: auth.cardOnramp.sandbox });
    cardPurchase.mutate('USDC');
  }

  if (!selected)
    return (
      <>
        <Stack.Screen
          options={{
            sheetAllowedDetents: [0.58, 0.82],
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Screen compact title="Feed Beaver" backgroundColor={colors.surface} topPadding={22}>
          <DepositTrayBalance balances={balances.data} backgroundColor={colors.surface} />
          {networks.isLoading ? (
            <View accessibilityLabel="Loading deposit assets" style={styles.loading}>
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : (
            <>
              <View style={styles.fundingChoices}>
                {auth.cardOnramp.available ? (
                  <CardOnrampRow
                    pending={cardPurchase.isPending}
                    sandbox={auth.cardOnramp.sandbox}
                    onPress={buyWithCard}
                  />
                ) : null}
                <DepositAssetChoices
                  networks={solanaOptions}
                  onSelect={(asset) => {
                    const option = solanaOptions.find((candidate) => candidate.asset === asset);
                    if (option) createDeposit.mutate(option);
                  }}
                />
              </View>
              {cardPurchase.error ? (
                <View style={[styles.notice, { borderColor: colors.line }]}>
                  <Type accessibilityRole="alert" variant="headline">
                    Couldn’t open the card purchase
                  </Type>
                  <Type muted>{cardPurchase.error.message}</Type>
                  <Button secondary title="Try again" onPress={buyWithCard} />
                </View>
              ) : null}
              {receipts.data?.items.length ? (
                <View style={styles.receipts}>
                  <Type variant="headline">Recent deposits</Type>
                  {receipts.data.items.map((receipt) => {
                    const when = new Date(receipt.createdAt ?? receipt.recordedAt ?? '');
                    const dateLabel = Number.isNaN(when.getTime())
                      ? ''
                      : when.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        });
                    const amountLabel = formatDepositAmount(receipt.amountRaw, receipt.asset ?? 'USDC', 6);
                    return (
                      <View
                        key={receipt.id ?? receipt.signature ?? amountLabel + dateLabel}
                        accessible
                        accessibilityLabel={`USDC deposit ${dateLabel}, ${amountLabel}`}
                        style={[styles.receipt, { borderBottomColor: colors.line }]}
                      >
                        <AssetMark asset={receipt.asset ?? 'USDC'} size={42} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Type>USDC deposit</Type>
                          <Type variant="caption" muted>
                            {dateLabel}
                          </Type>
                        </View>
                        <Type style={styles.tabular}>{amountLabel}</Type>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
          {networks.error ? (
            <View style={[styles.notice, { borderColor: colors.line }]}>
              <Type accessibilityRole="alert">Deposit assets aren’t available.</Type>
              <Button title="Try again" secondary onPress={() => void networks.refetch()} />
            </View>
          ) : null}
        </Screen>
      </>
    );

  const activeInstruction = instruction;
  return (
    <>
      <Stack.Screen options={{ sheetAllowedDetents: [1] }} />
      <DepositConfetti active={received} />
      <Screen
        compact
        title={`Deposit ${selected.asset}`}
        overlay={
          activeInstruction ? (
            <View
              style={[
                styles.bottomAction,
                {
                  paddingBottom: Math.max(insets.bottom, 16),
                  backgroundColor: colors.background,
                  borderColor: colors.line,
                },
              ]}
            >
              <Button
                appearance="onboarding"
                title={received ? 'Done' : copied ? 'Copied' : 'Copy address'}
                trailing={
                  received ? undefined : (
                    <AppSymbol name={copied ? 'check' : 'copy'} color="#1B1B1B" size={18} />
                  )
                }
                onPress={() =>
                  received ? router.back() : void copyDepositAddress(activeInstruction.address)
                }
              />
            </View>
          ) : undefined
        }
      >
        {createDeposit.isPending ? (
          <View style={styles.preparing}>
            <ActivityIndicator color={colors.ink} />
            <Type variant="headline">Preparing your {selected.asset} address…</Type>
          </View>
        ) : null}
        {createDeposit.error ? (
          <View style={[styles.notice, { borderColor: colors.line }]}>
            <Type accessibilityRole="alert" variant="headline">
              Couldn’t create this deposit
            </Type>
            <Type muted>{createDeposit.error.message}</Type>
            <Button title="Try again" onPress={() => createDeposit.mutate(selected)} />
          </View>
        ) : null}
        {activeInstruction ? (
          <>
            {received ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.success,
                  { backgroundColor: colors.surface, borderColor: colors.line },
                ]}
              >
                <View style={styles.growArtwork}>
                  <OnboardingAnimation name="funding-thumbs-up" height={92} loop={false} />
                </View>
                <View style={[styles.successMark, { backgroundColor: colors.ink }]}>
                  <AppSymbol name="check" color={colors.background} size={22} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Type variant="headline">Deposit received</Type>
                  <Type muted>
                    {formatDepositAmount(receivedRaw, selected.asset, selected.decimals)} is now in
                    your wallet.
                  </Type>
                </View>
              </View>
            ) : null}
            <View
              style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              <View
                accessible
                accessibilityRole="image"
                style={styles.qrSurface}
                accessibilityLabel={`${selected.name} deposit QR code`}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <QRCodeStyled
                    data={activeInstruction.address}
                    color="#111111"
                    style={{ backgroundColor: '#FFFFFF' }}
                    padding={18}
                    pieceSize={6}
                    pieceBorderRadius={1.5}
                    isPiecesGlued
                    errorCorrectionLevel="M"
                  />
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy deposit address"
                onPress={() => void copyDepositAddress(activeInstruction.address)}
                style={({ pressed }) => [styles.addressRow, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Type selectable muted style={styles.address}>
                  {shortAddress(activeInstruction.address)}
                </Type>
                <AppSymbol name="copy" color={colors.muted} size={18} />
              </Pressable>
            </View>
            <View style={styles.depositFacts}>
              <Type variant="headline">
                Send {selected.asset} on {selected.name}
              </Type>
              {selected.tokenAddress ? (
                <Type selectable variant="caption" muted style={styles.assetAddress}>
                  Mint {shortAddress(selected.tokenAddress)}
                </Type>
              ) : (
                <Type variant="caption" muted>
                  Native Solana asset
                </Type>
              )}
            </View>
            <View style={[styles.selectedNetwork, { backgroundColor: colors.surface }]}>
              <ChainMark />
              <View style={{ flex: 1, gap: 3 }}>
                <Type variant="headline">{selected.name}</Type>
                <Type variant="caption" muted>
                  {etaLabel(activeInstruction.estimatedSeconds || fallbackSeconds(selected.name))}
                </Type>
              </View>
              <Type muted>{selected.asset}</Type>
            </View>
            {balances.error ? (
              <Type accessibilityRole="alert" muted style={{ textAlign: 'center' }}>
                Balance detection is reconnecting. Your address remains valid.
              </Type>
            ) : null}
            <View style={{ height: 88 }} />
          </>
        ) : null}
      </Screen>
    </>
  );
}

function DepositTrayBalance({
  balances,
  backgroundColor,
}: {
  balances: Balances | undefined;
  backgroundColor: string;
}) {
  return (
    <View style={styles.trayBalance}>
      <View style={styles.trayBalanceCopy}>
        <Type variant="caption" muted>
          Wallet balance
        </Type>
        <Type style={[styles.tabular, styles.trayBalancePrimary]}>
          {balances ? formatDepositAmount(balances.availableUsdcRaw, 'USDC', 6) : '— USDC'}
        </Type>
        <Type muted style={[styles.tabular, styles.trayBalanceSecondary]}>
          {balances ? formatDepositAmount(balances.lamports, 'SOL', 9) : '— SOL'}
        </Type>
      </View>
      <View style={[styles.growArtwork, { backgroundColor }]}>
        <OnboardingAnimation name="grow" height={92} loop backgroundColor={backgroundColor} />
      </View>
    </View>
  );
}

function CardOnrampRow({
  pending,
  sandbox,
  onPress,
}: {
  pending: boolean;
  sandbox: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.assetAccordion, { borderColor: colors.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buy USDC with card"
        disabled={pending}
        onPress={onPress}
        style={({ pressed }) => [
          styles.assetHeader,
          styles.cardHeader,
          pressed && { backgroundColor: colors.soft },
        ]}
      >
        <View style={styles.cardMark}>
          <ApplePayMark />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Type variant="headline">Buy with card</Type>
          <Type variant="caption" muted>
            {sandbox ? 'Apple Pay and debit cards · Sandbox' : 'Apple Pay and debit cards'}
          </Type>
        </View>
        {pending ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <AppSymbol name="next" color={colors.muted} size={17} />
        )}
      </Pressable>
    </View>
  );
}

function DepositAssetChoices({
  networks,
  onSelect,
}: {
  networks: DepositOption[];
  onSelect: (asset: DepositAsset) => void;
}) {
  const { colors } = useTheme();
  const assets = [...new Set(networks.map((network) => network.asset))] as DepositAsset[];

  return (
    <View style={[styles.assetAccordion, { borderColor: colors.line }]}>
      {assets.map((asset, assetIndex) => {
        return (
          <Pressable
            key={asset}
            accessibilityRole="button"
            accessibilityLabel={`${asset}, deposit on Solana`}
            onPress={() => onSelect(asset)}
            style={({ pressed }) => [
              styles.assetHeader,
              assetIndex > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: colors.line,
              },
              pressed && { backgroundColor: colors.soft },
            ]}
          >
            <AssetMark asset={asset} />
            <View style={{ flex: 1 }}>
              <Type variant="headline">{asset}</Type>
            </View>
            <AppSymbol name="next" color={colors.muted} size={17} />
          </Pressable>
        );
      })}
    </View>
  );
}

function DepositConfetti({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion();
  if (!active || reducedMotion) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.confettiLayer}
    >
      {confettiPieces.map((piece) => (
        <ConfettiPiece key={piece.id} {...piece} />
      ))}
    </View>
  );
}

function ConfettiPiece({ left, delay, drift, rotation, height }: (typeof confettiPieces)[number]) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(0);
    progress.set(
      withDelay(
        delay,
        withTiming(1, { duration: 1150, easing: Easing.bezier(0.16, 0.76, 0.28, 1) }),
      ),
    );
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.08, 0.78, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: drift * progress.get() },
      { translateY: 620 * progress.get() },
      { rotate: `${rotation * progress.get()}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          left: `${left}%`,
          height,
          backgroundColor: left % 3 === 0 ? '#FFFFFF' : left % 2 === 0 ? '#A8A8A8' : '#626262',
        },
        style,
      ]}
    />
  );
}

function ChainMark() {
  return <AssetMark asset="SOL" />;
}

function fallbackSeconds(name: string) {
  return chainStyle[name]?.seconds ?? 90;
}

function etaLabel(seconds: number) {
  if (seconds < 60) return `about ${seconds}s`;
  return `about ${Math.max(1, Math.round(seconds / 60))} min`;
}

function shortAddress(address: string) {
  if (address.length <= 22) return address;
  return `${address.slice(0, 10)}…${address.slice(-8)}`;
}

const styles = StyleSheet.create({
  confettiLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: -14,
    width: 5,
    borderRadius: 2,
  },
  success: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  successMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabular: { fontVariant: ['tabular-nums'], fontWeight: '600' },
  growArtwork: { width: 92, height: 92, overflow: 'hidden' },
  trayBalance: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  trayBalanceCopy: { flex: 1, gap: 2 },
  trayBalancePrimary: { fontSize: 28, lineHeight: 34, letterSpacing: -0.9 },
  trayBalanceSecondary: { fontSize: 16, lineHeight: 22 },
  assetAccordion: {
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  assetHeader: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cardHeader: { minHeight: 74 },
  cardMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundingChoices: { gap: 8 },
  receipts: { gap: 4, paddingTop: 8 },
  receipt: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notice: { borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', padding: 18, gap: 12 },
  preparing: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 14 },
  qrCard: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
    maxWidth: 330,
    width: '100%',
  },
  qrSurface: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  addressRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3A3A3A',
  },
  address: { fontVariant: ['tabular-nums'], flexShrink: 1 },
  depositFacts: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  assetAddress: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  selectedNetwork: {
    minHeight: 80,
    borderRadius: 22,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
