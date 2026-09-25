import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useNavigation } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

type SheetNavigation = {
  addListener(
    event: 'sheetDetentChange',
    listener: (event: { data: { index: number; stable: boolean } }) => void,
  ): () => void;
  addListener(
    event: 'transitionStart',
    listener: (event: { data: { closing: boolean } }) => void,
  ): () => void;
  addListener(event: 'gestureCancel', listener: () => void): () => void;
};

/** Drive the paper from sheet events; native transition progress jumps across form-sheet detents. */
export function useSheetReveal(height: number) {
  const progress = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation() as unknown as SheetNavigation;
  const reduced = useReducedMotion();
  useEffect(() => {
    const animate = (toValue: number, duration: number) => {
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue,
        duration: reduced ? 0 : duration,
        easing: toValue === 0 ? Easing.inOut(Easing.cubic) : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    animate(1, 450);
    let lastDetent: number | null = null;
    const removeDetent = navigation.addListener('sheetDetentChange', (event) => {
      if (!event.data.stable) return;
      const previousDetent = lastDetent;
      lastDetent = event.data.index;
      // The first stable event is presentation, not a request to roll the receipt back.
      if (previousDetent === null || previousDetent === lastDetent) return;
      animate(event.data.index === 0 ? 0 : 1, event.data.index === 0 ? 850 : 450);
    });
    const removeTransition = navigation.addListener('transitionStart', (event) => {
      if (event.data.closing) animate(0, 650);
    });
    const removeCancel = navigation.addListener('gestureCancel', () => animate(1, 220));
    return () => {
      progress.stopAnimation();
      removeDetent();
      removeTransition();
      removeCancel();
    };
  }, [navigation, progress, reduced]);
  const offset = reduced
    ? 0
    : progress.interpolate({ inputRange: [0, 1], outputRange: [-height, 0], extrapolate: 'clamp' });
  const feed = reduced
    ? 0
    : progress.interpolate({ inputRange: [0, 1], outputRange: [-18, 0], extrapolate: 'clamp' });
  return {
    mask: { transform: [{ translateY: offset }] },
    paper: { transform: [{ translateY: Animated.add(Animated.multiply(offset, -1), feed) }] },
  };
}
