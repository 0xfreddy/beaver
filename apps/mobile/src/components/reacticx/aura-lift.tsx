import {
  createContext,
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  Skia,
  makeImageFromView,
  type SkImage,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const SOURCE = Skia.RuntimeEffect.Make(`
uniform float progress;
uniform float2 size;
uniform shader content;

half4 main(float2 xy) {
  float2 uv = xy / size;
  float pulse = sin(progress * 3.14159265);
  float lift = 24.0 * pulse * uv.y;
  float bend = sin(uv.x * 3.14159265) * 10.0 * pulse * uv.y;
  half4 base = content.eval(float2(xy.x + bend, xy.y + lift));
  float glow = smoothstep(0.9, 0.15, distance(uv, float2(0.5, 0.82 - pulse * 0.18)));
  float3 tint = mix(float3(1.0), float3(0.96, 0.83, 1.0), glow * pulse * 0.18);
  return half4(base.rgb * tint, base.a);
}`)!;

type AuraLiftValue = { lift: () => Promise<void>; running: boolean };
const Context = createContext<AuraLiftValue | null>(null);

/** Reacticx Aura Lift adapted to a short, interrupt-safe invite-card flourish. */
export const AuraLift = memo(function AuraLift({ children }: PropsWithChildren) {
  const ref = useRef<View>(null);
  const reducedMotion = useReducedMotion();
  const [snapshot, setSnapshot] = useState<SkImage | null>(null);
  const [running, setRunning] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const clear = useCallback(() => {
    setRunning(false);
    setSnapshot(null);
  }, []);

  const lift = useCallback(async () => {
    if (running || reducedMotion || !ref.current || !layout.width || !layout.height) return;
    const image = await makeImageFromView(ref);
    if (!image) return;
    setSnapshot(image);
    setRunning(true);
    progress.set(0);
    opacity.set(1);
    progress.set(
      withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (!done) return;
        opacity.set(
          withTiming(0, { duration: 220 }, (hidden) => {
            if (hidden) scheduleOnRN(clear);
          }),
        );
      }),
    );
  }, [clear, layout.height, layout.width, opacity, progress, reducedMotion, running]);

  const uniforms = useDerivedValue(() => ({
    progress: progress.get(),
    size: [layout.width, layout.height],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Context.Provider value={{ lift, running }}>
      <View style={styles.root}>
        <View
          ref={ref}
          collapsable={false}
          style={styles.content}
          onLayout={(event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout)}
        >
          {children}
        </View>
        {running && snapshot ? (
          <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
            <Canvas style={{ width: layout.width, height: layout.height }}>
              <Fill>
                <Shader source={SOURCE} uniforms={uniforms}>
                  <ImageShader
                    image={snapshot}
                    fit="cover"
                    width={layout.width}
                    height={layout.height}
                  />
                </Shader>
              </Fill>
            </Canvas>
          </Animated.View>
        ) : null}
      </View>
    </Context.Provider>
  );
});

export function useAuraLift() {
  const value = useContext(Context);
  if (!value) throw new Error('AuraLift missing');
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  content: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 20 },
});
