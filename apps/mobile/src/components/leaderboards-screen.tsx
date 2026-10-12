import { RetentionProgress } from './retention-progress';
import { useMockData } from '../providers/mock-data-provider';
import { useEffect, useState } from 'react';
import {
  FlatList,
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  View,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { AchievementSummary, LeaderboardPage, LeaderboardRow } from '@roundups/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Type } from '../components/ui';
import { ProfileAvatar } from '../components/profile-avatar';
import { SocialScope } from '../components/social-scope';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../theme';
import { apiRequest } from '../lib/api';
import { useLive } from '../lib/live';
import { achievementAssets } from '../lib/achievement-assets';
import { AchievementCoin } from './achievement-coin';
export default function Leaderboards() {
  const sample = useMockData();
  const params = useLocalSearchParams<{ scope?: string }>();
  const { height } = useWindowDimensions();
  const [scope, setScope] = useState<'global' | 'friends' | 'achievements'>(
    params.scope === 'achievements'
      ? 'achievements'
      : params.scope === 'global'
        ? 'global'
        : 'friends',
  );
  useEffect(() => {
    setScope(
      params.scope === 'achievements'
        ? 'achievements'
        : params.scope === 'global'
          ? 'global'
          : 'friends',
    );
  }, [params.scope]);
  const [actionError, setActionError] = useState('');
  const auth = useAuth(),
    { colors } = useTheme(),
    cache = useQueryClient(),
    insets = useSafeAreaInsets();
  const key = ['social', auth.user?.id, 'board', scope];
  const board = useInfiniteQuery({
    queryKey: key,
    enabled: !!auth.session && scope !== 'achievements',
    initialPageParam: null as string | null,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60000,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<LeaderboardPage>(
        auth.getAccessToken,
        `/v1/social/leaderboard?scope=${scope}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const first = board.data?.pages[0],
    rows = auth.session ? (board.data?.pages.flatMap((p) => p.rows) ?? []) : [];
  async function refresh() {
    await cache.resetQueries({ queryKey: key });
  }
  const [visibilityPending, setVisibilityPending] = useState(false);
  async function toggleVisibility() {
    if (!first || visibilityPending) return;
    setVisibilityPending(true);
    setActionError('');
    try {
      await apiRequest(auth.getAccessToken, '/v1/social/profile', {
        method: 'PATCH',
        body: JSON.stringify({ globalOptIn: !first.own.profile.globalOptIn }),
      });
      await cache.invalidateQueries({ queryKey: ['social', auth.user?.id, 'profile'] });
      await cache.resetQueries({ queryKey: ['social', auth.user?.id, 'board'] });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setVisibilityPending(false);
    }
  }
  async function removeFriend(row: LeaderboardRow) {
    setActionError('');
    try {
      await apiRequest(auth.getAccessToken, `/v1/social/friends/${row.profile.id}`, {
        method: 'DELETE',
      });
      await cache.resetQueries({ queryKey: ['social', auth.user?.id, 'board'] });
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  function menu(row: LeaderboardRow) {
    if (row.isYou || !auth.session || scope !== 'friends') return;
    const confirm = () =>
      Alert.alert(
        'Remove friend?',
        'You will leave each other’s Friends leaderboard. Earned points stay.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => void removeFriend(row),
          },
        ],
      );
    if (Platform.OS === 'ios')
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: row.profile.alias,
          options: ['Cancel', 'Remove friend'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (i) => {
          if (i === 1) confirm();
        },
      );
    else
      Alert.alert(row.profile.alias, 'Connection options', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove friend', onPress: confirm },
      ]);
  }
  function row(item: LeaderboardRow) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderColor: colors.line,
          backgroundColor: item.isYou ? colors.soft : 'transparent',
        }}
      >
        <Type style={{ minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {item.rank ?? '—'}
        </Type>
        <ProfileAvatar id={item.profile.avatarId} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Type numberOfLines={2}>
            {item.profile.alias}
            {item.isYou ? ' · You' : ''}
          </Type>
          {item.isYou && item.rank === null ? (
            <Type variant="caption" muted>
              {item.points === 0 ? 'Not ranked yet' : 'Private score · Not listed'}
            </Type>
          ) : null}
        </View>
        <View style={{ width: 72, alignItems: 'flex-end' }}>
          <Type numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {item.points} pts
          </Type>
        </View>
        {!item.isYou && auth.session && scope === 'friends' ? (
          <Pressable
            onPress={() => menu(item)}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${item.profile.alias}`}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Type>•••</Type>
          </Pressable>
        ) : (
          <View accessible={false} style={{ width: 44, height: 44 }} />
        )}
      </View>
    );
  }
  if (scope === 'achievements') return <AchievementsPanel onChangeScope={setScope} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlashList
        key={auth.user?.id ?? 'signed-out'}
        data={rows}
        extraData={scope}
        keyExtractor={(r) => r.profile.id}
        renderItem={({ item }) => row(item)}
        bounces={false}
        alwaysBounceVertical={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          auth.session ? (
            <RefreshControl
              refreshing={board.isFetching && !board.isFetchingNextPage}
              onRefresh={() => void refresh()}
              tintColor={colors.ink}
            />
          ) : undefined
        }
        onEndReached={() => {
          if (board.hasNextPage && !board.isFetching && !board.isError) void board.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 28 }}>
            <Type variant="title">Leaderboard</Type>
            <SocialScope scope={scope} onChange={setScope} />
            {sample.active ? (
              <Type variant="caption" muted>
                Sample leaderboard · illustrative activity
              </Type>
            ) : null}
            {auth.session ? (
              <>
                <RetentionProgress />
                {first ? (
                  <Type variant="headline">
                    Season {first.season?.number ?? ''} ·{' '}
                    {scope === 'friends' ? 'Friends' : 'Global'}
                  </Type>
                ) : null}
                {first && scope === 'global' ? (
                  <>
                    <Type variant="caption" muted>
                      {first.own.profile.globalOptIn
                        ? 'Your alias, avatar and season points are visible here.'
                        : 'You can browse privately. Join to show your alias, avatar and season points.'}
                    </Type>
                    <Button
                      title={
                        first.own.profile.globalOptIn
                          ? 'Leave global leaderboard'
                          : 'Join global leaderboard'
                      }
                      secondary
                      loading={visibilityPending}
                      disabled={visibilityPending}
                      onPress={() => void toggleVisibility()}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            {!auth.session ? (
              <>
                <Button title="Sign in" onPress={() => router.push('/onboarding/account')} />
              </>
            ) : (
              <>
                {board.isPending ? (
                  <View accessibilityLabel="Loading leaderboard" style={{ gap: 12 }}>
                    {[1, 2, 3].map((n) => (
                      <View
                        key={n}
                        style={{ height: 64, borderRadius: 12, backgroundColor: colors.soft }}
                      />
                    ))}
                  </View>
                ) : null}
                {board.error ? (
                  <>
                    <Type accessibilityRole="alert">
                      {first
                        ? 'This view may be stale. Refresh for current visibility and points.'
                        : board.error.message}
                    </Type>
                    <Button title="Retry leaderboard" secondary onPress={() => void refresh()} />
                  </>
                ) : null}
                {actionError ? <Type accessibilityRole="alert">{actionError}</Type> : null}
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          auth.session && !board.isPending && !board.isError ? (
            <View style={{ paddingVertical: 20, gap: 8 }}>
              <Type variant="headline">No one is ranked yet</Type>
              <Type muted>Complete a weekly recap to start earning points.</Type>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View
            style={{
              gap: 16,
              paddingTop: 16,
              minHeight: rows.length <= 1 ? Math.max(180, height - 350) : undefined,
            }}
          >
            {board.isFetchingNextPage ? <ActivityIndicator color={colors.ink} /> : null}
            {board.hasNextPage ? (
              <Button
                title="Load more"
                secondary
                disabled={board.isFetching}
                onPress={() => void board.fetchNextPage()}
              />
            ) : null}
            {first && !rows.some((r) => r.isYou) ? (
              <>
                <Type variant="headline">Your progress</Type>
                {row(first.own)}
              </>
            ) : null}
            {auth.session ? (
              <View style={{ marginTop: 'auto' }}>
                <Button
                  title="Invite friends"
                  appearance="onboarding"
                  onPress={() => router.push('/invite-friends')}
                />
              </View>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function AchievementsPanel({
  onChangeScope,
}: {
  onChangeScope: (scope: 'global' | 'friends' | 'achievements') => void;
}) {
  const auth = useAuth();
  const sample = useMockData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const query = useLive<AchievementSummary>('/v1/social/achievements');
  const summary = auth.session ? query.data : undefined;
  const { width } = useWindowDimensions();
  const cell = (Math.min(width, 600) - 48 - 24) / 3;
  const earnedIds = new Set(summary?.awards.map((award) => award.definitionId));
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
      }}
      data={summary?.definitions ?? []}
      numColumns={3}
      initialNumToRender={4}
      maxToRenderPerBatch={2}
      windowSize={3}
      columnWrapperStyle={{ gap: 12 }}
      keyExtractor={(definition) => definition.id}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      ListHeaderComponent={
        <View style={{ gap: 16, paddingBottom: 28 }}>
          <Type variant="title">Leaderboard</Type>
          <SocialScope scope="achievements" onChange={onChangeScope} />
          {sample.active && (
            <Type variant="caption" muted>
              Sample achievements · illustrative activity
            </Type>
          )}
          {!auth.session ? (
            <Button title="Sign in" onPress={() => router.push('/onboarding/account')} />
          ) : query.isPending ? (
            <Type muted>Loading achievements…</Type>
          ) : !summary ? (
            <>
              <Type accessibilityRole="alert">
                {query.error?.message ?? 'Couldn’t load achievements.'}
              </Type>
              <Button title="Retry achievements" secondary onPress={() => void query.refetch()} />
            </>
          ) : (
            <Type variant="headline" style={{ textAlign: 'center' }}>
              {summary.definitions.filter((d) => earnedIds.has(d.id)).length} of{' '}
              {summary.definitions.length}
            </Type>
          )}
        </View>
      }
      renderItem={({ item: definition }) => {
        const earned = earnedIds.has(definition.id);
        const asset = achievementAssets[definition.assetKey || definition.id];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${definition.title}, ${earned ? 'unlocked' : 'locked'}. ${definition.description}`}
            onPress={() =>
              router.push({ pathname: '/achievement/[id]', params: { id: definition.id } })
            }
            style={({ pressed }) => ({
              width: cell,
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {asset && <AchievementCoin source={asset.thumbnail} size={cell} locked={!earned} />}
            <Type variant="caption" style={{ textAlign: 'center', fontSize: 12 }} muted={!earned}>
              {definition.title}
            </Type>
          </Pressable>
        );
      }}
    />
  );
}
