import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Reacticx Verified Shine sweep, masked to the coin's actual alpha silhouette. */
function ShiningCoin({ source, size }: { source: ImageSourcePropType; size: number }) {
  const progress = useSharedValue(0);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setReduced(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    cancelAnimation(progress);
    progress.set(0);
    if (!reduced)
      progress.set(
        withRepeat(
          withDelay(
            1800,
            withTiming(1, {
              duration: 1400,
              easing: Easing.inOut(Easing.quad),
            }),
          ),
          -1,
          false,
        ),
      );
    return () => cancelAnimation(progress);
  }, [progress, reduced]);
  const waveWidth = size * 0.3;
  const wave = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.get(), [0, 1], [-size, size * 1.5]) },
      { rotate: '20deg' },
    ],
  }));
  return (
    <View accessible={false} style={{ width: size, height: size, opacity: 1 }}>
      <Image
        source={source}
        accessible={false}
        resizeMode="contain"
        resizeMethod="resize"
        fadeDuration={0}
        style={{ width: size, height: size }}
      />
      {!reduced && (
        <MaskedView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          maskElement={
            <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
          }
        >
          <Animated.View
            style={[
              { position: 'absolute', left: 0, top: -size / 2, width: waveWidth, height: size * 2 },
              wave,
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </MaskedView>
      )}
    </View>
  );
}

/** Grid cells stay native and static: no canvas, animation, or per-tile listeners. */
export function AchievementCoin({
  source,
  size,
  shine = false,
  locked = false,
}: {
  source: ImageSourcePropType;
  size: number;
  shine?: boolean;
  locked?: boolean;
}) {
  if (shine && !locked) return <ShiningCoin source={source} size={size} />;
  return (
    <Image
      source={source}
      accessible={false}
      resizeMode="contain"
      resizeMethod="resize"
      fadeDuration={0}
      style={{ width: size, height: size, opacity: locked ? 0.45 : 1 }}
    />
  );
}
