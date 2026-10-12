import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, View, useWindowDimensions } from 'react-native';
import BankGlobeDOM from './bank-globe-dom';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TextButton } from './ui';

export function BankGlobeFooter({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const size = Math.min(width * 0.82, 360);
  return (
    <View style={{ height: size / 2, overflow: 'hidden', backgroundColor: colors.background }}>
      <View style={{ position: 'absolute', left: -24, bottom: -size / 2 }}>
        <BankGlobe size={size} />
      </View>
      <View style={{ position: 'absolute', right: 24, bottom: Math.max(insets.bottom, 20) }}>
        <TextButton title="Back" onPress={onBack} />
      </View>
    </View>
  );
}

/** Shared by the onboarding and settings bank-region picker. */
function BankGlobe({ size }: { size: number }) {
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', (value) => setActive(value === 'active'));
    return () => {
      mounted = false;
      motion.remove();
      state.remove();
    };
  }, []);
  return (
    <View style={{ width: size, height: size }}>
      <BankGlobeDOM
        active={active}
        reduceMotion={reduceMotion}
        fontScale={fontScale}
        accent={colors.accent}
        accentInk={colors.accentInk}
        dom={{
          useExpoDOMWebView: false,
          scrollEnabled: false,
          bounces: false,
          style: { width: size, height: size, backgroundColor: 'transparent' },
        }}
      />
    </View>
  );
}
