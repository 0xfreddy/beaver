import { useEffect, useRef, useState } from 'react';
import { Share, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { CreatedInvite } from '@roundups/types';
import { Button, Screen, Type } from '../components/ui';
import { OnboardingAnimation } from '../components/onboarding-animation';
import { useAuth } from '../providers/auth-provider';
import { apiRequest } from '../lib/api';
import { posthog } from '../lib/telemetry';
import { AuraLift, useAuraLift } from '../components/reacticx/aura-lift';

export default function InviteFriends() {
  return (
    <AuraLift>
      <InviteFriendsContent />
    </AuraLift>
  );
}

function InviteFriendsContent() {
  const auth = useAuth();
  const aura = useAuraLift();
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const [busy, setBusy] = useState<'load' | 'share' | 'copy' | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exhausted = !!invite && invite.redeemed >= invite.redeemLimit;
  const code = invite?.code ?? invite?.token ?? '';
  const animationName =
    busy === 'share'
      ? 'invite-paper-plane'
      : busy === 'copy' || copied
        ? 'invite-stamp-approved'
        : 'access-granted';

  async function load() {
    if (busy || !auth.session) return;
    setBusy('load');
    setError('');
    try {
      setInvite(
        await apiRequest<CreatedInvite>(auth.getAccessToken, '/v1/social/invites', {
          method: 'POST',
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  useEffect(() => {
    if (auth.session) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session]);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  async function perform(action: 'share' | 'copy') {
    if (busy || !invite) return;
    setBusy(action);
    setError('');
    try {
      await aura.lift();
      await new Promise((resolve) => setTimeout(resolve, 360));
      if (action === 'copy') {
        await Clipboard.setStringAsync(invite.link);
        posthog?.capture('invite_link_copied');
      } else {
        // The scheme link opens Beaver directly when installed; the code is the
        // manual fallback for anyone without the app yet.
        await Share.share(
          Platform.OS === 'ios'
            ? {
                url: invite.link,
                message: `Join me on Beaver! My invite code is ${invite.code ?? invite.token}`,
              }
            : {
                message: `Join me on Beaver! My invite code is ${invite.code ?? invite.token} — ${invite.link}`,
              },
        );
        posthog?.capture('invite_shared');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function copyCode() {
    if (!code || copied) return;
    await Clipboard.setStringAsync(code);
    posthog?.capture('invite_code_copied');
    void Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Screen fillContent title="Beaver is better with friends" topPadding={32}>
      {auth.session ? (
        <View style={styles.content}>
          {invite ? (
            <>
              <View style={styles.inviteHero}>
                <OnboardingAnimation
                  key={`${animationName}-${busy ?? copied}`}
                  name={animationName}
                  height={176}
                  loop={animationName === 'access-granted'}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Invite code ${code}. Double tap to copy.`}
                  disabled={!code}
                  onPress={() => void copyCode()}
                  style={styles.codeCard}
                >
                  <Type style={styles.codeText}>{code}</Type>
                  <Type style={styles.codeHint}>{copied ? 'Copied!' : 'Tap to copy'}</Type>
                </Pressable>
              </View>
              <View style={styles.progress}>
                <View style={styles.dots}>
                  {Array.from({ length: invite.redeemLimit }, (_, index) => (
                    <View
                      key={index}
                      style={[styles.dot, index < invite.redeemed && styles.dotRedeemed]}
                    />
                  ))}
                </View>
                <Type muted>
                  {exhausted
                    ? `All ${invite.redeemLimit} invites used`
                    : `${invite.redeemed} of ${invite.redeemLimit} invites used`}
                </Type>
              </View>
            </>
          ) : busy === 'load' ? (
            <>
              <OnboardingAnimation name="access-granted" height={176} loop />
              <Type muted>Getting your invite code…</Type>
            </>
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Share invite"
              appearance="onboarding"
              loading={busy === 'share'}
              disabled={busy !== null || !invite || exhausted}
              onPress={() => void perform('share')}
            />
            <Button
              title="Copy link"
              secondary
              disabled={busy !== null || !invite || exhausted}
              onPress={() => void perform('copy')}
            />
            {!invite && busy !== 'load' ? (
              <Button title="Try again" secondary onPress={() => void load()} />
            ) : null}
          </View>
          {exhausted ? (
            <Type muted style={styles.exhaustedNote}>
              All your invites have been used. Thanks for growing the Beaver community.
            </Type>
          ) : null}
          {error ? <Type accessibilityRole="alert">{error}</Type> : null}
        </View>
      ) : (
        <View style={styles.actions}>
          <Button title="Sign in" onPress={() => router.push('/onboarding/account')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 16, paddingTop: 24, justifyContent: 'flex-end' },
  inviteHero: { gap: 0 },
  codeCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingVertical: 16,
    gap: 6,
  },
  codeText: { color: '#000000', fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: 8 },
  codeHint: { color: '#555555', fontSize: 13, lineHeight: 18 },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF' },
  dotRedeemed: { backgroundColor: '#FFFFFF' },
  actions: { gap: 12, marginTop: 'auto', paddingTop: 32 },
  exhaustedNote: { textAlign: 'center' },
});
