import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Web has no native sheet progress; move the paper through the slot after layout. */
export function useSheetReveal(height: number) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!height) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [height, progress, reduced]);
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] });
  const feed = progress.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  return {
    mask: { transform: [{ translateY: offset }] },
    paper: { transform: [{ translateY: Animated.add(Animated.multiply(offset, -1), feed) }] },
  };
}
