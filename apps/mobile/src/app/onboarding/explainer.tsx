import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { RoundupPercentage } from '@roundups/types';
import { Button, Type } from '../../components/ui';
import { SetupPage } from '../../components/setup-page';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { useLive, type InvestmentPolicy } from '../../lib/live';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
import { useOnboarding } from '../../providers/onboarding-provider';
import { estimatedMonthlyRoundup } from '../../lib/onboarding-spending';
import { useTheme } from '../../theme';

type Connection = { id: string; institutionName: string | null; status: string };

const STEP_MILLIS = 4600;
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function ruleCopy(percentage: RoundupPercentage | undefined) {
  if (percentage === undefined) return null;
  if (percentage === 0) return { title: 'To the dollar', example: 'A $9.20 purchase invests $0.80.' };
  if (percentage === 100) return { title: 'Match', example: 'A $10 purchase invests $10.00.' };
  return {
    title: `Fixed ${percentage}%`,
    example: `A $10 purchase invests $${(percentage / 10).toFixed(2)}.`,
  };
}

/** A progressing line that walks through the roundup flow with the user's own selections. */
export default function Explainer() {
  const flow = useOnboardingFlow();
  const onboarding = useOnboarding();
  const reducedMotion = useReducedMotion();
  const connections = useLive<{ items: Connection[] }>('/v1/bank/connections');
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const [step, setStep] = useState(0);

  const banks =
    connections.data?.items
      .filter((connection) => connection.status !== 'disconnected')
      .map((connection) => connection.institutionName)
      .filter((name): name is string => !!name) ?? [];
  const rule = ruleCopy(policy.data?.roundupPercentage);
  const estimate = estimatedMonthlyRoundup(
    onboarding.spendingProfile.monthlySpend,
    onboarding.spendingProfile.transactions,
    policy.data?.roundupPercentage,
  );

  const steps = [
    {
      label: 'Bank',
      title: 'Connect your bank',
      body: banks.length
        ? `Beaver watches ${banks.slice(0, 2).join(' and ')}${
            banks.length > 2 ? ` +${banks.length - 2} more` : ''
          } for card purchases.`
        : 'Beaver reads your card purchases to find spare change.',
      animation: <OnboardingAnimation key="bank" name="bank-bridge-builder" height={190} loop />,
    },
    {
      label: 'Rule',
      title: 'Beaver runs your rule',
      body: rule ? `${rule.title}. ${rule.example}` : 'Every purchase is rounded by your rule.',
      animation: (
        <OnboardingAnimation key="rule" name="roundup-coin-sorter" height={190} loop transparent />
      ),
    },
    {
      label: 'Roundup',
      title: 'Spare change buys stock',
      body: `About ${money.format(estimate)} every month from around ${
        onboarding.spendingProfile.transactions
      } card purchases.`,
      animation: <OnboardingAnimation key="coins" name="coins" height={190} />,
    },
  ] as const;
  const current = steps[step]!;
  const last = step === steps.length - 1;

  function goTo(next: number) {
    if (next === step) return;
    void Haptics.selectionAsync().catch(() => {});
    setStep(next);
    void AccessibilityInfo.announceForAccessibility(`${steps[next]!.title}. ${steps[next]!.body}`);
  }

  useEffect(() => {
    if (last) return;
    const timer = setTimeout(() => goTo(step + 1), STEP_MILLIS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, last]);

  // The step card container persists; only its entrance transform is replayed.
  // Remounting an entering-animated view on each step change desyncs the native
  // view hierarchy (SIGABRT in RCTViewComponentView unmountChildComponentView).
  const entrance = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      entrance.value = 1;
      return;
    }
    entrance.value = 0;
    entrance.value = withTiming(1, { duration: 320, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [step, reducedMotion, entrance]);
  const stepEntrance = useAnimatedStyle(() => ({
    opacity: entrance.get(),
    transform: [{ translateX: (1 - entrance.get()) * 28 }],
  }));

  return (
    <SetupPage
      title={'This is how your\nroundups will work'}
      topPadding={8}
      contentStyle={{ flexGrow: 1 }}
      actions={
        <Button
          appearance="onboarding"
          title={last ? 'Continue' : 'Next'}
          onPress={() => (last ? void flow.next('enter-app') : goTo(step + 1))}
        />
      }
    >
      <ProgressLine
        step={step}
        stepCount={steps.length}
        labels={steps.map((entry) => entry.label)}
        reducedMotion={reducedMotion}
        onSelect={goTo}
      />
      <View style={styles.stepContent}>
        <Animated.View style={[styles.stepCard, stepEntrance]}>
          {current.animation}
          <Type variant="headline" style={styles.stepTitle}>
            {current.title}
          </Type>
          <Type muted style={styles.stepBody}>
            {current.body}
          </Type>
        </Animated.View>
      </View>
    </SetupPage>
  );
}

function ProgressLine({
  step,
  stepCount,
  labels,
  reducedMotion,
  onSelect,
}: {
  step: number;
  stepCount: number;
  labels: readonly string[];
  reducedMotion: boolean;
  onSelect: (step: number) => void;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    const target = step / (stepCount - 1);
    progress.value = reducedMotion
      ? target
      : withTiming(target, { duration: 700, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    if (step > 0 && !reducedMotion) {
      dotScale.value = withSpring(0.72, { stiffness: 620, damping: 16 }, () => {
        dotScale.value = withSpring(1, { stiffness: 620, damping: 16 });
      });
    }
  }, [step, stepCount, reducedMotion, progress, dotScale]);

  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.001, progress.get()) }],
  }));
  const activePulse = useAnimatedStyle(() => ({ transform: [{ scale: dotScale.get() }] }));

  return (
    <View style={styles.progressWrap} importantForAccessibility="no-hide-descendants">
      <View style={[styles.track, { backgroundColor: colors.line }]} accessible={false}>
        <Animated.View
          style={[styles.trackFill, { backgroundColor: colors.ink }, fill]}
        />
      </View>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {labels.map((label, index) => {
          const done = index <= step;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`${label} step${done ? ', completed' : ''}`}
              accessibilityState={{ selected: index === step }}
              hitSlop={12}
              onPress={() => onSelect(index)}
              style={styles.dotColumn}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? colors.ink : colors.background,
                    borderColor: done ? colors.ink : colors.line,
                  },
                  index === step ? activePulse : null,
                ]}
              >
                {done ? <View style={[styles.dotCore, { backgroundColor: colors.background }]} /> : null}
              </Animated.View>
              <Type variant="caption" muted={!done} style={styles.dotLabel}>
                {label}
              </Type>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: { marginTop: 4 },
  track: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 13,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    transformOrigin: 'left',
  },
  dots: { flexDirection: 'row' },
  dotColumn: { flex: 1, alignItems: 'center', gap: 8 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dotCore: { width: 8, height: 8, borderRadius: 999 },
  dotLabel: { letterSpacing: 0.2 },
  stepContent: { flex: 1, justifyContent: 'center', minHeight: 300, gap: 24 },
  stepCard: { alignItems: 'center', gap: 14 },
  stepTitle: { textAlign: 'center', fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  stepBody: { textAlign: 'center', fontSize: 17, lineHeight: 25, maxWidth: 320 },
});
