import { useEffect } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AchievementSummary } from '@roundups/types';
import { Button, Type } from '../../components/ui';
import { AchievementCoin } from '../../components/achievement-coin';
import { DiaText } from '../../components/reacticx/dia-text';
import { useAuth } from '../../providers/auth-provider';
import { useLive } from '../../lib/live';
import { apiRequest } from '../../lib/api';
import { achievementAssets } from '../../lib/achievement-assets';
import { useTheme } from '../../theme';

export default function AchievementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const focused = useIsFocused();
  const cache = useQueryClient();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const query = useLive<AchievementSummary>('/v1/social/achievements');
  const summary = auth.session ? query.data : undefined;
  const definition = summary?.definitions.find((item) => item.id === id);
  const award = summary?.awards.find((item) => item.definitionId === id);
  const asset = definition && achievementAssets[definition.assetKey || definition.id];
  const { mutate, status } = useMutation({
    mutationKey: ['achievement-presented', auth.user?.id, id],
    mutationFn: () =>
      apiRequest(
        auth.getAccessToken,
        `/v1/social/achievements/${encodeURIComponent(id)}/presented`,
        { method: 'POST' },
      ),
    retry: 2,
    onSuccess: () =>
      cache.setQueryData<AchievementSummary>(
        ['live', auth.user?.id, '/v1/social/achievements'],
        (old) =>
          old && {
            ...old,
            awards: old.awards.map((a) =>
              a.definitionId === id ? { ...a, presentedAt: new Date().toISOString() } : a,
            ),
          },
      ),
  });
  useEffect(() => {
    if (focused && asset && award?.presentedAt === null && status === 'idle') mutate();
  }, [focused, asset, award?.presentedAt, status, mutate]);
  const size = Math.max(0, Math.min(width - 48, 320));
  return (
    <ScrollView
      onAccessibilityEscape={() => router.back()}
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ alignItems: 'center', padding: 24, paddingBottom: 32, gap: 16 }}
    >
      {definition && asset ? (
        <>
          <AchievementCoin
            source={asset.detail}
            size={size}
            shine={focused && !!award}
            locked={!award}
          />
          <DiaText
            text={definition.title}
            baseColor={colors.ink}
            bandRatio={0.7}
            duration={1400}
            delay={200}
            autoPlay={focused}
            style={{ width: '100%' }}
            textStyle={{
              fontSize: 30,
              lineHeight: 38,
              fontWeight: '500',
              letterSpacing: -0.7,
              textAlign: 'center',
            }}
          />
          <Type muted style={{ textAlign: 'center' }}>
            {definition.description}
          </Type>
          {!award && (
            <Type variant="caption" muted>
              Not unlocked yet
            </Type>
          )}
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Type muted>{query.isPending ? 'Loading…' : 'Achievement unavailable.'}</Type>
          {query.isError && <Button title="Retry" onPress={() => void query.refetch()} />}
        </View>
      )}
      {Platform.OS === 'web' && <Button title="Done" secondary onPress={() => router.back()} />}
    </ScrollView>
  );
}
