import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Type } from './ui';

export function AnimatedSliderValue({
  text,
  value,
  width = 124,
}: {
  text: string;
  value: number;
  width?: number;
}) {
  const arrival = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    arrival.set(reducedMotion ? 0.72 : 0.88);
    arrival.set(
      reducedMotion
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { stiffness: 520, damping: 28, mass: 0.7 }),
    );
  }, [arrival, reducedMotion, value]);

  const style = useAnimatedStyle(() => ({
    opacity: reducedMotion ? arrival.get() : 1,
    transform: reducedMotion
      ? []
      : [{ translateY: (1 - arrival.get()) * 3 }, { scale: 0.96 + arrival.get() * 0.04 }],
  }));

  return (
    <Animated.View style={[styles.value, { width }, style]}>
      <Type variant="numeric">{text}</Type>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  value: { flexShrink: 0, alignItems: 'flex-end' },
});
