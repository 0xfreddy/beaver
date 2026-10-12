import { StyleSheet, View } from 'react-native';
import type { Purchase } from '../lib/purchases';
import { useTheme } from '../theme';
import { OnboardingAnimation } from './onboarding-animation';
import { Tray } from './reacticx/tray';
import { Button, Type } from './ui';

export function CancelRoundupTray({
  item,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  item: Purchase | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tray
      visible={!!item}
      title="Cancel this roundup?"
      subtitle="The purchase stays in Activity. Only its roundup is removed from the investing queue."
      dismissible={!busy}
      onClose={onClose}
      footer={
        <>
          <Button
            title="Cancel roundup"
            secondary
            loading={busy}
            labelStyle={{ color: colors.danger, fontWeight: '600' }}
            onPress={onConfirm}
          />
          {!busy ? <Button title="Keep roundup" appearance="raised" onPress={onClose} /> : null}
        </>
      }
    >
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.artwork, { backgroundColor: colors.soft }]}
      >
        <OnboardingAnimation name="roundup-coin-sorter" height={148} loop={false} />
      </View>
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
    </Tray>
  );
}

const styles = StyleSheet.create({
  artwork: {
    height: 156,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderCurve: 'continuous',
  },
});
