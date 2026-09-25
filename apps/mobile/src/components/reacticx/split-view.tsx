import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../../theme';

type SplitViewContextValue = {
  topHeight: SharedValue<number>;
  handleScale: SharedValue<number>;
  gap: number;
  minTop: number;
  maxTop: number;
  gesture: ReturnType<typeof Gesture.Pan>;
  settle: (target: number) => void;
};

type SplitViewRootProps = {
  children: ReactNode;
  initialTopHeight?: number;
  minTopHeight?: number;
  minBottomHeight?: number;
  maxTopHeight?: number;
  gap?: number;
  snapPoints?: readonly number[];
  velocityThreshold?: number;
  springConfig?: WithSpringConfig;
  onHeightChange?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
  fullBleed?: boolean;
};

type SplitViewPaneProps = { children: ReactNode; style?: StyleProp<ViewStyle> };
type SplitViewHandleProps = {
  color?: string;
  style?: StyleProp<ViewStyle>;
  barStyle?: StyleProp<ViewStyle>;
};

const DEFAULT_SPRING: WithSpringConfig = {
  damping: 20,
  stiffness: 150,
  mass: 0.5,
  overshootClamping: true,
};
const DEFAULT_GAP = 25;
const DEFAULT_INITIAL_TOP_HEIGHT = 280;
const DEFAULT_MIN_TOP_HEIGHT = 120;
const DEFAULT_MIN_BOTTOM_HEIGHT = 150;
const DEFAULT_VELOCITY_THRESHOLD = 700;
const HANDLE_HIT_SLOP = 14;

function splitHaptic() {
  void Haptics.selectionAsync().catch(() => {});
}

const Context = createContext<SplitViewContextValue | null>(null);

function useSplitView(component: string) {
  const value = useContext(Context);
  if (!value) throw new Error(`${component} must be rendered inside SplitView.Root.`);
  return value;
}

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
}

function nearestSnap(value: number, points: readonly number[]) {
  'worklet';
  let nearest = points[0] ?? value;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    if (Math.abs(point - value) < Math.abs(nearest - value)) nearest = point;
  }
  return nearest;
}

function resolveSnapTarget(
  value: number,
  velocity: number,
  points: readonly number[],
  velocityThreshold: number,
) {
  'worklet';
  if (Math.abs(velocity) < velocityThreshold) return nearestSnap(value, points);

  if (velocity > 0) {
    return points.find((point) => point > value + 20) ?? points[points.length - 1] ?? value;
  }

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]!;
    if (point < value - 20) return point;
  }
  return points[0] ?? value;
}

