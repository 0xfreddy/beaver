import { Host, Text } from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../theme';

export function AnimatedSliderValue({
  text,
  value,
  width = 124,
}: {
  text: string;
  value: number;
  width?: number;
}) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Host
      colorScheme={isDark ? 'dark' : 'light'}
      ignoreSafeArea="all"
      style={{ width, height: 38 }}
    >
      <Text
        modifiers={[
          frame({ width, height: 38, alignment: 'trailing' }),
          font({ size: 30, weight: 'semibold' }),
          foregroundStyle(colors.ink),
          monospacedDigit(),
          lineLimit(1),
          ...(reducedMotion
            ? []
            : [
                contentTransition('numericText'),
                animation(Animation.spring({ response: 0.4, dampingFraction: 0.66 }), value),
              ]),
        ]}
      >
        {text}
      </Text>
    </Host>
  );
}
