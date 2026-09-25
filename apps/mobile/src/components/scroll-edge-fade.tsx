import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/** Headerless screens have no navigation chrome to drive UIKit's scroll edge effect.
 * This fixed, noninteractive gradient fades content before it reaches the status bar.
 * It follows the viewport, so all scrolling content fades without per-row JS updates.
 */
export function ScrollEdgeFade() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const id = useId().replaceAll(':', '');
  const height = top + 24;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    >
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="1" />
            <Stop offset={(top / height) * 0.8} stopColor={colors.background} stopOpacity=".98" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
