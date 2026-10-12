import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
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
  const progress = useSharedValue(0);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    cancelAnimation(progress);
    progress.set(0);
    if (shine && !reduced)
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
  }, [progress, shine, reduced]);
  const waveWidth = size * 0.3;
  const wave = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.get(), [0, 1], [-size, size * 1.5]) },
      { rotate: '20deg' },
    ],
  }));
  return (
    <View accessible={false} style={{ width: size, height: size, opacity: locked ? 0.45 : 1 }}>
      {locked ? (
        <GrayCoin source={source} size={size} />
      ) : (
        <Image
          source={source}
          accessible={false}
          resizeMode="contain"
          fadeDuration={0}
          style={{ width: size, height: size }}
        />
      )}
      {shine && !reduced && (
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

function GrayCoin({ source, size }: { source: ImageSourcePropType; size: number }) {
  const image = useImage(Image.resolveAssetSource(source));
  return (
    <Canvas style={{ width: size, height: size }}>
      {image && (
        <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="contain">
          <ColorMatrix
            matrix={[
              0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0,
              0, 0, 0, 0, 1, 0,
            ]}
          />
        </SkiaImage>
      )}
    </Canvas>
  );
}
