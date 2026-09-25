import { Host, HStack, Text } from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { useReducedMotion } from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';
import { formatUsd } from '@roundups/domain';
import { useTheme } from '../theme';

export function AllocationAmount({ cents }: { cents: number }) {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const { fontScale, width } = useWindowDimensions();
  const scale = Math.min(fontScale, 1.2);
  const [whole, fraction] = formatUsd(cents).split('.');
  // Separate observed native Text views: nested SwiftUI text can retain stale child values.
  return (
    <Host
      colorScheme={isDark ? 'dark' : 'light'}
      ignoreSafeArea="all"
      style={{ width: Math.min(width - 140, 360), height: 62 * scale }}
    >
      <HStack spacing={0} alignment="firstTextBaseline">
        {[
          { value: whole, size: 52 },
          { value: `.${fraction}`, size: 32 },
        ].map((part, index) => (
          <Text
            key={index}
            modifiers={[
              font({ size: part.size * scale, weight: 'regular' }),
              foregroundStyle(colors.ink),
              monospacedDigit(),
              lineLimit(1),
              minimumScaleFactor(0.65),
              ...(reduceMotion
                ? []
                : [
                    contentTransition('numericText'),
                    animation(Animation.spring({ response: 0.4, dampingFraction: 0.6 }), cents),
                  ]),
            ]}
          >
            {part.value}
          </Text>
        ))}
      </HStack>
    </Host>
  );
}
