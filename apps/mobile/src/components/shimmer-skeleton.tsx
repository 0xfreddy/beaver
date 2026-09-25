import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      sweep.set(0.5);
      return;
    }
    sweep.set(
      withRepeat(withTiming(1, { duration: 1450, easing: Easing.inOut(Easing.cubic) }), -1, false),
    );
  }, [reducedMotion, sweep]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -220 + sweep.get() * 440 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { backgroundColor: colors.soft }, style]}
    >
      <Animated.View style={[styles.sweep, shimmerStyle]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.13)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0)']
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function RecentPurchaseSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Waiting for your first transaction"
      style={styles.purchaseRoot}
    >
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.purchaseRow}>
          <SkeletonBlock style={styles.logo} />
          <View style={styles.copy}>
            <SkeletonBlock style={[styles.line, { width: row === 1 ? '48%' : '58%' }]} />
            <SkeletonBlock style={[styles.lineSmall, { width: row === 2 ? '62%' : '72%' }]} />
          </View>
          <SkeletonBlock style={styles.amount} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden', borderCurve: 'continuous' },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 220 },
  purchaseRoot: { gap: 10 },
  purchaseRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 42, height: 42, borderRadius: 14 },
  copy: { flex: 1, gap: 8 },
  line: { height: 12, borderRadius: 6 },
  lineSmall: { height: 10, borderRadius: 5 },
  amount: { width: 52, height: 14, borderRadius: 7 },
});
