import { useEffect, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions, type ScrollView } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedReaction,
  withDecay,
  withRepeat,
  withSpring,
  withTiming,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { formatUsd } from '@roundups/domain';
import {
  allocationHitFraction,
  allocationPath,
  allocationScrollState,
  allocationSegments,
} from '../lib/allocation';
import { AllocationAmount } from './allocation-amount';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import { CompanyMark } from './company-mark';
import { useTheme } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// Pull-to-refresh overscroll in raw scroll points: the dome flattens over the first
// stretch, then keeps bending into a half-depth smile. Releasing past half of the
// inversion (TRIGGER_PULL) fires the refresh. Beyond the full inversion only the
// system rubber band resists.
const PULL_FLATTEN = 60;
const PULL_INVERT = 80;
const PULL_MAX_INVERT = 0.5;
const TRIGGER_PULL = PULL_FLATTEN + PULL_INVERT / 2;
const MAX_PULL = PULL_FLATTEN + PULL_INVERT + 30;
const companyNames: Record<string, string> = {
  AMZN: 'Amazon',
  AAPL: 'Apple',
  NFLX: 'Netflix',
  CMG: 'Chipotle Mexican Grill',
  UBER: 'Uber Technologies',
  SBUX: 'Starbucks',
  USDC: 'USDC cash',
};
const USDC_COLOR = '#2775CA';
const palette: Record<string, string> = {
  SBUX: '#00754A',
  CMG: '#A33325',
  AAPL: '#9BA0A6',
  UBER: '#353535',
  AMZN: '#FF9900',
  NFLX: '#E50914',
  USDC: USDC_COLOR,
};
function Segment({
  start,
  end,
  progress,
  width,
  diameter,
  color,
  dimmed = false,
  flow,
  refreshing,
}: {
  start: number;
  end: number;
  progress: SharedValue<number>;
  width: number;
  diameter: number;
  color: string;
  dimmed?: boolean;
  flow: SharedValue<number>;
  refreshing: SharedValue<boolean>;
}) {
  const base = dimmed ? 0.52 : 1;
  const animatedProps = useAnimatedProps(() => {
    const p = progress.get();
    // While refreshing, a highlight sweeps around the dome once per cycle.
    const wave = refreshing.get()
      ? 0.38 +
        0.62 * (0.5 + 0.5 * Math.sin(((start + end) / 2) * 2 * Math.PI - flow.get() * 2 * Math.PI))
      : 1;
    return {
      d: allocationPath(start, end, p, width, diameter),
      strokeWidth: 0.4 * (1 - p),
      opacity: base * wave,
    };
  });
  return <AnimatedPath animatedProps={animatedProps} fill={color} stroke={color} />;
}

