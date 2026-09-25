import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { AppSymbol } from '../components/app-symbol';
import { Button, Screen, Type } from '../components/ui';
import { useMockData } from '../providers/mock-data-provider';
import { useTheme } from '../theme';

const changes = [
  ['briefcase', 'A connected Chase account with sample purchases'],
  ['trendUp', 'A funded wallet, holdings, roundups, and orders'],
  ['message', 'Achievements, friends, and leaderboard activity'],
] as const;

export default function MockDataSheet() {
  const mockData = useMockData();
  const { colors } = useTheme();
  const [error, setError] = useState('');

  if (!mockData.available)
    return (
      <Screen compact title="Sample account" backgroundColor={colors.surface}>
        <Type muted>Sample accounts are unavailable in this production build.</Type>
        <Button title="Close" secondary onPress={() => router.back()} />
      </Screen>
    );

  async function load() {
    setError('');
    try {
      await mockData.load();
      AccessibilityInfo.announceForAccessibility('Sample account loaded');
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  return (
    <>
      <Stack.Screen options={{ sheetAllowedDetents: [0.58, 0.72] }} />
      <Screen compact title="Load sample account" backgroundColor={colors.surface}>
        <Type muted>
          Beaver will temporarily show a complete sample account on this device. Your live account,
          bank connections, wallet, and orders will not be changed.
        </Type>
        <View style={styles.changes}>
          {changes.map(([symbol, label]) => (
            <View key={symbol} style={[styles.change, { borderBottomColor: colors.line }]}>
              <View style={[styles.symbol, { backgroundColor: colors.soft }]}>
                <AppSymbol name={symbol} color={colors.ink} size={18} />
              </View>
              <Type style={styles.changeLabel}>{label}</Type>
            </View>
          ))}
        </View>
        {error || mockData.error ? (
          <Type accessibilityRole="alert">{error || mockData.error}</Type>
        ) : null}
        <Button title="Load sample account" loading={mockData.busy} onPress={() => void load()} />
        <Button title="Cancel" secondary disabled={mockData.busy} onPress={() => router.back()} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  changes: { gap: 0 },
  change: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  symbol: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeLabel: { flex: 1 },
});
