import { useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Canvas, Fill, Shader, Skia, type Uniforms } from '@shopify/react-native-skia';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from '../app-symbol';
import { Type } from '../ui';
import { useTheme } from '../../theme';

type GooeyTab<T extends string> = {
  value: T;
  label: string;
  icon?: ImageSourcePropType;
};

type GooeySearchTabsProps<T extends string> = {
  activeTab: T;
  tabs?: readonly GooeyTab<T>[];
  initialSearch?: string;
  onTabChange: (value: T) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  tabsOnly?: boolean;
  leadingAction?: {
    accessibilityLabel: string;
    onPress: () => void;
  };
};

const activityTabs = [
  { value: 'all', label: 'All' },
  { value: 'roundups', label: 'Roundups' },
] as const;

const HEIGHT = 48;
const GAP = 10;
const EFFECT = Skia.RuntimeEffect.Make(`
uniform float2 u_resolution;
uniform float4 u_search;
uniform float4 u_right;
uniform float u_radius;
uniform float u_k;
uniform float3 u_color;
float sdRoundRect(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
half4 main(float2 p) {
  float2 ca = float2(u_search.x + u_search.z * 0.5, u_search.y + u_search.w * 0.5);
  float2 ha = float2(u_search.z * 0.5, u_search.w * 0.5);
  float2 cb = float2(u_right.x + u_right.z * 0.5, u_right.y + u_right.w * 0.5);
  float2 hb = float2(u_right.z * 0.5, u_right.w * 0.5);
  float da = sdRoundRect(p - ca, ha, min(u_radius, min(ha.x, ha.y)));
  float db = sdRoundRect(p - cb, hb, min(u_radius, min(hb.x, hb.y)));
  float d = smin(da, db, max(u_k, 0.001));
  float alpha = 1.0 - smoothstep(-0.75, 0.75, d);
  return half4(u_color * alpha, alpha);
}`);

function rgb(hex: string): [number, number, number] {
  const value = hex.startsWith('#') ? hex.slice(1) : 'ffffff';
  const parsed = Number.parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

/** Reacticx GooeySearchTabs adapted to the Activity query and app symbols. */
export function GooeySearchTabs<T extends string>({
  activeTab,
  tabs,
  initialSearch = '',
  onTabChange,
  onSearch,
  onClear,
  tabsOnly = false,
  leadingAction,
}: GooeySearchTabsProps<T>) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(552, windowWidth - 48);
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(initialSearch);
  const [expanded, setExpanded] = useState(false);
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const resolvedSurface = rgb(colors.surface);
  const resolvedTabs = (tabs ?? activityTabs) as readonly GooeyTab<T>[];

  const setExpansion = (next: boolean) => {
    setExpanded(next);
    progress.set(
      reducedMotion
        ? next
          ? 1
          : 0
        : withSpring(next ? 1 : 0, { damping: 28, stiffness: 300, mass: 0.9 }),
    );
    if (next) requestAnimationFrame(() => inputRef.current?.focus());
    else {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }
  };

  const uniforms = useDerivedValue<Uniforms>(() => {
    const p = progress.get();
    const leftWidth = HEIGHT + (width - HEIGHT) * p;
    const rightWidth = width - HEIGHT - GAP + (HEIGHT - (width - HEIGHT - GAP)) * p;
    return {
      u_resolution: [width, HEIGHT],
      u_search: tabsOnly ? [0, 0, 0, HEIGHT] : [0, 0, leftWidth, HEIGHT],
      u_right: tabsOnly ? [0, 0, width, HEIGHT] : [width - rightWidth, 0, rightWidth, HEIGHT],
      u_radius: HEIGHT / 2,
      u_k: 16,
      u_color: resolvedSurface,
    };
  }, [resolvedSurface, tabsOnly, width]);

  const tabsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.45], [1, 0]),
  }));
  const inputStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.35, 1], [0, 1]),
  }));

  const choose = (value: T) => {
    void Haptics.selectionAsync().catch(() => {});
    onTabChange(value);
  };

  return (
    <View style={[styles.root, { width }]}>
      {EFFECT ? (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={EFFECT} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: colors.surface }]}
        />
      )}

      {!tabsOnly ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={leadingAction?.accessibilityLabel ?? 'Search purchases'}
          accessibilityState={{ expanded }}
          disabled={expanded}
          hitSlop={8}
          onPress={() => {
            if (leadingAction) {
              void Haptics.selectionAsync().catch(() => {});
              leadingAction.onPress();
            } else setExpansion(true);
          }}
          style={({ pressed }) => [styles.searchButton, { opacity: pressed ? 0.45 : 1 }]}
        >
          <AppSymbol name={leadingAction ? 'copy' : 'search'} color={colors.ink} size={19} />
        </Pressable>
      ) : null}

      <Animated.View
        pointerEvents={expanded ? 'none' : 'auto'}
        style={[styles.tabs, tabsOnly && styles.tabsOnly, tabsStyle]}
      >
        {resolvedTabs.map((tab) => {
          const selected = activeTab === tab.value;
          return (
            <Pressable
              key={tab.value}
              accessibilityRole="tab"
              accessibilityLabel={tab.icon ? `Use ${tab.label} card` : tab.label}
              accessibilityState={{ selected }}
              onPress={() => choose(tab.value)}
              style={[
                styles.tab,
                selected && { backgroundColor: colors.soft, borderColor: colors.line },
              ]}
            >
              {tab.icon ? (
                <Image source={tab.icon} resizeMode="cover" style={styles.tabIcon} />
              ) : null}
              <Type variant="caption" numberOfLines={1}>
                {tab.label}
              </Type>
            </Pressable>
          );
        })}
      </Animated.View>

      {!leadingAction && !tabsOnly ? (
        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[styles.inputRow, inputStyle]}
        >
          <TextInput
            ref={inputRef}
            accessibilityLabel="Search purchases by merchant or symbol"
            defaultValue={initialSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            placeholder="Search purchases"
            placeholderTextColor={colors.muted}
            onChangeText={(value) => {
              valueRef.current = value;
              if (!value) onClear?.();
            }}
            onSubmitEditing={() => {
              onSearch?.(valueRef.current.trim());
              Keyboard.dismiss();
            }}
            style={[styles.input, { color: colors.ink }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close search"
            hitSlop={8}
            onPress={() => setExpansion(false)}
            style={({ pressed }) => [styles.close, { opacity: pressed ? 0.45 : 1 }]}
          >
            <AppSymbol name="close" color={colors.ink} size={18} />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: HEIGHT, alignSelf: 'center' },
  fallback: { borderRadius: HEIGHT / 2 },
  searchButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: HEIGHT,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    position: 'absolute',
    left: HEIGHT + GAP,
    right: 0,
    top: 0,
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    gap: 2,
  },
  tabsOnly: { left: 0 },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 19,
    borderCurve: 'continuous',
  },
  tabIcon: { width: 22, height: 22, borderRadius: 11 },
  inputRow: {
    position: 'absolute',
    left: HEIGHT,
    right: 0,
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, height: HEIGHT, paddingVertical: 0, fontSize: 17 },
  close: { width: HEIGHT, height: HEIGHT, alignItems: 'center', justifyContent: 'center' },
});