/** One viewport overlay and one empty layout slot: the drawing itself is never duplicated. */
export function useAllocationChart(
  markets: readonly { symbol: string; amountCents: number }[],
  options: { label?: string; onRefresh?: () => void; refreshing?: boolean } = {},
) {
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 600) - 48;
  const diameter = width;
  const reducedMotion = useReducedMotion();
  const scrollRef = useAnimatedRef<ScrollView>();
  const scrollY = useSharedValue(Platform.OS === 'ios' ? -top : 0);
  const anchor = useSharedValue(0);
  const [ready, setReady] = useState(false);
  // The neutral pending cap remains the final section at the right edge in both arc and strip.
  const segments = allocationSegments(markets, ['UBER']);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const selected = segments.find((segment) => segment.symbol === selectedSymbol);
  const chartLabel = options.label ?? 'Beaver';
  const glowColor = selected ? (palette[selected.symbol] ?? colors.green) : colors.green;
  const total = segments.reduce((sum, market) => sum + market.amountCents, 0);
  const minScroll = useSharedValue(-top);
  const maxScroll = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const dragOffset = useSharedValue(0);
  const dragging = useSharedValue(false);
  const tracking = useSharedValue(false);
  // iOS rests at -top; anything below that is rubber-band overscroll driving the arc.
  const pull = useDerivedValue(() => {
    const over = -(scrollY.get() + top);
    return over > 0 ? over : 0;
  });
  const flow = useSharedValue(0);
  const refreshingSv = useSharedValue(false);
  const hapticTick = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const fireRefresh = () => options.onRefresh?.();
  useEffect(() => {
    refreshingSv.set(!!options.refreshing);
    if (options.refreshing) {
      flow.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1));
    } else {
      cancelAnimation(flow);
      flow.set(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable
  }, [options.refreshing]);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
      // Never track into overscroll: the rest position stays the pull origin.
      minScroll.set(Math.min(minScroll.get(), -event.contentInset.top));
      maxScroll.set(
        Math.max(
          -event.contentInset.top,
          event.contentSize.height - event.layoutMeasurement.height + event.contentInset.bottom,
        ),
      );
    },
    onBeginDrag: () => {
      cancelAnimation(dragOffset);
      dragging.set(false);
      tracking.set(true);
    },
    onEndDrag: () => {
      tracking.set(false);
      if (pull.get() >= TRIGGER_PULL && !refreshingSv.get()) runOnJS(fireRefresh)();
    },
  });
  // A fling can deepen the bounce past the threshold only after the finger lifts.
  useAnimatedReaction(
    () => pull.get() >= TRIGGER_PULL && !refreshingSv.get(),
    (armed, wasArmed) => {
      if (armed && !wasArmed) {
        runOnJS(hapticTick)();
        if (!tracking.get()) runOnJS(fireRefresh)();
      }
    },
  );
  // The drawing lives above the scroll view; forward vertical drags on it to the same native scroller.
  useAnimatedReaction(
    () => (dragging.get() ? dragOffset.get() : null),
    (offset) => {
      if (offset !== null) scrollTo(scrollRef, 0, offset, false);
    },
  );
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      cancelAnimation(dragOffset);
      dragStart.set(scrollY.get());
      dragOffset.set(scrollY.get());
      dragging.set(true);
      tracking.set(true);
    })
    .onUpdate((event) => {
      dragOffset.set(
        Math.max(
          minScroll.get() - MAX_PULL,
          Math.min(maxScroll.get(), dragStart.get() - event.translationY),
        ),
      );
    })
    .onEnd((event) => {
      tracking.set(false);
      const overPull = minScroll.get() - dragOffset.get();
      if (overPull > 0) {
        if (overPull >= TRIGGER_PULL && !refreshingSv.get()) runOnJS(fireRefresh)();
        if (reducedMotion) {
          dragOffset.set(minScroll.get());
          dragging.set(false);
          return;
        }
        dragOffset.set(
          withSpring(
            minScroll.get(),
            { velocity: -event.velocityY, stiffness: 180, damping: 24 },
            () => dragging.set(false),
          ),
        );
        return;
      }
      if (reducedMotion) {
        dragging.set(false);
        return;
      }
      dragOffset.set(
        withDecay({ velocity: -event.velocityY, clamp: [minScroll.get(), maxScroll.get()] }, () => {
          dragging.set(false);
        }),
      );
    });
  const state = useDerivedValue(() => allocationScrollState(anchor.get() - scrollY.get() - top, 8));
  const progress = useDerivedValue(() => {
    const collapse = reducedMotion ? Number(state.get().collapse > 0.5) : state.get().collapse;
    const over = pull.get();
    const flatten = Math.min(over / PULL_FLATTEN, 1);
    const invert = reducedMotion
      ? 0
      : Math.max(0, Math.min((over - PULL_FLATTEN) / PULL_INVERT, 1)) * PULL_MAX_INVERT;
    return 1 - collapse - flatten - invert;
  });
  const showExpanded = () => {
    if (progress.get() < 0.95)
      scrollRef.current?.scrollTo({ y: minScroll.get(), animated: !reducedMotion });
  };
  const selectAt = (x: number, y: number) => {
    const p = progress.get();
    const t = allocationHitFraction(x, y, p, width, diameter);
    if (t === null) {
      setSelectedSymbol(null);
      return;
    }
    const segment = segments.find((item) => t >= item.start && t <= item.end);
    setSelectedSymbol((previous) => {
      const next = segment?.symbol === previous ? null : (segment?.symbol ?? null);
      if (next !== previous) void Haptics.selectionAsync().catch(() => {});
      return next;
    });
    if (p < 0.2) showExpanded();
  };
  const tap = Gesture.Tap()
    .enabled(Platform.OS !== 'web')
    .runOnJS(true)
    .onEnd((event, success) => {
      if (success) selectAt(event.x, event.y + 86 * (1 - progress.get()));
    });
  const slotHeight = diameter / 2 + 28;
  const glowHeight = slotHeight + 96;
  // A fixed document slot keeps the scroll-linked flattening reversible without reflow.
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: state.get().barTop }],
  }));
  const totalStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - (state.get().collapse + Math.min(pull.get() / PULL_FLATTEN, 1)) * 2.5),
  }));
  const hitStyle = useAnimatedStyle(() => {
    // The hit area follows the dome-to-strip morph only; the smile stays untappable.
    const p = Math.max(0, Math.min(1, progress.get()));
    return { top: 86 * (1 - p), height: 44 + (slotHeight - 44) * p };
  });
  const slot = (
    <Animated.View
      onLayout={(event) => {
        anchor.set(event.nativeEvent.layout.y);
        setReady(true);
      }}
      style={{ height: slotHeight }}
    />
  );
  const overlay = ready ? (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}
    >
      <Animated.View
        pointerEvents="box-none"
        style={[
          { position: 'absolute', left: (windowWidth - width) / 2, width, height: slotHeight },
          frameStyle,
        ]}
      >
        {segments.length > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left: -24, top: -24 }, totalStyle]}
          >
            <Svg width={width + 48} height={glowHeight} accessible={false}>
              <Defs>
                <RadialGradient id="allocationGlow" cx="50%" cy="42%" rx="50%" ry="42%">
                  <Stop offset="0" stopColor={glowColor} stopOpacity="0.24" />
                  <Stop offset="0.6" stopColor={glowColor} stopOpacity="0.09" />
                  <Stop offset="1" stopColor={glowColor} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#allocationGlow)" />
            </Svg>
          </Animated.View>
        ) : null}
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={width} height={Math.max(220, slotHeight)} accessible={false}>
            {segments.length === 0
              ? Array.from({ length: 72 }, (_, tick) => (
                  <Segment
                    key={`empty-${tick}`}
                    start={tick / 72}
                    end={(tick + 1) / 72}
                    progress={progress}
                    width={width}
                    diameter={diameter}
                    color={colors.line}
                    flow={flow}
                    refreshing={refreshingSv}
                  />
                ))
              : segments.flatMap((segment) =>
                  Array.from({ length: 72 }, (_, tick) => {
                    const start = Math.max(segment.start, tick / 72);
                    const end = Math.min(segment.end, (tick + 1) / 72);
                    return end > start ? (
                      <Segment
                        key={`${segment.symbol}-${tick}`}
                        start={start}
                        end={end}
                        progress={progress}
                        width={width}
                        diameter={diameter}
                        color={palette[segment.symbol] ?? colors.muted}
                        dimmed={!!selected && selected.symbol !== segment.symbol}
                        flow={flow}
                        refreshing={refreshingSv}
                      />
                    ) : null;
                  }),
                )}
          </Svg>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: diameter / 2 - 84, width, alignItems: 'center' },
            totalStyle,
          ]}
        >
          <AllocationAmount cents={selected?.amountCents ?? total} />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: width - 92 }}
          >
            {selected ? (
              selected.symbol === 'USDC' ? (
                <AppSymbol name="savings" color={USDC_COLOR} size={20} />
              ) : (
                <CompanyMark symbol={selected.symbol} size={20} />
              )
            ) : null}
            <Type
              variant="caption"
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}
              style={{ textAlign: 'center', flexShrink: 1 }}
            >
              {selected ? (companyNames[selected.symbol] ?? selected.symbol) : chartLabel}
            </Type>
          </View>
        </Animated.View>
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <Animated.View style={[{ position: 'absolute', width }, hitStyle]}>
            <Pressable
              onPress={
                Platform.OS === 'web'
                  ? (event) =>
                      selectAt(
                        event.nativeEvent.locationX,
                        event.nativeEvent.locationY + 86 * (1 - progress.get()),
                      )
                  : undefined
              }
              onAccessibilityTap={() => {
                setSelectedSymbol(null);
                showExpanded();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${selected ? (companyNames[selected.symbol] ?? selected.symbol) : chartLabel}, ${formatUsd(selected?.amountCents ?? total)}. ${segments.map((segment) => `${segment.symbol}, ${formatUsd(segment.amountCents)}`).join('. ')}`}
              accessibilityHint="Tap a colored section to select its company, or the center to show all. Scroll to flatten. Pull down to refresh. More actions select each company."
              accessibilityActions={[
                { name: 'all', label: 'Show all allocations' },
                ...segments.map((segment) => ({
                  name: segment.symbol,
                  label: `Show ${companyNames[segment.symbol] ?? segment.symbol}, ${formatUsd(segment.amountCents)}`,
                })),
              ]}
              onAccessibilityAction={(event) => {
                const next =
                  event.nativeEvent.actionName === 'all' ? null : event.nativeEvent.actionName;
                if (next !== selectedSymbol) void Haptics.selectionAsync().catch(() => {});
                setSelectedSymbol(next);
                showExpanded();
              }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  ) : null;
  return { slot, overlay, onScroll, scrollRef };
}
