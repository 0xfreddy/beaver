import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Component,
  type PropsWithChildren,
  type RefObject,
} from 'react';
import { PixelRatio, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Image,
  Mask,
  Rect,
  makeImageFromView,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from '../app-symbol';
import { Type } from '../ui';
import { useTheme, type ThemeChoice } from '../../theme';

type Snapshot = {
  image: SkImage;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
};

type ThemeTransition = {
  changeTheme: (choice: ThemeChoice, origin?: { x: number; y: number }) => Promise<void>;
};

const Context = createContext<ThemeTransition | null>(null);
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function RevealMask({ snapshot, progress }: { snapshot: Snapshot; progress: SharedValue<number> }) {
  const radius = useDerivedValue(() => snapshot.radius * progress.get());
  return (
    <Group>
      <Rect x={0} y={0} width={snapshot.width} height={snapshot.height} color="white" />
      <Circle cx={snapshot.x} cy={snapshot.y} r={radius} color="black" />
    </Group>
  );
}

/** Reacticx snapshot reveal wired to Roundups' existing system/light/dark provider. */
export function ThemeTransitionProvider({ children }: PropsWithChildren) {
  const { choice, setChoice } = useTheme();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const scale = PixelRatio.get();
  const viewRef = useRef<View>(null);
  const activeImage = useRef<SkImage | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const progress = useSharedValue(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeImage.current?.dispose();
      activeImage.current = null;
    };
  }, []);

  const changeTheme = async (next: ThemeChoice, origin?: { x: number; y: number }) => {
    if (next === choice || busy.current) return;
    if (reducedMotion) {
      setChoice(next);
      return;
    }
    busy.current = true;
    let image: SkImage | null = null;
    try {
      image = await makeImageFromView(viewRef as unknown as RefObject<Component>);
    } catch {
      image = null;
    }
    if (!mounted.current) {
      image?.dispose();
      busy.current = false;
      return;
    }
    if (!image) {
      setChoice(next);
      busy.current = false;
      return;
    }

    const x = origin?.x ?? width / 2;
    const y = origin?.y ?? height / 2;
    const radius = Math.max(
      Math.hypot(x, y),
      Math.hypot(width - x, y),
      Math.hypot(x, height - y),
      Math.hypot(width - x, height - y),
    );
    progress.set(0);
    activeImage.current = image;
    setSnapshot({ image, x, y, radius, width, height });
    await wait(32);
    if (!mounted.current) return;
    setChoice(next);
    progress.set(withTiming(1, { duration: 280 }));
    await wait(300);
    if (!mounted.current) return;
    setSnapshot(null);
    busy.current = false;
    await wait(32);
    if (activeImage.current === image) {
      image.dispose();
      activeImage.current = null;
    }
  };

  return (
    <Context.Provider value={{ changeTheme }}>
      <View ref={viewRef} collapsable={false} style={styles.fill}>
        {children}
        {snapshot ? (
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Mask mode="luminance" mask={<RevealMask snapshot={snapshot} progress={progress} />}>
              <Image
                image={snapshot.image}
                x={0}
                y={0}
                width={snapshot.image.width() / scale}
                height={snapshot.image.height() / scale}
              />
            </Mask>
          </Canvas>
        ) : null}
      </View>
    </Context.Provider>
  );
}

export function useThemeTransition() {
  const value = useContext(Context);
  if (!value) throw new Error('ThemeTransitionProvider is missing');
  return value;
}

export function ThemeSwitch() {
  const { colors, choice } = useTheme();
  const { changeTheme } = useThemeTransition();
  return (
    <View style={styles.switchRow}>
      {(['system', 'light', 'dark'] as const).map((value) => {
        const selected = choice === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value} appearance`}
            accessibilityState={{ selected }}
            onPress={(event) => {
              void Haptics.selectionAsync().catch(() => {});
              void changeTheme(value, {
                x: event.nativeEvent.pageX,
                y: event.nativeEvent.pageY,
              });
            }}
            style={({ pressed }) => [
              styles.choice,
              {
                backgroundColor: selected ? colors.accent : colors.soft,
                opacity: pressed ? 0.62 : 1,
              },
            ]}
          >
            <AppSymbol
              name={value === 'system' ? 'system' : value === 'light' ? 'sun' : 'moon'}
              color={selected ? colors.accentInk : colors.ink}
              size={22}
            />
            <Type
              variant="caption"
              style={{
                textTransform: 'capitalize',
                color: selected ? colors.accentInk : colors.ink,
              }}
            >
              {value}
            </Type>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  switchRow: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
});
