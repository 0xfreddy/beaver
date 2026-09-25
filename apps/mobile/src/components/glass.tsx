import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Button } from './ui';

export function AppGlass({
  children,
  style,
  interactive = false,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; interactive?: boolean }>) {
  const { colors, isDark } = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduceTransparency(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const surface: StyleProp<ViewStyle> = [
    {
      borderRadius: 22,
      borderCurve: 'continuous',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
    },
    style,
  ];
  if (
    !reduceTransparency &&
    Platform.OS === 'ios' &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  )
    return (
      <GlassView
        style={surface}
        isInteractive={interactive}
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
      >
        {children}
      </GlassView>
    );
  if (!reduceTransparency && Platform.OS === 'ios')
    return (
      <BlurView intensity={65} tint={isDark ? 'dark' : 'light'} style={surface}>
        {children}
      </BlurView>
    );
  return (
    <View
      style={[surface, { backgroundColor: reduceTransparency ? colors.surface : colors.glass }]}
    >
      {children}
    </View>
  );
}
export function GlassFloatingBar({ children }: PropsWithChildren) {
  return <AppGlass style={{ padding: 18 }}>{children}</AppGlass>;
}
export function GlassSheet({ children }: PropsWithChildren) {
  return <AppGlass style={{ padding: 24, gap: 20 }}>{children}</AppGlass>;
}
export function GlassButton(props: Parameters<typeof Button>[0]) {
  return (
    <AppGlass interactive={!props.disabled && !props.loading} style={{ borderRadius: 14 }}>
      <Button {...props} glass />
    </AppGlass>
  );
}
