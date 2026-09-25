import { useInstitutionDirectory } from '../lib/institution-directory';
import { BankControls } from './bank-controls';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, TextButton, Type } from './ui';
import { SetupPage } from './setup-page';
import { OnboardingAnimation } from './onboarding-animation';
import { OnchainTransactionPreview } from './onchain-transaction-preview';
import { createCryptoCard, fetchOnchainSpendingPreview } from '../lib/api';
import { cryptoCardProviders, type CryptoCardProvider } from '../lib/crypto-card-providers';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { useOnchainPreview } from '../providers/onchain-preview-provider';
import { useTheme } from '../theme';
import { CircularBankList } from './reacticx/circular-bank-list';
import { ProviderSegmentedControl } from './provider-segmented-control';
import { CryptoCardGuideTray } from './crypto-card-guide-tray';

const evmAddress = /^0x[a-fA-F0-9]{40}$/;

const stages = ['bank', 'privacy', 'connect', 'address'] as const;
type Stage = (typeof stages)[number];

/** Stage swaps replay the stack-push slide used between onboarding screens. */
function StageShell({
  stage,
  direction,
  animated,
  children,
}: {
  stage: Stage;
  direction: 'forward' | 'back';
  animated: boolean;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const slide = direction === 'forward' ? SlideInRight : SlideInLeft;
  const entering = reducedMotion
    ? FadeIn.duration(140)
    : slide.duration(320).easing(Easing.bezier(0.23, 1, 0.32, 1));
  return (
    <Animated.View key={stage} entering={animated ? entering : undefined} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  );
}

export function SpendingSetup({
  initialStage = 'bank',
  onContinue,
}: {
  initialStage?: 'bank' | 'address';
  onContinue?: (step: 'enter-app' | 'manual') => Promise<void>;
}) {
  const { colors } = useTheme();
  const auth = useAuth();
  const cache = useQueryClient();
  const { setPreview: saveOnboardingPreview } = useOnchainPreview();
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof fetchOnchainSpendingPreview>
  > | null>(null);
  const [address, setAddress] = useState('');
  const [stageState, setStageState] = useState<{
    stage: Stage;
    direction: 'forward' | 'back';
    animated: boolean;
  }>({ stage: initialStage, direction: 'forward', animated: false });
  const { stage } = stageState;

  function goStage(next: Stage) {
    setStageState((current) => ({
      stage: next,
      direction: stages.indexOf(next) >= stages.indexOf(current.stage) ? 'forward' : 'back',
      animated: true,
    }));
  }
  const directory = useInstitutionDirectory();
  const [linkRequest, setLinkRequest] = useState(0);
  const [provider, setProvider] = useState<CryptoCardProvider>('EtherFi');
  const [guideTrayOpen, setGuideTrayOpen] = useState(false);
  // Stable identity: pasting or scanning re-renders this screen without
  // recreating the native provider picker, so the selected chip is preserved.
  const changeProvider = useCallback((value: CryptoCardProvider) => {
    setProvider(value);
    setPreview(null);
    setError(null);
  }, []);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanId = useRef(0);
  const addressShake = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const addressShakeStyle = useAnimatedStyle(() => ({
    transform: reducedMotion ? [] : [{ translateX: addressShake.get() }],
  }));

  function rejectAddress(message: string) {
    setError(null);
    void AccessibilityInfo.announceForAccessibility(message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (reducedMotion) return;
    cancelAnimation(addressShake);
    addressShake.set(0);
    addressShake.set(
      withSequence(
        withTiming(-12, { duration: 45 }),
        withTiming(10, { duration: 55 }),
        withTiming(-8, { duration: 55 }),
        withTiming(5, { duration: 55 }),
        withSpring(0, { stiffness: 620, damping: 34 }),
      ),
    );
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (preview && address) {
        await createCryptoCard(
          auth.getAccessToken,
          provider === 'Tuyo' ? 'tuyo' : 'etherfi',
          address,
        );
        await cache.invalidateQueries({
          queryKey: ['live', auth.user?.id, '/v1/bank/crypto-cards'],
        });
      }
      if (onContinue) {
        saveOnboardingPreview(preview);
        await onContinue('enter-app');
      } else router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t save your card. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function scanAddress(addressOverride?: string) {
    if (busy || scanning) return;
    const value = (addressOverride ?? address).trim();
    if (!evmAddress.test(value)) {
      rejectAddress('Enter a public EVM address in 0x format.');
      return;
    }
    if (!auth.user) {
      setError(
        auth.isSyncing
          ? 'Finishing your sign-in. Try again in a moment.'
          : 'Sign-in is unavailable. Go back and try again.',
      );
      return;
    }
    setScanning(true);
    setError(null);
    setPreview(null);
    const currentScan = ++scanId.current;
    try {
      const result = await fetchOnchainSpendingPreview(
        auth.getAccessToken,
        [value],
        provider === 'Tuyo' ? 'tuyo' : 'etherfi',
      );
      if (currentScan === scanId.current) setPreview(result);
    } catch (scanError) {
      if (currentScan === scanId.current)
        setError(scanError instanceof Error ? scanError.message : 'We couldn’t read that address.');
    } finally {
      if (currentScan === scanId.current) setScanning(false);
    }
  }

  async function pasteAddress() {
    try {
      const value = (await Clipboard.getStringAsync()).trim();
      setPreview(null);
      setAddress(value);
      if (!value) {
        rejectAddress('Copy a public EVM address, then tap Paste.');
        return;
      }
      if (!evmAddress.test(value)) {
        rejectAddress('The copied text is not a valid 0x address.');
        return;
      }
      setError(null);
      void Haptics.selectionAsync().catch(() => {});
      void scanAddress(value);
    } catch {
      rejectAddress('Beaver could not read the clipboard. Try copying the address again.');
    }
  }

  if (stage === 'bank')
    return (
      <StageShell {...stageState}>
        <SetupPage
          title={'Connect your\nspending'}
          contentStyle={{ flexGrow: 1 }}
          description="Beaver only reads purchase data to calculate your roundup."
          actions={
            <>
              <Type muted style={{ textAlign: 'center', marginBottom: 8 }}>
                Your data stays private.
              </Type>
              <Button
                appearance="onboarding"
                title="Connect bank"
                onPress={() => goStage('privacy')}
              />
              <TextButton title="Connect crypto card" onPress={() => goStage('address')} />
            </>
          }
        >
          <View style={{ flex: 1, justifyContent: 'center', minHeight: 240 }}>
            {/* Renders immediately from the bundled popular-bank catalogue;
                remote provider logos upgrade in when the directory resolves. */}
            <CircularBankList banks={directory.data?.items ?? []} />
          </View>
        </SetupPage>
      </StageShell>
    );

  if (stage === 'privacy')
    return (
      <StageShell {...stageState}>
        <SetupPage
          title={'Your data stays\nprivate. Always.'}
          description={
            <View style={{ gap: 16 }}>
              <Type muted style={{ fontSize: 17, lineHeight: 25 }}>
                Your account and purchase data is used to calculate your roundups, nothing more.
              </Type>
              <Type style={{ fontSize: 17, lineHeight: 25, fontWeight: '600' }}>
                We will never sell your data.
              </Type>
            </View>
          }
          actions={
            <>
              <Type muted style={{ textAlign: 'center', marginBottom: 8 }}>
                Powered by MoneyKit and Salt Edge
              </Type>
              <Button appearance="onboarding" title="Continue" onPress={() => goStage('connect')} />
            </>
          }
        >
          <OnboardingAnimation name="privacy" height={250} loop />
        </SetupPage>
      </StageShell>
    );

  if (stage === 'connect')
    return (
      <StageShell {...stageState}>
        <SetupPage
          title="Your banks"
          actions={
            <>
              <Type muted style={{ textAlign: 'center', marginBottom: 8 }}>
                Your data stays private. Always.
              </Type>
              <Button
                appearance="onboarding"
                title="Connect another bank"
                loading={busy}
                onPress={() => setLinkRequest((value) => value + 1)}
              />
              <TextButton title="Connect crypto card" onPress={() => goStage('address')} />
              <TextButton title={onContinue ? 'Skip' : 'Done'} onPress={() => void finish()} />
            </>
          }
        >
          <BankControls
            onboarding
            linkRequest={linkRequest}
            onBusyChange={setBusy}
            onCancel={() => goStage('bank')}
          />
        </SetupPage>
      </StageShell>
    );

  return (
    <StageShell {...stageState}>
      <>
        <SetupPage
          includeTopSafeArea={!!onContinue}
          titleStyle={
            initialStage === 'address'
              ? { fontSize: 28, lineHeight: 34, letterSpacing: -0.8 }
              : undefined
          }
          title={
            initialStage === 'address' ? 'Add your Crypto card' : 'Add your Crypto\ncard instead'
          }
          actions={
            <>
              <OnboardingAnimation name="crypto-cards" height={132} transparent />
              <Button
                appearance="onboarding"
                title={preview ? 'Finish setup' : 'Check address'}
                loading={scanning || busy}
                onPress={() => (preview ? void finish() : void scanAddress())}
              />
              {onContinue ? (
                <TextButton
                  title="Use manual mode"
                  disabled={busy || scanning}
                  onPress={() => void onContinue('manual')}
                />
              ) : null}
            </>
          }
        >
          <ProviderSegmentedControl
            value={provider}
            options={cryptoCardProviders}
            onChange={changeProvider}
          />
          <View style={{ gap: 4 }}>
            <Animated.View
              style={[
                styles.address,
                { backgroundColor: colors.surface, borderColor: colors.line },
                addressShakeStyle,
              ]}
            >
              <Type
                accessibilityLabel={
                  address
                    ? `${provider} public address ${address}`
                    : 'No crypto card address pasted'
                }
                selectable={!!address}
                muted={!address}
                numberOfLines={2}
                style={styles.addressText}
              >
                {address || 'Copy your card 0x address'}
              </Type>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Paste crypto card address"
                disabled={busy || scanning}
                hitSlop={4}
                onPress={() => void pasteAddress()}
                style={({ pressed }) => [styles.pasteButton, { opacity: pressed ? 0.55 : 1 }]}
              >
                <Type variant="caption" style={styles.pasteLabel}>
                  Paste
                </Type>
              </Pressable>
            </Animated.View>
            {/* While transactions are being retrieved (or already found) the
              setup help links disappear so the transaction list sits higher. */}
            {scanning || preview ? null : (
              <>
                <TextButton
                  title="Why is my card not supported?"
                  align="leading"
                  onPress={() =>
                    Alert.alert(
                      'Why is my card not supported?',
                      'New cards are coming soon, send us a message with the crypto card you’d like to see',
                    )
                  }
                />
                <TextButton
                  title="How do I get it?"
                  align="leading"
                  onPress={() => setGuideTrayOpen(true)}
                />
              </>
            )}
          </View>
          {error ? (
            <Type accessibilityRole="alert" muted>
              {error}
            </Type>
          ) : null}
          <OnchainTransactionPreview loading={scanning} transactions={preview?.transactions} />
        </SetupPage>
        <CryptoCardGuideTray
          visible={guideTrayOpen}
          initialProvider={provider}
          onClose={() => setGuideTrayOpen(false)}
        />
      </>
    </StageShell>
  );
}

const styles = StyleSheet.create({
  address: {
    minHeight: 64,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  pasteButton: {
    minWidth: 60,
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  pasteLabel: { fontWeight: '600' },
});
