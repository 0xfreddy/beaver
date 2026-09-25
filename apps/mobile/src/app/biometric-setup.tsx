import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingAnimation } from '../components/onboarding-animation';
import { Button, TextButton, Type } from '../components/ui';
import {
  biometricAvailability,
  enableBiometricUnlock,
  type BiometricAvailability,
} from '../lib/biometric-auth';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';

export default function BiometricSetup() {
  const auth = useAuth();
  const navigation = useNavigation();
  const enabling = useRef(false);
  const userId = auth.user?.id ?? null;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void biometricAvailability()
      .then(setAvailability)
      .catch(() =>
        setAvailability({
          available: false,
          enrolled: false,
          label: Platform.OS === 'ios' ? 'Face ID' : 'biometrics',
          reason: 'Biometric unlock is unavailable on this device.',
        }),
      );
  }, [userId]);

  async function enable() {
    if (!userId || enabling.current) return;
    enabling.current = true;
    setBusy(true);
    setError(null);
    try {
      await enableBiometricUnlock(userId);
      if (navigation.isFocused()) router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enable biometric unlock.');
    } finally {
      enabling.current = false;
      setBusy(false);
    }
  }

  const label = availability?.label ?? (Platform.OS === 'ios' ? 'Face ID' : 'biometrics');
  const unavailable = availability !== null && !availability.available;
  const privacyCopy =
    label === 'Device passcode'
      ? 'Your passcode is handled by the system and is never shared with Beaver.'
      : 'Your biometric data stays on this device and is never shared with Beaver.';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
      onAccessibilityEscape={() => router.back()}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="A private lock protecting your data"
        style={styles.artwork}
      >
        <OnboardingAnimation name="privacy" height={210} loop />
      </View>

      <View style={styles.copy}>
        <Type
          variant="title"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          style={styles.title}
        >
          Protect Beaver with {label}
        </Type>
        <Type muted maxFontSizeMultiplier={1.5} style={styles.body}>
          Use {label} to unlock Beaver and approve withdrawals. {privacyCopy}
        </Type>
      </View>

      <View style={styles.actions}>
        {unavailable ? (
          <Type accessibilityRole="alert" maxFontSizeMultiplier={1.5} style={styles.message}>
            {availability.reason}
          </Type>
        ) : error ? (
          <Type accessibilityRole="alert" maxFontSizeMultiplier={1.5} style={styles.message}>
            {error}
          </Type>
        ) : null}
        <Button
          appearance="onboarding"
          title={`Enable ${label}`}
          loading={busy}
          disabled={!userId || availability === null || unavailable}
          onPress={() => void enable()}
        />
        <TextButton
          title={Platform.OS === 'web' ? 'Done' : 'Not now'}
          onPress={() => router.back()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  artwork: {
    height: 210,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copy: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
    marginTop: 'auto',
    paddingTop: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
