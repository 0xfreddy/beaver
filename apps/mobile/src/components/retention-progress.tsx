import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import type { RetentionSummary } from '@roundups/types';
import { useLive } from '../lib/live';
import { useTheme } from '../theme';
import { achievementAssets } from '../lib/achievement-assets';
import { Button, Type } from './ui';
import { AppSymbol } from './app-symbol';

const actionCoins: Record<string, string> = {
  core: 'first-twig',
  recap: 'first-weekly-wrap',
  return: 'first-review',
};
export function RetentionProgress() {
  const query = useLive<RetentionSummary>('/v1/social/retention', true, 60000);
  const { colors, isDark } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  if (query.isPending) return <Type muted>Loading this week’s progress…</Type>;
  if (!query.data)
    return <Button title="Retry progress" secondary onPress={() => void query.refetch()} />;
  const data = query.data;
  const cardWidth = Math.min(width - 64, 280);
  return (
    <View style={{ gap: 12 }}>
      <Type variant="headline">{data.weeklyPoints} / 100 points this week</Type>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        style={{ marginHorizontal: -24 }}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
        accessibilityLabel="Ways to earn points"
      >
        {data.actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={`${action.title}. ${action.points} points. ${action.completed ? 'Completed' : 'View progress'}`}
            onPress={() =>
              router.push({ pathname: '/beaver-progress', params: { action: action.id } })
            }
            style={({ pressed }) => [
              styles.card,
              {
                width: cardWidth,
                minHeight: 190 * Math.min(fontScale, 1.6),
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Image
              source={achievementAssets[actionCoins[action.id] ?? 'first-twig']!.detail}
              resizeMode="contain"
              accessible={false}
              style={[styles.art, { opacity: isDark ? 0.32 : 0.22 }]}
            />
            <View style={{ gap: 10 }}>
              <Type variant="numeric">
                {action.points} <Type muted>pts</Type>
              </Type>
              <Type style={{ fontSize: 17, lineHeight: 23, fontWeight: '500', maxWidth: '85%' }}>
                {action.title}
              </Type>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Type variant="caption">{action.completed ? 'Completed' : 'View progress'}</Type>
              <AppSymbol name={action.completed ? 'check' : 'next'} color={colors.ink} size={14} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: 24,
  },
  art: {
    position: 'absolute',
    width: 152,
    height: 152,
    right: -30,
    bottom: -28,
    transform: [{ rotate: '-12deg' }],
  },
});
