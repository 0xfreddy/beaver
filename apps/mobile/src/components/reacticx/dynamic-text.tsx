import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { BlurView, type BlurViewProps } from 'expo-blur';
import Animated, {
  interpolate,
  LinearTransition,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DEFAULT_DOT, DEFAULT_TEXT, DEFAULT_TIMING } from './dynamic-text/const';
import { getAnimationPreset, normalizeItems } from './dynamic-text/helpers';
import type { DotConfig, DynamicTextProps, TextConfig, TimingConfig } from './dynamic-text/types';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/**
 * Reacticx Dynamic Text ported from the pinned upstream component. Local changes
 * are limited to Reanimated 4 accessors, stable item memoization, and Reduce Motion.
 * Source: https://github.com/rit3zh/reacticx/tree/main/src/components/molecules/dynamic-text
 */
export const DynamicText = memo(function DynamicText({
  items,
  loop = false,
  loopCount = -1,
  animationPreset = 'fade',
  animationDirection = 'up',
  customEntering,
  customExiting,
  timing,
  dot,
  text,
  containerStyle,
  contentStyle,
  onAnimationComplete,
  onIndexChange,
  paused = false,
  initialIndex = 0,
  accessibilityLabel,
}: DynamicTextProps) {
  const reducedMotion = useReducedMotion();
  const timingConfig: TimingConfig = { ...DEFAULT_TIMING, ...timing };
  const dotConfig: DotConfig = { ...DEFAULT_DOT, ...dot };
  const textConfig: TextConfig = { ...DEFAULT_TEXT, ...text };
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(normalizedItems.length - 1, 0),
  );
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [isAnimating, setIsAnimating] = useState(true);
  const [currentLoop, setCurrentLoop] = useState(0);
  const progress = useSharedValue(0);
  const animationConfig = getAnimationPreset(
    animationPreset,
    animationDirection,
    timingConfig.animationDuration,
  );
  const entering = reducedMotion ? undefined : (customEntering ?? animationConfig.entering);
  const exiting = reducedMotion ? undefined : (customExiting ?? animationConfig.exiting);

  const handleIndexChange = useCallback(
    (index: number) => {
      const item = normalizedItems[index];
      if (item) onIndexChange?.(index, item);
    },
    [normalizedItems, onIndexChange],
  );

  useEffect(() => {
    if (!isAnimating || paused || reducedMotion || normalizedItems.length < 2) return;

    const interval = setInterval(() => {
      setCurrentIndex((previousIndex) => {
        const nextIndex = previousIndex + 1;
        if (nextIndex >= normalizedItems.length) {
          if (loop && (loopCount === -1 || currentLoop < loopCount - 1)) {
            setCurrentLoop((previous) => previous + 1);
            handleIndexChange(0);
            return 0;
          }
          clearInterval(interval);
          setIsAnimating(false);
          onAnimationComplete?.();
          return previousIndex;
        }
        handleIndexChange(nextIndex);
        return nextIndex;
      });

      progress.set(
        withTiming(1, { duration: timingConfig.animationDuration }, () => progress.set(0)),
      );
    }, timingConfig.interval);

    return () => clearInterval(interval);
  }, [
    currentLoop,
    handleIndexChange,
    isAnimating,
    loop,
    loopCount,
    normalizedItems.length,
    onAnimationComplete,
    paused,
    progress,
    reducedMotion,
    timingConfig.animationDuration,
    timingConfig.interval,
  ]);

  const currentItem = normalizedItems[currentIndex];
  const dotStyle: StyleProp<ViewStyle> = {
    height: dotConfig.size,
    width: dotConfig.size,
    borderRadius: dotConfig.size / 2,
    backgroundColor: dotConfig.color,
    ...dotConfig.style,
  };
  const resolvedTextStyle: StyleProp<TextStyle> = {
    fontSize: textConfig.fontSize,
    fontWeight: textConfig.fontWeight,
    color: textConfig.color,
    ...textConfig.style,
  };
  const animatedBlurViewProps = useAnimatedProps<Pick<BlurViewProps, 'intensity'>>(() => ({
    intensity: interpolate(progress.get(), [0, 0.5, 1], [0, 15, 0]),
  }));

  if (!currentItem) return null;
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? currentItem.text}
      accessibilityRole="text"
      style={[styles.container, containerStyle]}
    >
      <View style={[styles.textContainer, contentStyle]}>
        <Animated.View
          key={`${currentItem.id}-${currentLoop}`}
          entering={entering}
          exiting={exiting}
          layout={reducedMotion ? undefined : LinearTransition}
          style={styles.content}
        >
          {dotConfig.visible ? <View style={dotStyle} /> : null}
          <Text accessible={false} style={resolvedTextStyle}>
            {currentItem.text}
          </Text>
          {Platform.OS === 'ios' && !reducedMotion ? (
            <AnimatedBlurView
              animatedProps={animatedBlurViewProps}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  textContainer: {
    height: 64,
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export type { DynamicTextItem, DynamicTextProps } from './dynamic-text/types';
