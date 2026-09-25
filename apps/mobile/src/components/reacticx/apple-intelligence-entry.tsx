import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, RoundedRect, Shader, Skia } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const BORDER_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float time;
uniform float intensity;

float sdRoundRect(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

half4 main(float2 xy) {
  float2 p = xy - size * 0.5;
  float outer = sdRoundRect(p, size * 0.5 - 4.0, 46.0);
  float inner = sdRoundRect(p, size * 0.5 - 10.0, 40.0);
  float border = smoothstep(2.0, -1.0, outer) * smoothstep(-1.5, 1.0, inner);
  float angle = atan(p.y, p.x) / 6.2831853 + 0.5 + time;
  float3 pink = float3(1.0, 0.32, 0.62);
  float3 violet = float3(0.55, 0.36, 1.0);
  float3 blue = float3(0.15, 0.70, 1.0);
  float3 color = mix(pink, violet, 0.5 + 0.5 * sin(angle * 6.2831853));
  color = mix(color, blue, 0.5 + 0.5 * sin((angle + 0.34) * 6.2831853));
  float shimmer = 0.72 + 0.28 * sin((angle * 3.0 - time * 4.0) * 6.2831853);
  return half4(color * shimmer, border * intensity);
}`)!;

type EntryTransition = { play: () => void };
const Context = createContext<EntryTransition | null>(null);

export function AppleIntelligenceEntryProvider({ children }: PropsWithChildren) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const progress = useSharedValue(0);

  const finish = useCallback(() => setVisible(false), []);
  const play = useCallback(() => {
    setVisible(true);
    progress.set(0);
    progress.set(
      withDelay(
        reducedMotion ? 80 : 240,
        withSequence(
          withTiming(1, {
            duration: reducedMotion ? 120 : 540,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          withTiming(
            2,
            { duration: reducedMotion ? 160 : 820, easing: Easing.inOut(Easing.quad) },
            (done) => {
              if (done) scheduleOnRN(finish);
            },
          ),
        ),
      ),
    );
  }, [finish, progress, reducedMotion]);

  const uniforms = useDerivedValue(() => ({
    size: [width, height],
    time: progress.get() * 0.82,
    intensity: interpolate(progress.get(), [0, 0.25, 1.45, 2], [0, 1, 1, 0]),
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.18, 1.55, 2], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(progress.get(), [0, 0.7, 2], [0.985, 1, 1.012]) }],
  }));

  return (
    <Context.Provider value={{ play }}>
      <View style={styles.root}>{children}</View>
      {visible ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.overlay, overlayStyle]}
        >
          <Canvas style={{ width, height }}>
            <RoundedRect x={0} y={0} width={width} height={height} r={48}>
              <Shader source={BORDER_SHADER} uniforms={uniforms} />
            </RoundedRect>
          </Canvas>
        </Animated.View>
      ) : null}
    </Context.Provider>
  );
}

export function useAppleIntelligenceEntry() {
  const value = useContext(Context);
  if (!value) throw new Error('AppleIntelligenceEntryProvider missing');
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10000 },
});
