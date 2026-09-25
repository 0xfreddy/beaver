import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import { useTheme } from '../theme';

const THUMB_SIZE = 46;
const TRACK_PADDING = 5;
const TRACK_HEIGHT = THUMB_SIZE + TRACK_PADDING * 2;
const GRAB_SLOP = 14;
const ARM_FRACTION = 0.72;
const COMMIT_VELOCITY = 550;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function armTick() {
  void Haptics.selectionAsync().catch(() => {});
}

/**
 * Cash-out style slide-to-confirm control: the thumb travels the pill track and
 * commits only when dragged fully (or flicked past the arming point), otherwise
 * it springs home. VoiceOver and reduced-motion users confirm with a double-tap.
 */
export function SlideToConfirm({
  label,
  hint,
  onConfirm,
  disabled = false,
  busy = false,
  resetSignal = 0,
}: {
  label: string;
  hint: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  resetSignal?: number;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(0);
  const startX = useSharedValue(0);
  const grabbed = useSharedValue(0);
  const armed = useSharedValue(0);
  const committed = useSharedValue(0);
  const activated = useRef(false);
  const travel = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PADDING * 2);
  const inactive = disabled || busy;

  useEffect(() => {
    activated.current = false;
    committed.set(0);
    armed.set(0);
    position.set(reducedMotion ? 0 : withSpring(0, { stiffness: 300, damping: 28, overshootClamping: true }));
    // resetSignal changes snap a completed slider back to its start.
  }, [resetSignal, armed, committed, position, reducedMotion]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!inactive && travel > 0)
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onStart((event) => {
          // Only a touch that begins on (or beside) the thumb picks it up; the
          // rest of the track stays inert like Cash App's slide-to-pay.
          const thumbLeft = TRACK_PADDING + position.get();
          const canGrab = event.x >= thumbLeft - GRAB_SLOP && event.x <= thumbLeft + THUMB_SIZE + GRAB_SLOP;
          grabbed.set(canGrab ? 1 : 0);
          if (canGrab) {
            startX.set(position.get());
            scheduleOnRN(armTick);
          }
        })
        .onUpdate((event) => {
          if (!grabbed.get()) return;
          const next = clamp(startX.get() + event.translationX, 0, travel);
          position.set(next);
          if (travel <= 0) return;
          if (next >= travel * ARM_FRACTION && !armed.get()) {
            armed.set(1);
            scheduleOnRN(armTick);
          } else if (next < travel * ARM_FRACTION && armed.get()) {
            armed.set(0);
          }
        })
        .onEnd((event) => {
          if (!grabbed.get() || committed.get()) return;
          grabbed.set(0);
          const current = position.get();
          const projected = current + event.velocityX / 6;
          const shouldCommit =
            travel > 0 &&
            (current >= travel - 0.5 || (current >= travel * ARM_FRACTION && projected >= travel * 0.96) ||
              (current > 0 && event.velocityX > COMMIT_VELOCITY && projected >= travel));
          if (shouldCommit) {
            committed.set(1);
            position.set(
              reducedMotion
                ? travel
                : withSpring(travel, { stiffness: 380, damping: 32, overshootClamping: true }),
            );
            scheduleOnRN(onConfirm);
          } else {
            armed.set(0);
            position.set(
              reducedMotion ? 0 : withSpring(0, { stiffness: 300, damping: 28, overshootClamping: true }),
            );
          }
        })
        .onFinalize(() => {
          grabbed.set(0);
        }),
    [inactive, onConfirm, position, reducedMotion, startX, travel, armed, committed, grabbed],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: clamp(position.get(), 0, travel || 0) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: travel > 0 ? clamp(1 - (position.get() / travel) * 1.6, 0, 1) : 1,
  }));
  const nextOpacity = useAnimatedStyle(() => ({ opacity: clamp(1 - armed.get(), 0, 1) }));
  const checkOpacity = useAnimatedStyle(() => ({ opacity: clamp(armed.get(), 0, 1) }));

  function activate() {
    if (inactive || activated.current) return;
    activated.current = true;
    committed.set(1);
    armed.set(1);
    position.set(travel);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm();
  }

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive }}
      onAccessibilityTap={activate}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') activate();
      }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[
        styles.track,
        {
          borderColor: colors.line,
          backgroundColor: colors.accent,
          opacity: inactive ? 0.45 : 1,
        },
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.thumb,
              thumbStyle,
              { backgroundColor: colors.accentInk, shadowColor: '#000000' },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Animated.View style={[StyleSheet.absoluteFill, styles.thumbGlyph, nextOpacity]}>
                  <AppSymbol name="next" color={colors.accent} size={19} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, styles.thumbGlyph, checkOpacity]}>
                  <AppSymbol name="check" color={colors.accent} size={19} />
                </Animated.View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
        <Type style={[styles.label, { color: colors.accentInk }]}>{label}</Type>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    left: TRACK_PADDING,
    top: TRACK_PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbGlyph: { alignItems: 'center', justifyContent: 'center' },
  labelWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: 0.2 },
});
