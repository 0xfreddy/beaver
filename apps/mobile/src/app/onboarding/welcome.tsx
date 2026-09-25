import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Type } from '../../components/ui';
import { useTheme } from '../../theme';
import { POST_WELCOME_STEP, useOnboardingFlow } from '../../lib/onboarding-flow';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { OnboardingNotificationStack } from '../../components/onboarding-notification-stack';
import { DynamicText } from '../../components/reacticx/dynamic-text';
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';

const rotatingStocks = [
  { id: 'spacex', text: 'SpaceX.' },
  { id: 'apple', text: 'Apple.' },
  { id: 'nvidia', text: 'Nvidia.' },
  { id: 'netflix', text: 'Netflix.' },
] as const;

export default function Welcome() {
  const { readOnly } = useLocalSearchParams<{ readOnly?: string }>();
  const [leaving, setLeaving] = useState(false);
  const { colors } = useTheme();
  const flow = useOnboardingFlow();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [showTitle, setShowTitle] = useState(false);

  const revealCopy = useCallback(() => setShowTitle(true), []);

  async function continueFlow() {
    if (leaving) return;
    setLeaving(true);
    flow.reviewIntroduction();
    if (readOnly === 'true') {
      router.dismissAll();
      router.replace('/settings');
      return;
    }
    await flow.next(POST_WELCOME_STEP);
    setLeaving(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.body}
      >
        <OnboardingNotificationStack onComplete={revealCopy} />
        {showTitle ? (
          <Animated.View
            entering={FadeIn.duration(reducedMotion ? 150 : 280).easing(
              Easing.bezier(0.23, 1, 0.32, 1),
            )}
            accessible
            accessibilityRole="header"
            accessibilityLabel="Turn everyday spending into SpaceX, Apple, Nvidia, Netflix."
            style={styles.titleBlock}
          >
            <Type accessible={false} style={styles.title}>
              Turn everyday spending into
            </Type>
            <View style={styles.dynamicTitleLine}>
              <DynamicText
                items={rotatingStocks}
                loop
                paused={reducedMotion}
                accessibilityLabel="SpaceX, Apple, Nvidia, Netflix"
                animationPreset="fade"
                animationDirection="up"
                timing={{ interval: 1800, animationDuration: 240 }}
                dot={{ visible: false }}
                text={{
                  color: colors.ink,
                  fontSize: 28,
                  fontWeight: '600',
                  style: styles.dynamicTitleText,
                }}
                containerStyle={styles.dynamicText}
                contentStyle={styles.dynamicTextContent}
              />
            </View>
          </Animated.View>
        ) : null}
        <View pointerEvents="none" style={styles.stocksArtwork}>
          <OnboardingAnimation name="stocks" height={260} loop />
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Button
          appearance="onboarding"
          title={readOnly === 'true' ? 'Back to Profile' : 'Feed my Beaver'}
          loading={leaving}
          onPress={() => void continueFlow()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    gap: 18,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 0,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  stocksArtwork: { marginTop: 'auto', height: 224, overflow: 'hidden', width: '100%' },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  titleBlock: { alignItems: 'center', marginTop: 'auto' },
  dynamicTitleLine: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dynamicText: { minHeight: 0, width: '100%', height: 52, padding: 0 },
  dynamicTextContent: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dynamicTitleText: { lineHeight: 34, letterSpacing: -0.6, textAlign: 'center' },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 0,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
});
