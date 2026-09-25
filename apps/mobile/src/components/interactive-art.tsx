/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static bundled image paths. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, type ImageSourcePropType } from 'react-native';
import { useIsFocused, useNavigation } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** One raster turn in the screen plane. Only the image transforms; its target stays still. */
export function InteractiveArt({
  source,
  name,
  size = 140,
  active = true,
}: {
  source: ImageSourcePropType;
  name: string;
  size?: number;
  active?: boolean;
}) {
  const turn = useSharedValue(0),
    opacity = useSharedValue(1);
  const busy = useRef(false),
    generation = useRef(0);
  const focused = useIsFocused(),
    navigation = useNavigation();
  const [reduced, setReduced] = useState(true);
  const cancel = useCallback(() => {
    generation.current += 1;
    busy.current = false;
    cancelAnimation(turn);
    cancelAnimation(opacity);
    turn.set(0);
    opacity.set(1);
  }, [turn, opacity]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    cancel();
    return cancel;
  }, [active, focused, reduced, source, cancel]);
  useEffect(() => navigation.addListener('beforeRemove', cancel), [navigation, cancel]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get()}deg` }],
    opacity: opacity.get(),
  }));
  function finished(token: number) {
    if (generation.current === token) busy.current = false;
  }
  function spin() {
    if (busy.current || !active || !focused) return;
    busy.current = true;
    const token = ++generation.current;
    if (reduced) {
      opacity.set(0.55);
      opacity.set(
        withTiming(1, { duration: 160 }, (complete) => {
          if (complete) scheduleOnRN(finished, token);
        }),
      );
    } else {
      turn.set(0);
      turn.set(
        withTiming(360, { duration: 650, easing: Easing.out(Easing.cubic) }, (complete) => {
          if (complete) {
            turn.set(0);
            scheduleOnRN(finished, token);
          }
        }),
      );
    }
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Spin ${name}`}
      accessibilityHint={
        reduced ? 'Briefly highlights the artwork' : 'Rotates the artwork clockwise once'
      }
      onPress={spin}
      style={{
        width: size,
        height: size,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* A square's diagonal fits: 0.70 × sqrt(2) < 1, even for opaque legacy art. */}
      <Animated.View style={[{ width: size * 0.7, height: size * 0.7 }, style]}>
        <Image
          source={source}
          resizeMode="contain"
          accessible={false}
          fadeDuration={0}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </Pressable>
  );
}
export const socialArt = {
  orbit: require('../../assets/social/leaderboard-orbit.png'),
  invite: require('../../assets/social/invite-link.png'),
  friends: require('../../assets/social/friends-circle.png'),
};