function SplitViewRoot({
  children,
  initialTopHeight = DEFAULT_INITIAL_TOP_HEIGHT,
  minTopHeight = DEFAULT_MIN_TOP_HEIGHT,
  minBottomHeight = DEFAULT_MIN_BOTTOM_HEIGHT,
  maxTopHeight,
  gap = DEFAULT_GAP,
  snapPoints,
  velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
  springConfig = DEFAULT_SPRING,
  onHeightChange,
  style,
  fullBleed = false,
}: SplitViewRootProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [containerHeight, setContainerHeight] = useState(0);
  const topHeight = useSharedValue(initialTopHeight);
  const startHeight = useSharedValue(initialTopHeight);
  const handleScale = useSharedValue(1);
  const minTop = minTopHeight;
  const maxTop =
    maxTopHeight ??
    (containerHeight > 0
      ? Math.max(minTop + 1, containerHeight - gap - minBottomHeight)
      : Math.max(minTop + 1, initialTopHeight));
  const resolvedSnapPoints = useMemo(() => {
    const requested = snapPoints?.length ? snapPoints : [minTop, (minTop + maxTop) / 2, maxTop];
    return [...new Set(requested.map((point) => clamp(point, minTop, maxTop)))].sort(
      (a, b) => a - b,
    );
  }, [maxTop, minTop, snapPoints]);

  const settle = useCallback(
    (target: number) => {
      const bounded = clamp(target, minTop, maxTop);
      topHeight.set(reducedMotion ? bounded : withSpring(bounded, springConfig));
      onHeightChange?.(bounded);
    },
    [maxTop, minTop, onHeightChange, reducedMotion, springConfig, topHeight],
  );

  useEffect(() => {
    if (containerHeight <= 0) return;
    const bounded = clamp(topHeight.get(), minTop, maxTop);
    if (bounded !== topHeight.get()) settle(bounded);
  }, [containerHeight, maxTop, minTop, settle, topHeight]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ top: HANDLE_HIT_SLOP, bottom: HANDLE_HIT_SLOP })
        .onStart(() => {
          scheduleOnRN(splitHaptic);
          startHeight.set(topHeight.get());
          handleScale.set(
            reducedMotion ? 1 : withSpring(1.18, { ...springConfig, overshootClamping: true }),
          );
        })
        .onUpdate((event) => {
          topHeight.set(clamp(startHeight.get() + event.translationY, minTop, maxTop));
        })
        .onEnd((event) => {
          const velocity = clamp(event.velocityY, -4_000, 4_000);
          const target = resolveSnapTarget(
            topHeight.get(),
            velocity,
            resolvedSnapPoints,
            velocityThreshold,
          );
          topHeight.set(
            reducedMotion
              ? target
              : withSpring(target, {
                  ...springConfig,
                  overshootClamping: true,
                }),
          );
          if (onHeightChange) scheduleOnRN(onHeightChange, target);
          scheduleOnRN(splitHaptic);
        })
        .onFinalize(() => {
          handleScale.set(
            reducedMotion ? 1 : withSpring(1, { ...springConfig, overshootClamping: true }),
          );
        }),
    [
      handleScale,
      maxTop,
      minTop,
      onHeightChange,
      reducedMotion,
      resolvedSnapPoints,
      springConfig,
      startHeight,
      topHeight,
      velocityThreshold,
    ],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerHeight(event.nativeEvent.layout.height);
  }, []);
  const context = useMemo(
    () => ({ topHeight, handleScale, gap, minTop, maxTop, gesture, settle }),
    [gap, gesture, handleScale, maxTop, minTop, settle, topHeight],
  );

  return (
    <Context.Provider value={context}>
      <GestureHandlerRootView
        onLayout={onLayout}
        style={[
          styles.root,
          fullBleed && styles.fullBleed,
          { backgroundColor: colors.background, borderColor: colors.line },
          style,
        ]}
      >
        {children}
      </GestureHandlerRootView>
    </Context.Provider>
  );
}

function SplitViewTop({ children, style }: SplitViewPaneProps) {
  const { topHeight, minTop, maxTop } = useSplitView('SplitView.Top');
  const animatedStyle = useAnimatedStyle(() => ({
    height: topHeight.get(),
    opacity: interpolate(
      topHeight.get(),
      [minTop, Math.min(maxTop, minTop + 60)],
      [0.2, 1],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Animated.View style={[styles.pane, styles.top, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

function SplitViewHandle({ color, style, barStyle }: SplitViewHandleProps) {
  const { colors } = useTheme();
  const { gesture, handleScale, gap, minTop, maxTop, settle } = useSplitView('SplitView.Handle');
  const barAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: handleScale.get() }],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Portfolio split position"
        accessibilityHint="Adjusts the space between holdings and allocation chart"
        accessibilityActions={[
          { name: 'increment', label: 'Give holdings more space' },
          { name: 'decrement', label: 'Give the chart more space' },
        ]}
        onAccessibilityAction={(event) =>
          settle(event.nativeEvent.actionName === 'increment' ? maxTop : minTop)
        }
        style={[styles.handleHitArea, { height: gap }, style]}
      >
        <Animated.View
          style={[
            styles.handleBar,
            { backgroundColor: color ?? colors.muted },
            barAnimatedStyle,
            barStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function SplitViewBottom({ children, style }: SplitViewPaneProps) {
  const { topHeight, minTop, maxTop } = useSplitView('SplitView.Bottom');
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      topHeight.get(),
      [Math.max(minTop, maxTop - 60), maxTop],
      [1, 0.2],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Animated.View style={[styles.pane, styles.bottom, styles.flex, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

export const SplitView = Object.assign(SplitViewRoot, {
  Root: SplitViewRoot,
  Top: SplitViewTop,
  Handle: SplitViewHandle,
  Bottom: SplitViewBottom,
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  fullBleed: { borderRadius: 0, borderWidth: 0 },
  flex: { flex: 1 },
  pane: { overflow: 'hidden' },
  top: {
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderCurve: 'continuous',
  },
  bottom: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderCurve: 'continuous',
  },
  handleHitArea: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  handleBar: { width: 44, height: 5, borderRadius: 3, opacity: 0.42 },
});
