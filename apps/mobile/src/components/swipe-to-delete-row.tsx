import { useEffect, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import { useTheme } from '../theme';

const ACTION_WIDTH = 84;
const SNAP_SPRING = { damping: 34, stiffness: 420, mass: 0.9 } as const;
/** Flick past this speed opens/closes regardless of how far the row was dragged. */
const FLICK_VELOCITY = 320;

/**
 * The iOS list swipe: drag a row left to reveal a Delete action pinned behind
 * its right edge. Only one row stays open at a time (the parent drives that by
 * flipping `open`), and VoiceOver users delete through the custom action.
 */
export function SwipeToDeleteRow({
  children,
  open,
  busy = false,
  onOpenChange,
  onDelete,
  accessibilityLabel,
  accessibilityHint,
}: PropsWithChildren<{
  open: boolean;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
}>) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const dragging = useSharedValue(0);
  const settledOpen = useSharedValue(0);

  useEffect(() => {
    if (dragging.get()) return;
    const target = open ? -ACTION_WIDTH : 0;
    settledOpen.set(open ? 1 : 0);
    translateX.set(
      reducedMotion
        ? withTiming(target, { duration: 140 })
        : withSpring(target, { ...SNAP_SPRING, velocity: 0, overshootClamping: false }),
    );
  }, [open, reducedMotion, settledOpen, translateX, dragging]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!busy)
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onUpdate((event) => {
          dragging.set(1);
          // Rubber-band a little past the action before stopping dead.
          const over = Math.min(event.translationX, 0);
          const excess = over < -ACTION_WIDTH ? -ACTION_WIDTH + (over + ACTION_WIDTH) * 0.2 : over;
          translateX.set(Math.max(excess, -ACTION_WIDTH - 28));
        })
        .onEnd((event) => {
          const current = translateX.get();
          const shouldOpen =
            current < -ACTION_WIDTH / 2 ||
            (settledOpen.get() && current < -12) ||
            event.velocityX < -FLICK_VELOCITY;
          const shouldClose = current > -ACTION_WIDTH / 2 || event.velocityX > FLICK_VELOCITY;
          const target = shouldOpen && !shouldClose ? -ACTION_WIDTH : 0;
          settledOpen.set(target === 0 ? 0 : 1);
          translateX.set(
            reducedMotion
              ? withTiming(target, { duration: 140 })
              : withSpring(target, { ...SNAP_SPRING, velocity: event.velocityX }),
          );
          scheduleOnRN(onOpenChange, target !== 0);
        })
        .onFinalize(() => {
          dragging.set(0);
          // A vertical fail or a tiny aborted drag snaps back to the settled state.
          if (translateX.get() !== 0 && translateX.get() !== -ACTION_WIDTH) {
            const target = settledOpen.get() ? -ACTION_WIDTH : 0;
            translateX.set(
              reducedMotion
                ? withTiming(target, { duration: 140 })
                : withSpring(target, SNAP_SPRING),
            );
          }
        }),
    [busy, dragging, onOpenChange, reducedMotion, settledOpen, translateX],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));

  function close() {
    if (!open) return;
    void Haptics.selectionAsync().catch(() => {});
    onOpenChange(false);
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={busy ? [] : [{ name: 'delete' }, { name: 'dismiss' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') onDelete();
        else if (event.nativeEvent.actionName === 'dismiss') close();
      }}
    >
      <View style={styles.underlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onDelete}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.82 }]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <AppSymbol name="trash" color="#FFFFFF" size={22} />
              <Type style={styles.actionLabel}>Delete</Type>
            </>
          )}
        </Pressable>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, { backgroundColor: colors.background }, rowStyle]}>
          <Pressable
            disabled={!open || busy}
            onPress={close}
            style={styles.contentPress}
          >
            {children}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  underlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#E5484D',
  },
  actionLabel: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  content: { flex: 1 },
  contentPress: { flex: 1 },
});
