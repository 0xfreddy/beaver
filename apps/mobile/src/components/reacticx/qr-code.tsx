import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import QRCodeStyled from 'react-native-qrcode-styled';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from '../app-symbol';
import { Type } from '../ui';
import { useTheme } from '../../theme';

type QRCodeProps = {
  value?: string;
  label?: string;
  loading?: boolean;
  error?: string | null;
  onExpand?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

/** Reacticx expandable QR fork without a default URL or third-party icon set. */
export function QRCode({
  value,
  label = 'Show invite QR code',
  loading = false,
  error,
  onExpand,
  onExpandedChange,
  style,
}: QRCodeProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  useEffect(() => {
    progress.set(
      reducedMotion
        ? expanded
          ? 1
          : 0
        : withSpring(expanded ? 1 : 0, {
            damping: 28,
            stiffness: 300,
            mass: 0.9,
            overshootClamping: true,
          }),
    );
  }, [expanded, progress, reducedMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    minHeight: interpolate(progress.get(), [0, 1], [52, 330]),
  }));
  const collapsedStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reducedMotion ? 1 : 0.98 + progress.get() * 0.02 }],
  }));

  const open = () => {
    setExpanded(true);
    onExpandedChange?.(true);
    onExpand?.();
    void Haptics.selectionAsync().catch(() => {});
  };
  const copy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => {
      setCopied(false);
      copiedTimer.current = null;
    }, 1600);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        { backgroundColor: colors.surface, borderColor: colors.line },
        style,
      ]}
    >
      <Animated.View
        pointerEvents={expanded ? 'none' : 'auto'}
        style={[StyleSheet.absoluteFill, styles.center, collapsedStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: false, busy: loading }}
          onPress={open}
          style={({ pressed }) => [styles.labelButton, { opacity: pressed ? 0.55 : 1 }]}
        >
          <AppSymbol name="qr" color={colors.ink} size={22} />
          <Type numberOfLines={1} style={styles.label}>
            {label}
          </Type>
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, styles.expanded, expandedStyle]}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.ink} />
            <Type muted>Creating a secure invite…</Type>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Type accessibilityRole="alert" style={{ textAlign: 'center' }}>
              {error}
            </Type>
            <Pressable accessibilityRole="button" onPress={onExpand} style={styles.textAction}>
              <Type>Try again</Type>
            </Pressable>
          </View>
        ) : value ? (
          <>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="Invite QR code"
              style={styles.qr}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <QRCodeStyled
                  data={value}
                  color="#111111"
                  style={styles.qrSurface}
                  padding={16}
                  pieceSize={5.5}
                  pieceBorderRadius={1.4}
                  isPiecesGlued
                  errorCorrectionLevel="M"
                />
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy invite link"
                onPress={() => void copy()}
                style={({ pressed }) => [styles.action, { opacity: pressed ? 0.55 : 1 }]}
              >
                <AppSymbol name={copied ? 'check' : 'copy'} color={colors.ink} size={18} />
                <Type variant="caption">{copied ? 'Copied' : 'Copy link'}</Type>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hide invite QR code"
                onPress={() => {
                  setExpanded(false);
                  onExpandedChange?.(false);
                }}
                style={({ pressed }) => [styles.close, { opacity: pressed ? 0.55 : 1 }]}
              >
                <AppSymbol name="close" color={colors.ink} size={17} />
              </Pressable>
            </View>
          </>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  labelButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  label: { fontWeight: '500', fontSize: 15 },
  expanded: { alignItems: 'center', justifyContent: 'center', padding: 18, gap: 14 },
  qr: { backgroundColor: '#FFFFFF', padding: 4, borderRadius: 18, borderCurve: 'continuous' },
  qrSurface: { backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textAction: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
