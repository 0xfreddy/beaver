import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import {
  BlurMask,
  Canvas,
  Fill,
  Group,
  LinearGradient,
  Mask,
  Rect,
  RoundedRect,
  Shader,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { BORDER_GLOW_SHADER } from './radiant-button/conf';
import { createDotShaderSource, hexToRgb } from './radiant-button/helpers';
import type { RadiantButtonProps } from './radiant-button/types';

const DEFAULT_THEME = {
  background: '#000000',
  backgroundSubtle: '#1A1A1A',
  foreground: '#FFFFFF',
  highlight: '#C084FC',
  highlightSubtle: '#A855F7',
};

/**
 * Source-faithful port of Reacticx Radiant Button. App-specific additions are
 * semantic theming, accessibility, Reduce Motion, and one press haptic.
 */
export const RadiantButton = memo(function RadiantButton({
  children,
  onPress,
  accessibilityLabel,
  style,
  contentStyle,
  textStyle,
  borderRadius = 12,
  borderWidth = 2,
  duration = 3000,
  theme: themeProp,
  paddingHorizontal = 24,
  paddingVertical = 14,
  disabled = false,
  showDots = true,
  showShimmer = true,
  showGlow = true,
  dotSpacing = 5,
  dotRadius = 0.65,
  dotOpacity = 0.35,
  shimmerOpacity = 0.35,
  glowBlur = 18,
  glowWidth = 0.7,
  breathingEnabled = true,
  glowBandWidth = 0.15,
}: RadiantButtonProps) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const shimmerAngle = useSharedValue(0);
  const breathe = useSharedValue(0);
  const pressed = useSharedValue(0);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      background: isDark ? '#000000' : colors.surface,
      backgroundSubtle: isDark ? colors.surface : colors.soft,
      foreground: colors.ink,
      ...themeProp,
    }),
    [colors.ink, colors.soft, colors.surface, isDark, themeProp],
  );
  const highlightRgb = useMemo(() => hexToRgb(theme.highlight), [theme.highlight]);
  const borderGlowShader = useMemo(() => Skia.RuntimeEffect.Make(BORDER_GLOW_SHADER), []);
  const dotShader = useMemo(
    () =>
      showDots
        ? Skia.RuntimeEffect.Make(createDotShaderSource(dotSpacing, dotRadius, dotOpacity, true))
        : null,
    [dotOpacity, dotRadius, dotSpacing, showDots],
  );

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(shimmerAngle);
    cancelAnimation(breathe);
    progress.set(0);
    shimmerAngle.set(0);
    breathe.set(0);

    if (!disabled && !reducedMotion) {
      progress.set(withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
      if (showShimmer) {
        shimmerAngle.set(
          withRepeat(
            withTiming(360, { duration: duration / 0.4, easing: Easing.linear }),
            -1,
            false,
          ),
        );
      }
      if (breathingEnabled && showGlow) {
        breathe.set(
          withRepeat(
            withTiming(1, {
              duration: duration * 1.5,
              easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true,
          ),
        );
      }
    }

    return () => {
      cancelAnimation(progress);
      cancelAnimation(shimmerAngle);
      cancelAnimation(breathe);
    };
  }, [
    breathingEnabled,
    breathe,
    disabled,
    duration,
    progress,
    reducedMotion,
    showGlow,
    showShimmer,
    shimmerAngle,
  ]);

  const { width, height } = layout;
  const cx = width / 2;
  const cy = height / 2;
  const innerClip = useMemo(() => {
    if (!width || !height) return undefined;
    const path = Skia.Path.Make();
    path.addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(borderWidth, borderWidth, width - borderWidth * 2, height - borderWidth * 2),
        Math.max(borderRadius - borderWidth, 0),
        Math.max(borderRadius - borderWidth, 0),
      ),
    );
    return path;
  }, [borderRadius, borderWidth, height, width]);

  const borderGlowUniforms = useDerivedValue(() => ({
    iResolution: [width, height] as [number, number],
    progress: progress.get(),
    borderRadius,
    borderWidth,
    bandWidth: interpolate(pressed.get(), [0, 1], [glowBandWidth, glowBandWidth * 2]),
    highlightColor: highlightRgb,
  }));
  const dotUniforms = useDerivedValue(() => ({
    iResolution: [width, height] as [number, number],
    angle: progress.get() * Math.PI * 2,
  }));
  const shimmerTransform = useDerivedValue(() => [
    { rotate: (shimmerAngle.get() * Math.PI) / 180 },
  ]);
  const glowOpacity = useDerivedValue(() => {
    const breatheAdd = breathingEnabled ? interpolate(breathe.get(), [0, 1], [0, 0.2]) : 0;
    return 0.25 + breatheAdd + interpolate(pressed.get(), [0, 1], [0, 0.5]);
  });
  const glowTransform = useDerivedValue(() => [
    {
      scale: breathingEnabled ? interpolate(breathe.get(), [0, 1], [1, 1.15]) : 1,
    },
  ]);
  const animatedPressStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(pressed.get(), [0, 1], [0, 1]) }],
  }));

  const shimmerSize = Math.max(width, height) * 1.5;
  const hasLayout = width > 0 && height > 0;

  function handleLayout(event: LayoutChangeEvent) {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setLayout((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : { width: nextWidth, height: nextHeight },
    );
  }

  return (
    <Animated.View style={animatedPressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onLayout={handleLayout}
        onPressIn={() => pressed.set(withTiming(1, { duration: reducedMotion ? 0 : 300 }))}
        onPressOut={() => pressed.set(withTiming(0, { duration: reducedMotion ? 0 : 600 }))}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onPress?.();
        }}
        style={[
          styles.button,
          {
            borderRadius,
            paddingHorizontal,
            paddingVertical,
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        {hasLayout && innerClip ? (
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
            {borderGlowShader ? (
              <Group>
                <Rect x={0} y={0} width={width} height={height}>
                  <Shader source={borderGlowShader} uniforms={borderGlowUniforms} />
                  <BlurMask blur={6} style="normal" />
                </Rect>
                <Rect x={0} y={0} width={width} height={height}>
                  <Shader source={borderGlowShader} uniforms={borderGlowUniforms} />
                </Rect>
              </Group>
            ) : null}

            <Group clip={innerClip}>
              <Rect
                x={borderWidth}
                y={borderWidth}
                width={width - borderWidth * 2}
                height={height - borderWidth * 2}
                color={theme.background}
              />
              <RoundedRect
                x={borderWidth}
                y={borderWidth}
                width={width - borderWidth * 2}
                height={height - borderWidth * 2}
                r={Math.max(borderRadius - borderWidth, 0)}
                color={theme.backgroundSubtle}
                style="stroke"
                strokeWidth={1}
              />

              {showDots && dotShader ? (
                <Fill>
                  <Shader source={dotShader} uniforms={dotUniforms} />
                </Fill>
              ) : null}

              {showShimmer ? (
                <Mask
                  mask={
                    <Rect
                      x={borderWidth}
                      y={borderWidth}
                      width={width - borderWidth * 2}
                      height={height - borderWidth * 2}
                    >
                      <LinearGradient
                        start={vec(cx, borderWidth)}
                        end={vec(cx, height - borderWidth)}
                        colors={['transparent', 'transparent', 'white']}
                        positions={[0, 0.4, 1]}
                      />
                    </Rect>
                  }
                >
                  <Group transform={shimmerTransform} origin={vec(cx, cy)} opacity={shimmerOpacity}>
                    <Rect
                      x={cx - shimmerSize / 2}
                      y={cy - shimmerSize / 2}
                      width={shimmerSize}
                      height={shimmerSize}
                    >
                      <LinearGradient
                        start={vec(0, 0)}
                        end={vec(shimmerSize, shimmerSize * 0.7)}
                        colors={[
                          'transparent',
                          'transparent',
                          theme.highlight,
                          'transparent',
                          'transparent',
                        ]}
                        positions={[0, 0.35, 0.5, 0.65, 1]}
                      />
                    </Rect>
                  </Group>
                </Mask>
              ) : null}

              {showGlow ? (
                <Group transform={glowTransform} origin={vec(cx, height)} opacity={glowOpacity}>
                  <RoundedRect
                    x={cx - (width * glowWidth) / 2}
                    y={height - 22}
                    width={width * glowWidth}
                    height={26}
                    r={13}
                    color={theme.highlight}
                  >
                    <BlurMask blur={glowBlur} style="normal" />
                  </RoundedRect>
                </Group>
              ) : null}
            </Group>
          </Canvas>
        ) : null}

        <View style={[styles.content, contentStyle]}>
          {typeof children === 'string' ? (
            <Text style={[styles.text, { color: theme.foreground }, textStyle]}>{children}</Text>
          ) : (
            children
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    minHeight: 48,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  content: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 16, fontWeight: '500' },
});

export type { RadiantButtonProps, RadiantButtonTheme } from './radiant-button/types';
