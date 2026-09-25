import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  DEFAULT_BAND_RATIO,
  DEFAULT_BASE_COLOR,
  DEFAULT_DELAY,
  DEFAULT_DURATION,
  DEFAULT_LOOP_DELAY,
  DEFAULT_SWEEP_COLORS,
  ENTER_DURATION,
  EXIT_DURATION,
  SWAP_EASING,
  SWAP_SHIFT,
  SWEEP_EASING,
} from './dia-text/const';
import { buildSweepGradient, sweepStripWidth } from './dia-text/helper';
import type { DiaTextProps } from './dia-text/types';

/**
 * Source-faithful port of Reacticx Dia Text. The original masked gradient sweep
 * and text-swap timing are retained; Reduce Motion and accessibility are added.
 */
const DiaTextBase = ({
  text,
  sweepColors = DEFAULT_SWEEP_COLORS,
  baseColor = DEFAULT_BASE_COLOR,
  duration = DEFAULT_DURATION,
  delay = DEFAULT_DELAY,
  loop = false,
  loopDelay = DEFAULT_LOOP_DELAY,
  bandRatio = DEFAULT_BAND_RATIO,
  autoPlay = true,
  textStyle,
  style,
  accessibilityLabel,
  onSweepEnd,
}: DiaTextProps) => {
  const reducedMotion = useReducedMotion();
  const textKey = Array.isArray(text) ? text.join('\u0000') : text;
  const texts = useMemo<string[]>(
    () => (Array.isArray(text) ? [...text] : [text as string]),
    [text],
  );
  const isMulti = texts.length > 1;
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const opacity = useSharedValue(isMulti && !reducedMotion ? 0 : 1);
  const shift = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setIndex(0), [textKey]);

  const onSizerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      Math.abs(previous.w - width) < 0.5 && Math.abs(previous.h - height) < 0.5
        ? previous
        : { w: width, h: height },
    );
  }, []);

  const band = size.w * bandRatio;
  const ready = size.w > 0;
  const gradient = useMemo(
    () => buildSweepGradient(size.w, band, sweepColors, baseColor),
    [band, baseColor, size.w, sweepColors],
  );
  const commitNext = useCallback(() => {
    setIndex((current) => (current + 1) % texts.length);
    setCycle((current) => current + 1);
  }, [texts.length]);
  const handleSweepEnd = useCallback(
    (finishedIndex: number) => {
      onSweepEnd?.(finishedIndex);
      if (!loop || reducedMotion) return;

      timerRef.current = setTimeout(() => {
        if (!isMulti) {
          setCycle((current) => current + 1);
          return;
        }
        opacity.set(withTiming(0, { duration: EXIT_DURATION, easing: SWAP_EASING }));
        shift.set(
          withTiming(-SWAP_SHIFT, { duration: EXIT_DURATION, easing: SWAP_EASING }, (finished) => {
            'worklet';
            if (finished) scheduleOnRN(commitNext);
          }),
        );
      }, loopDelay);
    },
    [commitNext, isMulti, loop, loopDelay, onSweepEnd, opacity, reducedMotion, shift],
  );

  useEffect(() => {
    if (!ready || !autoPlay) return;
    clearTimeout(timerRef.current);
    cancelAnimation(progress);
    cancelAnimation(opacity);
    cancelAnimation(shift);

    if (reducedMotion) {
      progress.set(1);
      opacity.set(1);
      shift.set(0);
      return;
    }

    const playing = index;
    if (isMulti) {
      shift.set(SWAP_SHIFT);
      opacity.set(0);
      shift.set(withTiming(0, { duration: ENTER_DURATION, easing: SWAP_EASING }));
      opacity.set(withTiming(1, { duration: ENTER_DURATION, easing: SWAP_EASING }));
    }

    progress.set(0);
    progress.set(
      withDelay(
        delay,
        withTiming(1, { duration, easing: SWEEP_EASING }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(handleSweepEnd, playing);
        }),
      ),
    );
  }, [
    autoPlay,
    cycle,
    delay,
    duration,
    handleSweepEnd,
    index,
    isMulti,
    opacity,
    progress,
    ready,
    reducedMotion,
    shift,
  ]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      cancelAnimation(progress);
      cancelAnimation(opacity);
      cancelAnimation(shift);
    },
    [opacity, progress, shift],
  );

  const stripStyle = useAnimatedStyle<Pick<ViewStyle, 'transform'>>(() => ({
    transform: [{ translateX: -(size.w + band) * (1 - progress.get()) }],
  }));
  const contentStyle = useAnimatedStyle<Pick<ViewStyle, 'opacity' | 'transform'>>(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: shift.get() }],
  }));
  const label = texts[index] ?? '';

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? texts.join(' ')}
      style={[styles.root, style]}
    >
      <Text accessible={false} onLayout={onSizerLayout} style={[textStyle, styles.sizer]}>
        {label}
      </Text>

      {ready ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, contentStyle]}>
          <MaskedView
            style={{ width: size.w, height: size.h }}
            maskElement={
              <Text accessible={false} style={[textStyle, styles.mask]}>
                {label}
              </Text>
            }
          >
            <Animated.View
              style={[{ width: sweepStripWidth(size.w, band), height: size.h }, stripStyle]}
            >
              <LinearGradient
                colors={gradient.colors as [string, string, ...string[]]}
                locations={gradient.locations as [number, number, ...number[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </MaskedView>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { justifyContent: 'center' },
  sizer: { opacity: 0 },
  mask: { color: '#000000', backgroundColor: 'transparent' },
});

export const DiaText = memo(DiaTextBase);
export { DiaTextBase };
export type { DiaTextProps } from './dia-text/types';
