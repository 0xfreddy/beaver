import { Platform, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from 'expo-router';
import type { AchievementSummary } from '@roundups/types';
import { Screen, Type, Button } from '../../components/ui';
import { InteractiveArt } from '../../components/interactive-art';
import { useAuth } from '../../providers/auth-provider';
import { useLive } from '../../lib/live';
import { achievementAssets } from '../../lib/achievement-assets';
import { achievementProgress } from '../../lib/achievements';

export default function AchievementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth(),
    focused = useIsFocused(),
    { width } = useWindowDimensions();
  const query = useLive<AchievementSummary>('/v1/social/achievements');
  const summary = auth.session ? query.data : undefined;
  const definition = summary?.definitions.find((item) => item.id === id);
  const award = summary?.awards.find((item) => item.definitionId === id);
  return (
    <Screen>
      {definition && summary ? (
        <>
          {achievementAssets[definition.assetKey] && (
            <InteractiveArt
              source={achievementAssets[definition.assetKey]!.detail}
              name={definition.title}
              size={Math.min(width - 48, 360)}
              active={focused}
            />
          )}
          <Type variant="title" accessibilityRole="header">
            {definition.title}
          </Type>
          <Type>{award ? '✓ Earned' : 'Locked'}</Type>
          <Type>{definition.description}</Type>
          {award ? (
            <Type muted>
              Earned{' '}
              {new Date(award.earnedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Type>
          ) : (
            <Type muted>{achievementProgress(id, summary)}</Type>
          )}
          <Type variant="headline">Permanent achievement</Type>
          <Type variant="caption" muted>
            Your collection stays with you. This milestone does not add season points.
          </Type>
          {achievementAssets[definition.assetKey] ? (
            <Type variant="caption" muted>
              Tap the badge to spin.
            </Type>
          ) : (
            <Button
              title="See your progress"
              secondary
              onPress={() => {
                router.dismissTo('/beaver-progress');
              }}
            />
          )}
        </>
      ) : (
        <>
          <Type>
            {query.isPending && auth.session ? 'Loading achievement…' : 'Achievement unavailable.'}
          </Type>
          {auth.session && <Button title="Retry" onPress={() => void query.refetch()} />}
        </>
      )}
      {query.error && definition && (
        <Type accessibilityRole="alert">
          Showing saved achievement details. Refresh the collection when connected.
        </Type>
      )}
      {Platform.OS === 'web' && <Button title="Done" secondary onPress={() => router.back()} />}
    </Screen>
  );
}
