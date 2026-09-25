import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  TextProps,
  TextStyle,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { ScrollEdgeFade } from './scroll-edge-fade';
import { AppSymbol } from './app-symbol';

const typography = StyleSheet.create({
  display: {
    fontSize: 58,
    lineHeight: 66,
    fontWeight: '400',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '500',
    letterSpacing: -0.8,
  },
  story: {
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '400',
    letterSpacing: -0.7,
  },
  headline: { fontSize: 19, lineHeight: 26, fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 19 },
  numeric: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.7,
  },
});
export function Type({
  variant = 'body',
  muted,
  style,
  maxFontSizeMultiplier,
  ...props
}: TextProps & { variant?: keyof typeof typography; muted?: boolean }) {
  const { colors } = useTheme();
  // Refresh native text measurement when Dynamic Type changes while the app is open.
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      {...props}
      key={fontScale}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? 0}
      style={[typography[variant], { color: muted ? colors.muted : colors.ink }, style]}
    />
  );
}
export function Screen({
  children,
  title,
  eyebrow,
  action,
  fadeTop = false,
  onScroll,
  scrollRef,
  overlay,
  keyboard = false,
  compact = false,
  backgroundColor,
  topPadding,
  fillContent = false,
  refreshControl,
}: PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  fadeTop?: boolean;
  onScroll?: ScrollViewProps['onScroll'];
  scrollRef?: React.Ref<ScrollView>;
  overlay?: ReactNode;
  keyboard?: boolean;
  compact?: boolean;
  backgroundColor?: string;
  topPadding?: number;
  fillContent?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
}>) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollToOverflowEnabled={!!scrollRef}
        automaticallyAdjustKeyboardInsets={keyboard}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={refreshControl}
        onAccessibilityEscape={() => {
          if (router.canGoBack()) router.back();
        }}
        style={{ flex: 1, backgroundColor: backgroundColor ?? colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.screen,
          fillContent && { flexGrow: 1 },
          compact && { paddingTop: 12, gap: 12 },
          topPadding !== undefined && { paddingTop: topPadding },
        ]}
      >
        {(title || eyebrow) && (
          <View style={[styles.heading, fontScale > 1.3 && styles.stackedHeading]}>
            <View style={{ flex: 1 }}>
              {eyebrow && (
                <Type variant="caption" muted style={styles.eyebrow}>
                  {eyebrow}
                </Type>
              )}
              {title && (
                <Type variant="title" accessibilityRole="header">
                  {title}
                </Type>
              )}
            </View>
            {action}
          </View>
        )}
        {children}
      </Animated.ScrollView>
      {fadeTop && <ScrollEdgeFade />}
      {overlay}
    </View>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
  accessibilityLabel,
  trailing,
  loading = false,
  glass = false,
  appearance = 'default',
  labelStyle,
}: {
  title: string;
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  trailing?: ReactNode;
  loading?: boolean;
  glass?: boolean;
  appearance?: 'default' | 'onboarding' | 'raised';
  labelStyle?: StyleProp<TextStyle>;
}) {
  const { colors, isDark } = useTheme();
  const raised = appearance !== 'default' && !secondary && !glass;
  const themedRaised = appearance === 'raised' && raised;
  const reducedMotion = useReducedMotion();
  const depression = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: raised && reducedMotion ? 1 : 1 - depression.get() },
      { translateY: raised && !reducedMotion ? depression.get() * 50 : 0 },
    ],
  }));
  const inactive = disabled || loading;
  const foreground = themedRaised
    ? colors.background
    : raised
      ? '#1B1B1B'
      : secondary || glass
        ? colors.ink
        : colors.accentInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() =>
        depression.set(
          withSpring(raised ? 0.02 : 0.015, {
            stiffness: 1200,
            damping: 70,
            overshootClamping: true,
          }),
        )
      }
      onPressOut={() =>
        depression.set(withSpring(0, { stiffness: 1200, damping: 70, overshootClamping: true }))
      }
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={{
        borderRadius: 12,
        borderCurve: 'continuous',
        opacity: inactive ? 0.45 : 1,
        paddingBottom: raised ? 3 : 0,
      }}
    >
      <Animated.View
        style={[
          styles.button,
          pressStyle,
          {
            backgroundColor: glass || secondary ? 'transparent' : colors.accent,
            borderColor: glass ? 'transparent' : colors.line,
          },
          raised && styles.onboardingButton,
          themedRaised && {
            backgroundColor: colors.ink,
            boxShadow: isDark
              ? '0 3px 0 0 #777777, 0 2px 5.6px 0 rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.16)'
              : '0 3px 0 0 #000000, 0 2px 5.6px 0 rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.12)',
          },
        ]}
      >
        {loading ? <ActivityIndicator color={foreground} /> : null}
        <Type
          style={[
            {
              fontWeight: raised ? '300' : '500',
              color: foreground,
              flexShrink: 1,
              textAlign: 'center',
            },
            labelStyle,
          ]}
        >
          {title}
        </Type>
        {!loading && raised && trailing === undefined ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <AppSymbol name="next" color={foreground} size={18} />
          </View>
        ) : (
          trailing
        )}
      </Animated.View>
    </Pressable>
  );
}
export function TextButton({
  title,
  onPress,
  disabled = false,
  align = 'center',
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  align?: 'center' | 'leading';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.textButton,
        align === 'leading' && styles.textButtonLeading,
        { opacity: disabled ? 0.38 : pressed ? 0.58 : 1 },
      ]}
    >
      <Type muted style={styles.textButtonLabel}>
        {title}
      </Type>
    </Pressable>
  );
}
export function Section({ title, action }: { title: string; action?: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[styles.section, fontScale > 1.3 && styles.stackedHeading]}>
      <Type variant="headline" accessibilityRole="header">
        {title}
      </Type>
      {action}
    </View>
  );
}
export function Badge({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.soft }]}>
      <Type variant="caption" style={{ color: colors.green, fontWeight: '600' }}>
        {children}
      </Type>
    </View>
  );
}
export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 48, gap: 16 }}>
      <ActivityIndicator color={colors.green} />
      <Type muted style={{ textAlign: 'center' }}>
        Loading your spending…
      </Type>
    </View>
  );
}
export function InlineError({ retry }: { retry: () => void }) {
  return (
    <Card>
      <Type variant="headline">Couldn’t load your spending</Type>
      <Type muted>Check your connection and try again.</Type>
      <Button title="Try again" onPress={retry} />
    </Card>
  );
}
export const rowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};
export const linkStyle: TextStyle = { fontWeight: '600', fontSize: 14 };
const styles = StyleSheet.create({
  // Fliptexts' raised white surface, rendered with native inset/outset shadows.
  // The white face and dark label deliberately stay constant in both appearances.
  onboardingButton: {
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    boxShadow:
      '0 3px 0 0 #B8B5B3, 0 2px 5.6px 0 rgba(0,0,0,0.07), inset 0 0 0 1px rgba(0,0,0,0.1), inset 0 -10px 12px -10px rgba(0,0,0,0.14)',
  },
  screen: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 48,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 20,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  stackedHeading: { flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  eyebrow: { letterSpacing: 1.8, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 22, borderCurve: 'continuous', padding: 22, gap: 14 },
  button: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    minHeight: 54,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  textButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 12,
  },
  textButtonLeading: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  textButtonLabel: { fontSize: 16, lineHeight: 22, fontWeight: '500', textAlign: 'center' },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
});
