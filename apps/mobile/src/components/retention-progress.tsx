import { View } from 'react-native';
import { router } from 'expo-router';
import type { RetentionSummary } from '@roundups/types';
import { useLive } from '../lib/live';
import { useTheme } from '../theme';
import { Button, Type } from './ui';
import { AppSymbol } from './app-symbol';

export function RetentionProgress() {
  const query = useLive<RetentionSummary>('/v1/social/retention', true, 60000);
  const { colors } = useTheme();
  if (query.isPending) return <Type muted>Loading this week’s progress…</Type>;
  if (query.error)
    return (
      <View style={{ gap: 8 }}>
        <Type muted>Weekly progress is unavailable.</Type>
        <Button title="Retry progress" secondary onPress={() => void query.refetch()} />
      </View>
    );
  if (!query.data) return null;
  const data = query.data;
  return (
    <View
      style={{
        gap: 16,
        padding: 20,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.soft,
      }}
    >
      <View style={{ gap: 4 }}>
        <Type variant="caption" muted>
          WEEK {data.season.weekNumber} OF 4
        </Type>
        <Type variant="numeric">{data.weeklyPoints} / 100 points this week</Type>
        <Type variant="caption" muted>
          Season ends{' '}
          {new Date(data.season.endsAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
          . Your achievements stay.
        </Type>
      </View>
      {data.actions.map((action) => (
        <View key={action.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <AppSymbol
            name={action.completed ? 'check' : 'hourglass'}
            color={colors.muted}
            size={18}
          />
          <Type variant="caption" style={{ flex: 1 }}>
            {action.title}
            {action.completed ? ' · Done' : ''}
          </Type>
          <Type variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
            {action.points} pts
          </Type>
        </View>
      ))}
      <Button
        title="Your weekly progress"
        secondary
        onPress={() => router.push('/beaver-progress')}
      />
    </View>
  );
}
