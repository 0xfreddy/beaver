import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RetentionSummary } from '@roundups/types';
import { Button, Screen, Type } from '../components/ui';
import { useAuth } from '../providers/auth-provider';
import { useMockData } from '../providers/mock-data-provider';
import { useLive, type InvestmentPolicy } from '../lib/live';
import { apiRequest } from '../lib/api';
import { useTheme } from '../theme';

export default function BeaverProgress() {
  const auth = useAuth();
  return <Progress key={auth.user?.id ?? 'signed-out'} />;
}
function Progress() {
  const auth = useAuth(),
    cache = useQueryClient(),
    { colors } = useTheme(),
    sample = useMockData();
  const query = useLive<RetentionSummary>('/v1/social/retention', true, 60000);
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const [showRecap, setShowRecap] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmedRules, setConfirmedRules] = useState(false);
  const mutation = useMutation({
    mutationFn: ({
      path,
      body,
      method = 'POST',
    }: {
      path: string;
      body: unknown;
      method?: string;
    }) =>
      apiRequest<RetentionSummary>(auth.getAccessToken, path, {
        method,
        body: JSON.stringify(body),
      }),
    onSuccess: async (data) => {
      cache.setQueryData(['live', auth.user?.id, '/v1/social/retention'], data);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['social', auth.user?.id, 'board'] }),
        cache.invalidateQueries({ queryKey: ['live', auth.user?.id, '/v1/social/achievements'] }),
      ]);
    },
  });
  const act = (body: unknown) => mutation.mutate({ path: '/v1/social/retention/actions', body });
  const data = query.data;
  const lesson = data?.lessons.find((l) => l.id === lessonId);
  const review = data?.reviews.find((r) => r.id === reviewId);
  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: 'Your progress' }} />
      {sample.active ? (
        <Type variant="caption" muted>
          Sample progress · no real rewards or activity
        </Type>
      ) : null}
      {!auth.session ? (
        <Type>Sign in to see your progress.</Type>
      ) : query.isPending ? (
        <Type>Loading your progress…</Type>
      ) : null}
      {query.error ? (
        <>
          <Type accessibilityRole="alert">{query.error.message}</Type>
          <Button title="Retry progress" secondary onPress={() => void query.refetch()} />
        </>
      ) : null}
      {mutation.error ? <Type accessibilityRole="alert">{mutation.error.message}</Type> : null}
      {data ? (
        <>
          <Type variant="title">Small steps, added up.</Type>
          <Type muted>
            Season {data.season.number} · {data.points} points. Earn up to 100 each week, plus 20
            for one friend who joins and stays.
          </Type>
          <Type variant="headline">Your weekly recap</Type>
          <Type muted>
            {new Date(data.recap.startsAt).toLocaleDateString(undefined, { timeZone: 'UTC' })} –{' '}
            {new Date(new Date(data.recap.endsAt).getTime() - 1).toLocaleDateString(undefined, {
              timeZone: 'UTC',
            })}{' '}
            UTC
          </Type>
          {!showRecap ? (
            <Button
              title={data.recap.completed ? 'Read your recap again' : 'Read your recap'}
              secondary
              onPress={() => setShowRecap(true)}
            />
          ) : (
            <View style={{ gap: 12 }}>
              <Type>
                {data.recap.roundupCount
                  ? `${data.recap.roundupCount} roundups successfully reached your portfolio last week.`
                  : 'No roundups reached your portfolio last week. A quiet week is part of the journey, too.'}
              </Type>
              <Type muted>
                Completed contributions count toward your private milestones. Pending roundups and
                changes in market value do not.
              </Type>
              <Button
                title={
                  data.recap.completed ? 'Recap completed · 40 points' : 'Finish recap · 40 points'
                }
                disabled={data.recap.completed || mutation.isPending}
                onPress={() => act({ kind: 'recap', sourceId: data.recap.id })}
              />
            </View>
          )}
          <Type variant="headline">A little understanding</Type>
          <Type muted>
            Review a new lesson or completed roundup on a different day from your recap to earn 20
            points. Weeks run Monday to Sunday, UTC.
          </Type>
          {lesson ? (
            <View
              style={{
                gap: 12,
                padding: 16,
                backgroundColor: colors.soft,
                borderRadius: 16,
                borderCurve: 'continuous',
              }}
            >
              <Type variant="headline">{lesson.title}</Type>
              <Type>{lesson.body}</Type>
              <Type>{lesson.question}</Type>
              {lesson.choices.map((answer) => (
                <Button
                  key={answer}
                  title={answer}
                  secondary
                  disabled={mutation.isPending}
                  onPress={() => act({ kind: 'lesson', sourceId: lesson.id, answer })}
                />
              ))}
            </View>
          ) : data.lessons.length ? (
            <Button
              title={data.lessons[0]!.title}
              secondary
              onPress={() => {
                mutation.reset();
                setLessonId(data.lessons[0]!.id);
              }}
            />
          ) : (
            <Type muted>
              All current lessons completed. New roundup reviews will appear below when available.
            </Type>
          )}
          {review ? (
            <View style={{ gap: 12 }}>
              <Type>
                Your roundup was successfully invested on{' '}
                {new Date(review.executedAt).toLocaleDateString()}. It counts as a completed
                contribution, regardless of later market movements.
              </Type>
              <Button
                title="Finish roundup review"
                disabled={mutation.isPending}
                onPress={() => act({ kind: 'roundup', sourceId: review.id })}
              />
            </View>
          ) : data.reviews[0] ? (
            <Button
              title="Review a completed roundup"
              secondary
              onPress={() => setReviewId(data.reviews[0]!.id)}
            />
          ) : null}
          <Type variant="headline">Everyday milestones</Type>
          <Type muted>
            Give your progress a familiar size. These are contributions you made, not cashback,
            spendable rewards, or vouchers. Investment value can change.
          </Type>
          <Type variant="caption" muted>
            USD roundups only. Suggested prices are examples; choose what feels familiar to you.
          </Type>
          {data.milestones.map((m) => (
            <Milestone
              key={`${m.category}:${m.targetCents}:${m.confirmed}`}
              milestone={m}
              busy={mutation.isPending}
              onSave={(targetCents) =>
                mutation.mutateAsync({
                  path: '/v1/social/retention/target',
                  method: 'PUT',
                  body: { category: m.category, currency: 'USD', targetCents },
                })
              }
            />
          ))}
          <Type variant="headline">Your rules</Type>
          {policy.data && !policy.isError ? (
            <View style={{ gap: 12 }}>
              <Type muted>
                Your current rule:{' '}
                {policy.data.roundupPercentage
                  ? `${policy.data.roundupPercentage}% of each eligible purchase`
                  : `round to the next ${policy.data.roundingIncrementCents === 1000 ? '$10' : 'whole dollar'}`}
                . Automatic investing is {policy.data.enabled ? 'on' : 'off'}.
              </Type>
              <Button
                title={confirmedRules ? 'Rules reviewed' : 'Confirm I’ve reviewed my rules'}
                secondary
                disabled={confirmedRules || mutation.isPending}
                onPress={() =>
                  mutation.mutate(
                    {
                      path: '/v1/social/retention/actions',
                      body: { kind: 'rules', sourceId: 'current' },
                    },
                    { onSuccess: () => setConfirmedRules(true) },
                  )
                }
              />
            </View>
          ) : (
            <Type muted>Your settings need to load before you can confirm them.</Type>
          )}
          {data.history.length ? (
            <>
              <Type variant="headline">Past seasons</Type>
              {data.history.map((h) => (
                <Type key={h.seasonId}>
                  Season starting {h.seasonId} · {h.points} points
                </Type>
              ))}
            </>
          ) : null}
          <Type variant="caption" muted>
            Points have no cash value. Missing a week or pausing never erases an achievement.
          </Type>
        </>
      ) : null}
    </Screen>
  );
}
function Milestone({
  milestone: m,
  busy,
  onSave,
}: {
  milestone: RetentionSummary['milestones'][number];
  busy: boolean;
  onSave: (cents: number) => Promise<unknown>;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState((m.targetCents / 100).toFixed(2));
  const [editing, setEditing] = useState(!m.confirmed);
  const valid =
    /^\d{1,4}(\.\d{1,2})?$/.test(draft.trim()) && Number(draft) >= 1 && Number(draft) <= 1000;
  const percent = Math.min(100, Math.floor((m.contributedCents / m.targetCents) * 100));
  return (
    <View style={{ gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line }}>
      <Type variant="headline">
        {m.category[0]!.toUpperCase() + m.category.slice(1)}-Sized{m.earned ? ' · Earned' : ''}
      </Type>
      <Type muted>
        {m.confirmed
          ? `${percent}% of your chosen equivalent contributed`
          : 'Choose your equivalent to start tracking'}
      </Type>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${m.category} milestone`}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{ height: 4, backgroundColor: colors.soft, borderRadius: 2 }}
      >
        <View
          style={{ width: `${percent}%`, height: 4, backgroundColor: colors.ink, borderRadius: 2 }}
        />
      </View>
      {editing ? (
        <>
          <Type variant="caption">Your {m.category} equivalent in USD</Type>
          <TextInput
            accessibilityLabel={`${m.category} equivalent in USD`}
            keyboardType="decimal-pad"
            value={draft}
            onChangeText={setDraft}
            style={{
              color: colors.ink,
              minHeight: 48,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 12,
              fontSize: 17,
            }}
          />
          {!valid ? (
            <Type variant="caption">Enter $1–$1,000 with up to two decimal places.</Type>
          ) : null}
          <Button
            title="Save equivalent"
            secondary
            disabled={!valid || busy}
            onPress={() => {
              void onSave(Math.round(Number(draft) * 100))
                .then(() => setEditing(false))
                .catch(() => {});
            }}
          />
        </>
      ) : (
        <Button
          title={m.earned ? 'View achievement' : 'Change equivalent'}
          secondary
          onPress={() => {
            if (m.earned) {
              router.push({ pathname: '/achievement/[id]', params: { id: `${m.category}-sized` } });
            } else setEditing(true);
          }}
        />
      )}
    </View>
  );
}
