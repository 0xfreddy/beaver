import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Paint,
  rect,
  rrect,
  useImage,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { avatarFor } from '../../lib/avatars';
import { useTheme } from '../../theme';
import { AppSymbol } from '../app-symbol';

const matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 22, -9];

/** Metaball profile interaction adapted from rit3zh/expo-meatball-animation. */
export function MetaballProfileAvatar({ id, onPress }: { id: string; onPress: () => void }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const image = useImage(avatarFor(id).source);
  const lift = useSharedValue(0);
  const satelliteX = useDerivedValue(() => 101 + lift.get() * 15);
  const satelliteY = useDerivedValue(() => 72 - lift.get() * 17);
  const satelliteStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lift.get() * 15 },
      { translateY: lift.get() * -17 },
      { scale: 0.94 + lift.get() * 0.06 },
    ],
  }));

  const animate = () => {
    if (reducedMotion) return;
    lift.set(
      withSequence(
        withSpring(1, { stiffness: 360, damping: 22 }),
        withDelay(180, withSpring(0, { stiffness: 310, damping: 24 })),
      ),
    );
  };

  useEffect(() => {
    if (reducedMotion) return;
    lift.set(
      withDelay(
        420,
        withSequence(
          withSpring(1, { stiffness: 320, damping: 24 }),
          withDelay(220, withSpring(0, { stiffness: 280, damping: 24 })),
        ),
      ),
    );
  }, [lift, reducedMotion]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit profile photo"
      onPressIn={animate}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={styles.root}
    >
      <Canvas style={styles.canvas}>
        <Group
          layer={
            <Paint>
              <Blur blur={8} />
              <ColorMatrix matrix={matrix} />
            </Paint>
          }
        >
          <Circle cx={60} cy={58} r={46} color={colors.ink} />
          <Circle cx={satelliteX} cy={satelliteY} r={19} color={colors.ink} />
        </Group>
        {image ? (
          <Group clip={rrect(rect(16, 14, 88, 88), 44, 44)}>
            <SkiaImage image={image} x={16} y={14} width={88} height={88} fit="cover" />
          </Group>
        ) : null}
      </Canvas>
      <Animated.View
        pointerEvents="none"
        style={[styles.satellite, satelliteStyle, { backgroundColor: colors.ink }]}
      >
        <AppSymbol name="edit" color={colors.background} size={15} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { width: 136, height: 116 },
  canvas: { width: 136, height: 116 },
  satellite: {
    position: 'absolute',
    left: 82,
    top: 53,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
