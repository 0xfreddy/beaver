import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { inviteCodeLength } from '@roundups/types';
import type { InviteResolution } from '@roundups/types';
import { Button, TextButton, Type } from '../../components/ui';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { SetupPage } from '../../components/setup-page';
import { useAuth } from '../../providers/auth-provider';
import { useTheme } from '../../theme';
import { apiRequest } from '../../lib/api';
import { invitationMessages } from '../../lib/social';
import { pendingInvite, clearInvite } from '../../lib/pending-invite';
import { posthog } from '../../lib/telemetry';

export default function InviteCode() {
  const auth = useAuth();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [code, setCode] = useState('');
  // A pending invite opened from a link. Codes prefill the field; a legacy
  // 43-character link token is redeemed on continue without typing.
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the code is redeemed server-side; the reveal plays before continuing.
  const [redeemed, setRedeemed] = useState(false);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    let active = true;
    void pendingInvite().then((token) => {
      if (!active || !token) return;
      if (token.length === inviteCodeLength) setCode(token);
      else setLinkToken(token);
    });
    return () => {
      active = false;
    };
  }, []);
  const trimmed = code.trim();
  const activeToken = trimmed.length === inviteCodeLength ? trimmed : linkToken;
  const continueLabel = redeemed
    ? 'Continue'
    : linkToken && trimmed.length !== inviteCodeLength
      ? 'Accept invite'
      : 'Verify';

  function leave() {
    router.replace('/onboarding/name');
  }
  async function backToSignIn() {
    if (busy || leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await auth.logout();
      router.replace('/onboarding/account');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t sign out. Try again.');
    } finally {
      setLeaving(false);
    }
  }
  async function redeem() {
    if (busy || leaving || redeemed || !activeToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<InviteResolution>(
        auth.getAccessToken,
        '/v1/social/invites/accept',
        {
          method: 'POST',
          body: JSON.stringify({ token: activeToken }),
        },
      );
      if (result.status !== 'already-friends') {
        setError(invitationMessages[result.status] ?? 'This invite could not be accepted.');
        return;
      }
      await clearInvite();
      posthog?.capture('invite_code_accepted');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      inputRef.current?.blur();
      // Codes that name their origin earn the reveal before continuing; the
      // shared review codes pass straight through to keep App Review fast.
      const name = result.inviterName ?? result.inviter?.alias ?? null;
      if (!name) {
        leave();
        return;
      }
      setInviterName(name);
      setRedeemed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t redeem this code. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupPage
      title={'Got an invite\nfrom a friend?'}
      description={
        redeemed
          ? 'Your invite is connected. Continue to keep setting up your account.'
          : linkToken && trimmed.length !== inviteCodeLength
            ? 'Your invitation is ready. Continue to connect with the friend who invited you.'
            : 'Enter the invite code to connect. You can add friends anytime later.'
      }
      keyboard
      artwork={
        <View style={styles.artwork}>
          <OnboardingAnimation name="access-code-binoculars" height={116} loop />
        </View>
      }
      topPadding={8}
      actions={
        <>
          <Button
            appearance="onboarding"
            title={continueLabel}
            disabled={!activeToken || leaving}
            loading={busy}
            onPress={() => (redeemed ? leave() : void redeem())}
          />
          {redeemed ? null : (
            <TextButton
              title="Back to sign in"
              disabled={busy || leaving}
              onPress={() => void backToSignIn()}
            />
          )}
        </>
      }
    >
      <View style={styles.field}>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Invite code"
          autoFocus={!code}
          value={code}
          onChangeText={(value) => {
            if (redeemed) return;
            setCode(
              value
                .replace(/[^A-Za-z0-9]/g, '')
                .toUpperCase()
                .slice(0, inviteCodeLength),
            );
            setError(null);
          }}
          editable={!busy && !redeemed}
          placeholder="XXXX"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType="ascii-capable"
          maxLength={inviteCodeLength}
          returnKeyType="go"
          onSubmitEditing={() => void redeem()}
          style={[styles.input, { color: colors.ink, borderBottomColor: colors.ink }]}
        />
      </View>
      {redeemed && inviterName ? (
        <View style={styles.referralReveal}>
          <View pointerEvents="none" style={styles.invitePeekPanel}>
            <OnboardingAnimation name="invite-peek" height={172} loop={false} />
          </View>
          <Animated.View
            key={inviterName}
            entering={FadeIn.delay(reducedMotion ? 0 : 180)
              .duration(reducedMotion ? 140 : 260)
              .easing(Easing.bezier(0.23, 1, 0.32, 1))}
            style={styles.referralMessage}
          >
            <View style={styles.referralBubble}>
              <Type accessibilityLiveRegion="polite" style={styles.referralCopy}>
                welcome, seems like you know {inviterName}
              </Type>
            </View>
          </Animated.View>
        </View>
      ) : null}
      {error ? (
        <Type accessibilityRole="alert" muted>
          {error}
        </Type>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  artwork: { marginBottom: -18 },
  field: { width: '100%' },
  input: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    paddingVertical: 12,
    fontSize: 22,
    textAlign: 'left',
    letterSpacing: 6,
    writingDirection: 'ltr',
  },
  referralReveal: {
    height: 172,
    marginHorizontal: -28,
    position: 'relative',
  },
  // Dark gallery panel: the artwork's own black canvas is part of the design
  // in both appearances, mirroring the welcome-screen illustration frames.
  invitePeekPanel: {
    position: 'absolute',
    right: 0,
    top: 14,
    width: 172,
    height: 172,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  referralMessage: { position: 'absolute', left: 46, right: 156, bottom: 26 },
  // Incoming-message bubble from the beaver: white with black text in both
  // appearances so it reads against the black panel and any screen color.
  referralBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  referralCopy: {
    fontSize: 17,
    lineHeight: 24,
    color: '#111111',
    textAlign: 'left',
  },
});
