import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, RoundedRect, type SkSize } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Type } from '../ui';
import { useTheme } from '../../theme';

export type BarChartPoint = {
  label: string;
  value: number;
  color?: string;
  formattedValue?: string;
};

type BarChartProps = {
  data: readonly BarChartPoint[];
  height?: number;
  accessibilityLabel: string;
  onSelectionChange?: (point: BarChartPoint | null) => void;
  showValueRow?: boolean;
};

function ChartBar({
  index,
  count,
  value,
  maximum,
  size,
  color,
  mutedColor,
  progress,
  selectedIndex,
}: {
  index: number;
  count: number;
  value: number;
  maximum: number;
  size: SharedValue<SkSize>;
  color: string;
  mutedColor: string;
  progress: SharedValue<number>;
  selectedIndex: SharedValue<number>;
}) {
  const slot = useDerivedValue(() => size.get().width / Math.max(count, 1));
  const barWidth = useDerivedValue(() => Math.max(8, Math.min(28, slot.get() * 0.46)));
  const animatedHeight = useDerivedValue(
    () => Math.max(2, (value / maximum) * size.get().height) * progress.get(),
  );
  const x = useDerivedValue(() => slot.get() * index + (slot.get() - barWidth.get()) / 2);
  const y = useDerivedValue(() => size.get().height - animatedHeight.get());
  const radius = useDerivedValue(() => Math.min(7, barWidth.get() / 2));
  const animatedColor = useDerivedValue(() =>
    selectedIndex.get() < 0 || selectedIndex.get() === index ? color : mutedColor,
  );

  return (
    <RoundedRect
      x={x}
      y={y}
      width={barWidth}
      height={animatedHeight}
      r={radius}
      color={animatedColor}
    />
  );
}

/** Skia bar chart forked from Reacticx and narrowed to portfolio allocation. */
export function BarChart({
  data,
  height,
  accessibilityLabel,
  onSelectionChange,
  showValueRow = true,
}: BarChartProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState(-1);
  const selectedIndex = useSharedValue(-1);
  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const maximum = Math.max(1, ...data.map((point) => point.value));

  useEffect(() => {
    cancelAnimation(progress);
    progress.set(reducedMotion ? 1 : 0);
    if (!reducedMotion) progress.set(withTiming(1, { duration: 420 }));
  }, [data, progress, reducedMotion]);

  const reportSelection = useCallback(
    (index: number) => {
      setSelected(index);
      onSelectionChange?.(index < 0 ? null : (data[index] ?? null));
    },
    [data, onSelectionChange],
  );

  useAnimatedReaction(
    () => selectedIndex.get(),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(reportSelection, current);
    },
    [reportSelection],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          const width = Math.max(1, canvasSize.get().width);
          selectedIndex.set(
            Math.max(0, Math.min(data.length - 1, Math.floor((event.x / width) * data.length))),
          );
        })
        .onUpdate((event) => {
          const width = Math.max(1, canvasSize.get().width);
          selectedIndex.set(
            Math.max(0, Math.min(data.length - 1, Math.floor((event.x / width) * data.length))),
          );
        })
        .onFinalize(() => selectedIndex.set(-1)),
    [canvasSize, data.length, selectedIndex],
  );
  const selectedPoint = selected >= 0 ? data[selected] : undefined;
  const summary = data
    .map((point) => `${point.label}, ${point.formattedValue ?? point.value}`)
    .join('. ');

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: colors.line }]}>
        <Type muted>No invested positions to chart yet.</Type>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${accessibilityLabel}. ${summary}`}
      accessibilityActions={data.map((point) => ({
        name: point.label,
        label: `Describe ${point.label}`,
      }))}
      onAccessibilityAction={(event) => {
        const index = data.findIndex((point) => point.label === event.nativeEvent.actionName);
        if (index >= 0) reportSelection(index);
      }}
      style={[styles.root, height === undefined ? styles.fill : { height }]}
    >
      {showValueRow ? (
        <View style={styles.valueRow}>
          <Type variant="caption" muted numberOfLines={1}>
            {selectedPoint
              ? `${selectedPoint.label} · ${selectedPoint.formattedValue ?? selectedPoint.value}`
              : 'Drag across the bars for details'}
          </Type>
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Canvas onSize={canvasSize} style={styles.canvas}>
          {data.map((point, index) => (
            <ChartBar
              key={point.label}
              index={index}
              count={data.length}
              value={point.value}
              maximum={maximum}
              size={canvasSize}
              color={point.color ?? colors.ink}
              mutedColor={colors.line}
              progress={progress}
              selectedIndex={selectedIndex}
            />
          ))}
        </Canvas>
      </GestureDetector>
      <View style={styles.labels}>
        {data.map((point) => (
          <Type key={point.label} variant="caption" muted numberOfLines={1} style={styles.label}>
            {point.label}
          </Type>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', minHeight: 0 },
  fill: { flex: 1 },
  canvas: { flex: 1, minHeight: 0 },
  valueRow: { height: 24, justifyContent: 'center' },
  labels: { flexDirection: 'row', paddingTop: 4 },
  label: { flex: 1, textAlign: 'center', minWidth: 0 },
  empty: {
    minHeight: 120,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 24,
  },
});
