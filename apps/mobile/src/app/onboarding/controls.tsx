import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Button, Type } from '../../components/ui';
import { SetupPage } from '../../components/setup-page';
import { AppSymbol } from '../../components/app-symbol';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
import { useProfile } from '../../providers/profile-provider';
import { useOnboarding } from '../../providers/onboarding-provider';
import { useTheme } from '../../theme';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { estimatedMonthlyRoundup } from '../../lib/onboarding-spending';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const HOLD_MS = 1900;
const RING_LENGTH = 2 * Math.PI * 34;
const paperLines = Array.from({ length: 11 }, (_, index) => index);

export default function Pledge() {
  const flow = useOnboardingFlow();
  const onboarding = useOnboarding();
  const { profile } = useProfile();
  const { colors, isDark } = useTheme();
  const [leaving, setLeaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const firstName = profile.alias === 'Roundups member' ? 'you' : profile.alias || 'you';
  const monthlyRoundup = estimatedMonthlyRoundup(
    onboarding.spendingProfile.monthlySpend,
    onboarding.spendingProfile.transactions,
  );
  const reducedMotion = useReducedMotion();
  const holdProgress = useSharedValue(0);
  const pressDepth = useSharedValue(0);

  const finishHold = useCallback(() => {
    holdProgress.set(1);
    pressDepth.set(withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) }));
    setSigning(true);
    setSigned(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [holdProgress, pressDepth]);

  useEffect(
    () => () => {
      cancelAnimation(holdProgress);
      cancelAnimation(pressDepth);
    },
    [holdProgress, pressDepth],
  );

  async function continueToConnections() {
    if (leaving) return;
    setLeaving(true);
    await flow.next('bank');
    setLeaving(false);
  }

  function startSigning() {
    if (signed || leaving) return;
    setSigning(true);
    void Haptics.selectionAsync().catch(() => {});
    pressDepth.set(withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }));
    holdProgress.set(
      withTiming(1, { duration: reducedMotion ? 200 : HOLD_MS, easing: Easing.linear }, (done) => {
        if (done) scheduleOnRN(finishHold);
      }),
    );
  }

  function stopSigning() {
    pressDepth.set(withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }));
    if (signed || holdProgress.get() >= 1) return;
    setSigning(false);
    cancelAnimation(holdProgress);
    holdProgress.set(withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }));
  }

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - holdProgress.get()),
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressDepth.get() * 0.035 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + holdProgress.get() * 0.65,
    transform: [{ scale: 0.86 + holdProgress.get() * 0.28 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: holdProgress.get(),
  }));
  const handshakeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, holdProgress.get() * 6),
    transform: [{ scale: 0.94 + Math.min(1, holdProgress.get() * 4) * 0.06 }],
  }));

  return (
    <SetupPage
      title="Sign a note to future you"
      topPadding={8}
      actions={
        <View pointerEvents={signed ? 'auto' : 'none'} style={{ opacity: signed ? 1 : 0 }}>
          {signed ? (
            <Button
              appearance="onboarding"
              title="Continue"
              loading={leaving}
              onPress={() => void continueToConnections()}
            />
          ) : (
            <View style={styles.buttonPlaceholder} />
          )}
        </View>
      }
    >
      <View style={styles.note}>
        <View style={styles.paperLines} pointerEvents="none">
          {paperLines.map((line) => (
            <View key={line} style={styles.paperRule} />
          ))}
        </View>
        <View style={styles.letter}>
          <Type variant="story" style={styles.letterText}>
            I promise to roundup ${monthlyRoundup} in stocks this month.
          </Type>
          <Type variant="story" style={styles.letterText}>
            I want to stay in control of my money by doing small roundups everyday, small amounts
            can add up quickly.
          </Type>
          <Type variant="story" style={styles.letterText}>
            I want my beaver to build the bridge to financial freedom.
          </Type>
          <Type variant="story" style={styles.letterText}>
            Future {firstName}
          </Type>
        </View>
      </View>
      <View style={styles.signatureStage}>
        <Animated.View
          accessible={false}
          pointerEvents="none"
          style={[
            styles.handshakeAnimation,
            handshakeStyle,
            { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
          ]}
        >
          {signing ? <OnboardingAnimation name="handshake" height={110} loop={false} /> : null}
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={signed ? 'Signed' : 'Hold to sign'}
          accessibilityHint={
            signed ? 'Continue is now available' : 'Hold until the fingerprint completes'
          }
          accessibilityState={{ selected: signed, busy: !signed && leaving }}
          accessibilityActions={[{ name: 'activate', label: 'Sign note' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate' && !signed && !leaving) finishHold();
          }}
          disabled={signed || leaving}
          onPressIn={startSigning}
          onPressOut={stopSigning}
          style={[styles.fingerprintHitbox, styles.fingerprintAnchor]}
        >
          <Animated.View
            style={[styles.fingerprintButton, buttonStyle, { borderColor: colors.line }]}
          >
            <Animated.View style={[styles.fingerprintGlow, glowStyle]} />
            <Svg width={76} height={76} viewBox="0 0 76 76" style={styles.ring}>
              <AnimatedCircle
                cx={38}
                cy={38}
                r={34}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                animatedProps={ringProps}
              />
            </Svg>
            <View style={styles.fingerprintIcon}>
              <AppSymbol name="fingerprint" color={signed ? '#FFFFFF' : '#8E8E93'} size={42} />
              <Animated.View style={[styles.fingerprintFill, fillStyle]}>
                <AppSymbol name="fingerprint" color="#FFFFFF" size={42} />
              </Animated.View>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  note: {
    overflow: 'hidden',
    borderRadius: 30,
    borderCurve: 'continuous',
    backgroundColor: '#F2F0EC',
    boxShadow: '0 18px 40px -20px rgba(0,0,0,0.8)',
  },
  paperLines: { ...StyleSheet.absoluteFill },
  paperRule: { height: 28, borderTopWidth: 1, borderColor: 'rgba(120,90,40,0.08)' },
  letter: { gap: 18, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24 },
  letterText: {
    color: '#1A1816',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  signatureStage: {
    height: 190,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fingerprintHitbox: {
    minWidth: 96,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerprintButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#29292C',
  },
  fingerprintGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
  },
  ring: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  fingerprintIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  fingerprintFill: { position: 'absolute', inset: 0 },
  buttonPlaceholder: { minHeight: 64 },
  fingerprintAnchor: { position: 'absolute', bottom: 0 },
  handshakeAnimation: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  handshakeLottie: { width: 286, height: 110 },
});
