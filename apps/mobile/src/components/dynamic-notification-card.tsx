import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas, RoundedRect, Group, Blur, ColorMatrix, Paint } from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  useReducedMotion,
  useDerivedValue,
  interpolateColor,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { getNotificationLayout } from '../vendor/dynamic-notifications/helpers/get-notification-layout';
import { useNotificationGeometry } from '../vendor/dynamic-notifications/hooks/use-notification-geometry';
import type { InAppNotice } from '../lib/dynamic-notification-events';

export function DynamicNotificationCard({
  notice,
  onOpen,
  onDismiss,
}: {
  notice: InAppNotice;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // Insets, not a guessed device model. Larger type and non-island devices get a plain card.
  const morph = !reduced && Platform.OS === 'ios' && insets.top >= 59 && fontScale <= 1.3;
  const layout = getNotificationLayout({
    width,
    insetTop: insets.top,
    cardHeight: 100,
    cardRadius: 28,
    gap: 20,
  });
  const drop = useSharedValue(0);
  const expand = useSharedValue(0);
  const reveal = useSharedValue(0);
  const drag = useSharedValue(0);
  const closing = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );
  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    reveal.set(withTiming(0, { duration: 150 }));
    if (!reduced) {
      expand.set(withSpring(0, { duration: 300, dampingRatio: 1 }));
      drop.set(withSpring(0, { duration: 300, dampingRatio: 1 }));
    }
    exitTimer.current = setTimeout(onDismiss, 180);
  };
  const geometry = useNotificationGeometry({ drop, expand, layout });
  const dropletColor = useDerivedValue(
    () => interpolateColor(expand.get(), [0, 1], ['#000000', colors.surface]),
    [colors.surface],
  );
  useEffect(() => {
    drop.set(withSpring(1, { duration: 600, dampingRatio: 1 }));
    expand.set(withDelay(120, withSpring(1, { duration: 450, dampingRatio: 1 })));
    reveal.set(withDelay(morph ? 250 : 0, withTiming(1, { duration: 180 })));
    AccessibilityInfo.announceForAccessibility(`${notice.title}. ${notice.message}`);
  }, [drop, expand, reveal, morph, notice.title, notice.message]);
  const animated = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateY: drag.get() + (morph ? geometry.offsetY.get() : 0) }],
  }));
  const gesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      drag.set(Math.min(20, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY < -30 || event.velocityY < -420) scheduleOnRN(dismiss);
      else drag.set(withSpring(0, { duration: 300, dampingRatio: 1, velocity: event.velocityY }));
    });
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      {morph ? (
        <Canvas
          pointerEvents="none"
          style={{ position: 'absolute', width, height: layout.canvasHeight }}
        >
          <Group
            layer={
              <Paint>
                <Blur blur={8} />
                <ColorMatrix
                  matrix={[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 22, -9.46]}
                />
              </Paint>
            }
          >
            <RoundedRect
              x={layout.centerX - layout.islandWidth / 2}
              y={layout.islandTop}
              width={layout.islandWidth}
              height={layout.islandHeight}
              r={layout.islandRadius}
              color="#000000"
            />
            <RoundedRect
              x={geometry.neckX}
              y={geometry.neckY}
              width={geometry.neckWidth}
              height={geometry.neckHeight}
              r={geometry.neckRadius}
              color="#000000"
            />
            <RoundedRect
              x={geometry.x}
              y={geometry.y}
              width={geometry.width}
              height={geometry.height}
              r={geometry.radius}
              color={dropletColor}
            />
          </Group>
        </Canvas>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              marginTop: morph ? layout.cardTop : insets.top + 8,
              marginHorizontal: 16,
              borderRadius: 28,
              borderCurve: 'continuous',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            },
            animated,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={onOpen}
              accessibilityRole="button"
              accessibilityLabel={`${notice.title}. ${notice.message}`}
              onAccessibilityEscape={dismiss}
              style={({ pressed }) => ({
                flex: 1,
                padding: 18,
                opacity: pressed ? 0.65 : 1,
                minHeight: 100,
              })}
            >
              <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 17 }}>
                {notice.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
                {notice.message}
              </Text>
            </Pressable>
            {notice.kind === 'sync' ? <ActivityIndicator color={colors.ink} /> : null}
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 24 }}>×</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
