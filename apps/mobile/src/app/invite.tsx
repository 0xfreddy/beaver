import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import type { InviteResolution } from '@roundups/types';
import { Button, Screen, Type } from '../components/ui';
import { ProfileAvatar } from '../components/profile-avatar';
import { InteractiveArt, socialArt } from '../components/interactive-art';
import { useAuth } from '../providers/auth-provider';
import { apiRequest } from '../lib/api';
import { invitationMessages, useSocialMutation } from '../lib/social';
import { rememberInvite, clearInvite, isInviteToken } from '../lib/pending-invite';
export default function Invitation() {
  const { token: raw } = useLocalSearchParams<{ token?: string }>();
  const token = typeof raw === 'string' ? raw : '';
  const valid = isInviteToken(token);
  const auth = useAuth();
  const [error, setError] = useState('');
  const preview = useQuery({
    queryKey: ['social', auth.user?.id, 'invitation', token],
    enabled: valid && !!auth.session,
    retry: false,
    queryFn: () =>
      apiRequest<InviteResolution>(auth.getAccessToken, '/v1/social/invites/resolve', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  });
  const accept = useSocialMutation<InviteResolution>('/invites/accept');
  useFocusEffect(
    useCallback(() => {
      accept.reset();
      if (valid && auth.session) void preview.refetch();
      // Refresh on return to a previously visited invitation after relationship changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, auth.user?.id, !!auth.session]),
  );
  const result = preview.isFetching ? undefined : preview.data;
  async function leave() {
    await clearInvite();
    router.dismissAll();
    router.replace('/settings');
  }
  return (
    <Screen title="Invitation">
      <InteractiveArt source={socialArt.invite} name="invite link" size={150} />
      {!valid ? (
        <Type accessibilityRole="alert">This invitation is not valid.</Type>
      ) : !auth.session ? (
        <>
          <Type variant="headline">A connection starts here</Type>
          <Type muted>
            Sign in to view the invitation, then choose whether to accept. Nothing is accepted
            automatically.
          </Type>
          <Button
            title="Sign in to view invitation"
            onPress={() =>
              void rememberInvite(token)
                .then(() => router.push('/onboarding/account'))
                .catch((e) => setError(e.message))
            }
          />
        </>
      ) : (
        <>
          {preview.isPending || preview.isFetching ? (
            <Type accessibilityLiveRegion="polite">Loading invitation…</Type>
          ) : null}
          {result?.inviter ? (
            <>
              <ProfileAvatar id={result.inviter.avatarId} size={72} />
              <Type variant="headline">{result.inviter.alias}</Type>
            </>
          ) : null}
          {result ? <Type>{invitationMessages[result.status]}</Type> : null}
          {result?.status === 'available' ? (
            <>
              <Type muted>
                Accepting makes you friends. You both see each other’s alias, avatar and season
                points. Your financial details stay private.
              </Type>
              <Button
                title="Accept invitation"
                loading={accept.isPending}
                onPress={() =>
                  void accept
                    .mutateAsync({ token })
                    .then(() => clearInvite())
                    .catch(() => {})
                }
              />
            </>
          ) : null}
          {result?.status === 'already-friends' ? (
            <Button
              title="View Friends leaderboard"
              onPress={() => {
                void clearInvite();
                router.replace('/leaderboards?scope=friends');
              }}
            />
          ) : null}
          {preview.error || accept.error ? (
            <>
              <Type accessibilityRole="alert">{(preview.error ?? accept.error)?.message}</Type>
              <Button
                title="Retry"
                secondary
                onPress={() => {
                  accept.reset();
                  void preview.refetch();
                }}
              />
            </>
          ) : null}
        </>
      )}
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
      <Button
        title={result?.status === 'already-friends' ? 'Done' : 'Not now'}
        secondary
        disabled={accept.isPending}
        onPress={() => void leave()}
      />
    </Screen>
  );
}
