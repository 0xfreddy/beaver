import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';
import { OnboardingAnimation } from './onboarding-animation';

export function BrandedWaitSurface({
  accessibilityLabel,
  still = false,
}: {
  accessibilityLabel: string;
  still?: boolean;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={still ? undefined : 'progressbar'}
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center' },
        { backgroundColor: colors.background },
      ]}
    >
      <OnboardingAnimation
        name="invite-peek"
        height={width}
        loop={!still}
        progress={still ? 0.5 : undefined}
        backgroundColor={colors.background}
      />
    </View>
  );
}
