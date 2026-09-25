import { FadeText } from '../../components/reacticx/fade-text';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Slider from '@expo/ui/community/slider';
import * as Haptics from 'expo-haptics';
import { Button, TextButton, Type } from '../../components/ui';
import { SetupPage } from '../../components/setup-page';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { AnimatedSliderValue } from '../../components/animated-slider-value';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
import { useTheme } from '../../theme';
import { useOnboarding } from '../../providers/onboarding-provider';
import { estimatedMonthlyRoundup } from '../../lib/onboarding-spending';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function Spending() {
  const flow = useOnboardingFlow();
  const onboarding = useOnboarding();
  const { colors } = useTheme();
  const [monthlySpend, setMonthlySpend] = useState(onboarding.spendingProfile.monthlySpend);
  const [transactions, setTransactions] = useState(onboarding.spendingProfile.transactions);
  const [calculated, setCalculated] = useState(false);
  const lastSpendStep = useRef(monthlySpend);
  const lastTransactionStep = useRef(transactions);
  // The exported artwork contains the complete $0–$20k progression. Keep its
  // first and last frames reachable and map every value across the full range.
  const spendAnimationProgress = monthlySpend / 20000;
  const monthlyRoundup = estimatedMonthlyRoundup(monthlySpend, transactions);

  function updateSpend(value: number) {
    const next = Math.round(value / 50) * 50;
    if (next !== lastSpendStep.current) {
      lastSpendStep.current = next;
      void Haptics.selectionAsync().catch(() => {});
    }
    setMonthlySpend(next);
  }

  function updateTransactions(value: number) {
    const next = Math.round(value);
    if (next !== lastTransactionStep.current) {
      lastTransactionStep.current = next;
      void Haptics.selectionAsync().catch(() => {});
    }
    setTransactions(next);
  }

  if (calculated)
    return (
      <SetupPage
        artwork={<OnboardingAnimation name={1} height={236} loop={false} />}
        title={`Did you know…\n${money.format(monthlyRoundup)} can become stocks\nevery month.`}
        description={
          <View style={{ gap: 24, alignItems: 'center' }}>
            <FadeText
              blur
              text="Spending is easy. Saving is hard."
              highlights={['easy', 'hard']}
              heading={false}
              centered
              style={{ fontSize: 17, lineHeight: 25, color: colors.muted }}
            />
            <FadeText
              blur
              heading={false}
              text={'Match or round up purchases and build up\nyour stock portfolio.'}
              centered
              style={{ fontSize: 17, lineHeight: 25, color: colors.muted }}
            />
          </View>
        }
        actions={
          <>
            <Button
              appearance="onboarding"
              title="Let’s do it"
              onPress={() => void flow.next('controls')}
            />
            <TextButton title="Adjust my estimate" onPress={() => setCalculated(false)} />
          </>
        }
      />
    );

  return (
    <SetupPage
      title={'What does a normal\nmonth look like?'}
      description="Helps your beaver know you better"
      topPadding={8}
      actions={
        <View style={styles.footerContent}>
          <View style={styles.sliderArtwork}>
            <OnboardingAnimation name="sliders" height={120} progress={spendAnimationProgress} />
          </View>
          <Button
            appearance="onboarding"
            title="Calculate my roundups"
            onPress={() => {
              void onboarding.saveSpendingProfile({ monthlySpend, transactions });
              setCalculated(true);
            }}
          />
        </View>
      }
    >
      <View style={styles.sliderGroup}>
        <View style={styles.valueRow}>
          <Type variant="headline" numberOfLines={1} style={styles.sliderLabel}>
            Monthly card spend
          </Type>
          <AnimatedSliderValue text={money.format(monthlySpend)} value={monthlySpend} width={136} />
        </View>
        <Slider
          value={monthlySpend}
          minimumValue={0}
          maximumValue={20000}
          step={50}
          minimumTrackTintColor={colors.ink}
          style={styles.slider}
          onValueChange={updateSpend}
        />
      </View>
      <View style={styles.sliderGroup}>
        <View style={styles.valueRow}>
          <Type variant="headline" numberOfLines={1} style={styles.sliderLabel}>
            Purchases each month
          </Type>
          <AnimatedSliderValue text={String(transactions)} value={transactions} width={72} />
        </View>
        <Slider
          value={transactions}
          minimumValue={5}
          maximumValue={100}
          step={1}
          minimumTrackTintColor={colors.ink}
          style={styles.slider}
          onValueChange={updateTransactions}
        />
      </View>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  sliderGroup: { gap: 12 },
  slider: { width: '100%', height: 44 },
  footerContent: { gap: 0 },
  sliderArtwork: {
    transform: [{ translateX: -28 }],
  },
  sliderLabel: { flex: 1, minWidth: 0 },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
});
