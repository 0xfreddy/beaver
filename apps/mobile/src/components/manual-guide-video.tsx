import { StyleSheet, View } from 'react-native';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import { useTheme } from '../theme';

/** Keep the guide-player surface in the manual flow without shipping temporary media. */
export function ManualGuideVideo() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Manual receipt video player. Video coming soon."
      style={[styles.player, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <View style={[styles.playButton, { borderColor: colors.line }]}>
        <AppSymbol name="play" color={colors.ink} size={22} />
      </View>
      <View style={styles.controls}>
        <AppSymbol name="play" color={colors.muted} size={13} />
        <View style={[styles.track, { backgroundColor: colors.line }]} />
        <Type variant="caption" muted style={styles.time}>
          0:00
        </Type>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    width: '100%',
    aspectRatio: 1.85,
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  controls: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  track: { flex: 1, height: 2, borderRadius: 999 },
  time: { fontVariant: ['tabular-nums'] },
});
