import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { goldenPalettes } from '../theme/golden-hour';

/** Fixed texture and three independently blendable skies; no bitmap color filtering. */
export function GoldenHourBackground({ quiet = false }: { quiet?: boolean }) {
  const { responsive, goldenProgress, goldenBloom } = useTheme();
  const reduceMotion = useReducedMotion();
  const warmth = useSharedValue(responsive ? goldenProgress : 1);
  const bloom = useSharedValue(responsive && goldenBloom ? 1 : 0);
  useEffect(() => {
    const config = { duration: reduceMotion ? 0 : 900 };
    warmth.set(withTiming(responsive ? goldenProgress : 1, config));
    bloom.set(withTiming(responsive && goldenBloom ? 1 : 0, config));
  }, [responsive, goldenProgress, goldenBloom, reduceMotion, warmth, bloom]);
  const warmStyle = useAnimatedStyle(() => ({ opacity: warmth.get() }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.get() }));
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <LinearGradient
        colors={goldenPalettes.resting}
        locations={[0, 0.36, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, warmStyle]}>
        <LinearGradient
          colors={goldenPalettes.accumulating}
          locations={[0, 0.29, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bloomStyle]}>
        <LinearGradient
          colors={goldenPalettes.confirmed}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="golden-grain" width={79} height={83} patternUnits="userSpaceOnUse">
            {Array.from({ length: 150 }, (_, i) => (
              <Circle
                key={i}
                cx={(i * 37.71) % 79}
                cy={(i * i * 13.13) % 83}
                r={0.45}
                fill={i % 2 ? '#FFFFFF' : '#29304B'}
                opacity={0.12}
              />
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#golden-grain)" />
      </Svg>
      {quiet && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(243,238,231,0.82)' }]} />
      )}
    </View>
  );
}
