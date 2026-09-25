import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/ui';
import { SetupPage } from '../../components/setup-page';
import { FadeText } from '../../components/reacticx/fade-text';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
import { useTheme } from '../../theme';

const questions = 'No time to invest?\nDon’t know where to start?';
const answer = 'Invest every time you spend';

export default function Intro() {
  const flow = useOnboardingFlow();
  const { colors } = useTheme();

  return (
    <SetupPage
      artwork={<OnboardingAnimation name={0} height={236} loop={false} />}
      title="Hi there"
      titleDelay={1500}
      description={
        <View style={styles.copy}>
          <FadeText
            heading={false}
            centered
            text={questions}
            startDelay={1900}
            style={[styles.questions, { color: colors.muted }]}
          />
          <FadeText
            heading={false}
            centered
            text={answer}
            startDelay={2700}
            style={styles.answer}
          />
        </View>
      }
      actions={
        <Button
          appearance="onboarding"
          title="I’m ready"
          onPress={() => void flow.next('welcome')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  copy: { gap: 18, alignItems: 'center' },
  questions: {
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  answer: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
