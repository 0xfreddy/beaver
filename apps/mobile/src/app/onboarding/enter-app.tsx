import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppSymbol } from '../../components/app-symbol';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { DiaText } from '../../components/reacticx/dia-text';
import { RadiantButton } from '../../components/reacticx/radiant-button';
import { Type } from '../../components/ui';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
import { posthog } from '../../lib/telemetry';
import { useTheme } from '../../theme';

export default function EnterApp() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const flow = useOnboardingFlow();
  const [busy, setBusy] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  async function enter() {
    if (busy) return;
    setBusy(true);
    try {
      await flow.finish();
      posthog?.capture('onboarding_completed');
    } catch {
      // Unlock the button so a transient failure can be retried.
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.page,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 40,
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      <View style={styles.copy}>
        <View style={{ width: '100%', transform: [{ translateX: 20 }] }}>
          <OnboardingAnimation name="enter-home-door" height={220} loop={false} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Replay message animation"
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            setReplayKey((current) => current + 1);
          }}
          style={styles.impactCopy}
        >
          <DiaText
            key={`small-${replayKey}`}
            text="Small change."
            baseColor={colors.ink}
            bandRatio={0.7}
            duration={1400}
            delay={0}
            style={styles.impactText}
            textStyle={styles.impactLine}
          />
          <DiaText
            key={`clear-${replayKey}`}
            text="Makes a big difference."
            baseColor={colors.ink}
            bandRatio={0.7}
            duration={1400}
            delay={100}
            style={styles.impactText}
            textStyle={styles.impactLine}
          />
          <DiaText
            key={`money-${replayKey}`}
            text="Put your money to work."
            baseColor={colors.ink}
            bandRatio={0.7}
            duration={1400}
            delay={200}
            style={styles.impactText}
            textStyle={styles.impactLine}
          />
        </Pressable>
        <Type muted style={styles.detail}>
          Your Beaver is ready.
        </Type>
      </View>
      <RadiantButton
        accessibilityLabel={busy ? 'Opening Beaver' : 'Enter Beaver'}
        disabled={busy}
        onPress={() => void enter()}
        style={styles.radiantButton}
        theme={{
          background: '#FFFFFF',
          backgroundSubtle: '#FFD9B8',
          foreground: '#111111',
          highlight: '#FF5A1F',
        }}
        dotOpacity={0.9}
        glowWidth={0.9}
        glowBlur={26}
        glowBandWidth={0.24}
        shimmerOpacity={0.9}
      >
        <View style={styles.buttonContent}>
          <Type style={styles.buttonLabel}>{busy ? 'Opening Beaver…' : 'Enter Beaver'}</Type>
          <AppSymbol name="next" color="#111111" size={18} />
        </View>
      </RadiantButton>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 28 },
  copy: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  impactCopy: { width: '100%', alignItems: 'center', gap: 2 },
  impactText: { width: '100%' },
  impactLine: {
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '500',
    letterSpacing: -1.1,
    textAlign: 'center',
  },
  detail: { maxWidth: 350, textAlign: 'center', fontSize: 17, lineHeight: 25 },
  radiantButton: { width: '100%', minHeight: 60 },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  buttonLabel: { color: '#111111', fontWeight: '500', letterSpacing: 0.2 },
});
