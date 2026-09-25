import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import type { OnchainSpendingPreview } from '@roundups/types';
import { createCryptoCard, fetchOnchainSpendingPreview } from '../lib/api';
import { cryptoCardProviders, type CryptoCardProvider } from '../lib/crypto-card-providers';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';
import { Button, TextButton, Type } from './ui';
import { OnboardingAnimation } from './onboarding-animation';
import { OnchainTransactionPreview } from './onchain-transaction-preview';
import { ProviderSegmentedControl } from './provider-segmented-control';
import { CryptoCardGuideTray } from './crypto-card-guide-tray';
import { Tray } from './reacticx/tray';

const evmAddress = /^0x[a-fA-F0-9]{40}$/;

/**
 * The add-a-crypto-card onboarding screen presented as a sheet from the crypto
 * cards list: pick a provider, paste the public address, Beaver scans it, then
 * saving connects the card.
 */
export function AddCryptoCardSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const auth = useAuth();
  const [provider, setProvider] = useState<CryptoCardProvider>('EtherFi');
  const [address, setAddress] = useState('');
  const [preview, setPreview] = useState<OnchainSpendingPreview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideTrayOpen, setGuideTrayOpen] = useState(false);
  const scanId = useRef(0);
  const addressShake = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const addressShakeStyle = useAnimatedStyle(() => ({
    transform: reducedMotion ? [] : [{ translateX: addressShake.get() }],
  }));

  useEffect(() => {
    if (!visible) return;
    setProvider('EtherFi');
    setAddress('');
    setPreview(null);
    setScanning(false);
    setBusy(false);
    setError(null);
    setGuideTrayOpen(false);
    scanId.current = 0;
  }, [visible]);

  const changeProvider = useCallback((value: CryptoCardProvider) => {
    setProvider(value);
    setPreview(null);
    setError(null);
  }, []);

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

  async function scanAddress(addressOverride?: string) {
    if (busy || scanning) return;
    const value = (addressOverride ?? address).trim();
    if (!evmAddress.test(value)) {
      rejectAddress('Enter a public EVM address in 0x format.');
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
    } catch (cause) {
      if (currentScan === scanId.current)
        setError(cause instanceof Error ? cause.message : 'We couldn’t read that address.');
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

  async function saveCard() {
    if (busy || scanning || !preview) return;
    setBusy(true);
    setError(null);
    try {
      await createCryptoCard(
        auth.getAccessToken,
        provider === 'Tuyo' ? 'tuyo' : 'etherfi',
        address.trim(),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t save that address.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Tray
        visible={visible}
        title="Add your Crypto card"
        onClose={onClose}
        footer={
          <>
            <OnboardingAnimation name="crypto-cards" height={132} transparent />
            <Button
              appearance="onboarding"
              title={preview ? 'Finish setup' : 'Check address'}
              loading={scanning || busy}
              onPress={() => (preview ? void saveCard() : void scanAddress())}
            />
          </>
        }
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ProviderSegmentedControl value={provider} options={cryptoCardProviders} onChange={changeProvider} />
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
                  address ? `${provider} public address ${address}` : 'No crypto card address pasted'
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
        </ScrollView>
      </Tray>
      <CryptoCardGuideTray
        visible={guideTrayOpen}
        initialProvider={provider}
        onClose={() => setGuideTrayOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Shrinks when the tray hits its max height (long transaction previews
  // scroll here) and is capped so the footer button always stays on screen.
  scroll: { flexShrink: 1, flexGrow: 0, maxHeight: 520 },
  scrollContent: { gap: 18, paddingBottom: 8 },
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
