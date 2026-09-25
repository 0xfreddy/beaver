import { useEffect, useMemo, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  LinearTransition,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Type } from '../ui';
import { useTheme } from '../../theme';

type TrayProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
};

const SPRING = { damping: 36, stiffness: 360, mass: 0.9, overshootClamping: true };
const RESIZE = LinearTransition.duration(220).easing(Easing.bezier(0.23, 1, 0.32, 1));

/** Reacticx Tray adapted with modal semantics, escape handling, and safe-area padding. */
export function Tray({
  visible,
  title,
  subtitle,
  children,
  footer,
  onClose,
  dismissible = true,
}: TrayProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const present = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    dragY.set(0);
    present.set(reducedMotion ? 1 : withSpring(1, SPRING));
  }, [dragY, present, reducedMotion, visible]);

  const close = () => {
    if (!dismissible) return;
    if (reducedMotion) {
      onClose();
      return;
    }
    present.set(withSpring(0, SPRING, (finished) => finished && scheduleOnRN(onClose)));
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissible)
        .activeOffsetY([-8, 8])
        .failOffsetX([-18, 18])
        .onUpdate((event) => {
          dragY.set(event.translationY < 0 ? event.translationY * 0.18 : event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > 88 || event.velocityY > 850) {
            present.set(
              reducedMotion
                ? 0
                : withSpring(0, { ...SPRING, velocity: event.velocityY }, (finished) =>
                    finished ? scheduleOnRN(onClose) : undefined,
                  ),
            );
            if (reducedMotion) scheduleOnRN(onClose);
          } else {
            dragY.set(reducedMotion ? 0 : withSpring(0, { ...SPRING, velocity: event.velocityY }));
          }
        }),
    [dismissible, dragY, onClose, present, reducedMotion],
  );

  const trayStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? present.get() : 1,
    transform: [
      { translateY: (1 - present.get()) * 520 + dragY.get() },
      { scale: reducedMotion ? 1 : 0.98 + present.get() * 0.02 },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      present.get() *
      interpolate(Math.max(0, dragY.get()), [0, 360], [1, 0.25], Extrapolation.CLAMP),
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.frame} onAccessibilityEscape={close}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss confirmation"
            disabled={!dismissible}
            onPress={close}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.42)' },
            ]}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            layout={reducedMotion ? undefined : RESIZE}
            style={[
              styles.tray,
              trayStyle,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: colors.surface,
                borderColor: colors.line,
              },
            ]}
          >
            <View style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.muted }]} />
            </View>
            <View style={styles.header}>
              <Type variant="title" accessibilityRole="header">
                {title}
              </Type>
              {subtitle ? <Type muted>{subtitle}</Type> : null}
            </View>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  tray: {
    maxHeight: '92%',
    borderTopWidth: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  handleArea: { height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 38, height: 5, borderRadius: 3, opacity: 0.38 },
  header: { gap: 8, paddingHorizontal: 24, paddingBottom: 16 },
  // Tall bodies shrink instead of pushing the footer past the tray's max height.
  body: { gap: 14, paddingHorizontal: 24, paddingBottom: 20, flexShrink: 1 },
  footer: { gap: 10, paddingHorizontal: 24, paddingTop: 4 },
});
