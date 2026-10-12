import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, TextButton, Type } from '../components/ui';
import { OnboardingAnimation } from '../components/onboarding-animation';
import { OnboardingNotificationCard } from '../components/onboarding-notification-stack';
import { useAuth } from '../providers/auth-provider';
import { useProfile } from '../providers/profile-provider';
import { useTheme } from '../theme';
import {
  notificationPermissionState,
  openNotificationSettings,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../lib/notifications';
import { acceptNotificationConsent } from '../lib/notification-consent';
import { syncNotificationRegistration } from '../lib/notification-registration';
import { notificationOfferKey } from '../lib/use-notifications';
import { posthog } from '../lib/telemetry';

export default function NotificationSetup() {
  const auth = useAuth();
  const { profile } = useProfile();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const userId = auth.session?.user.id;
  const owner = useRef(userId);
  owner.current = userId;
  const mounted = useRef(true);
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const refresh = () =>
      void notificationPermissionState()
        .then((value) => {
          if (active) setPermission(value);
        })
        .catch(() => {
          if (active) setError('Couldn’t check notification permission. Try again.');
        });
    refresh();
    if (userId) void AsyncStorage.setItem(notificationOfferKey(userId), 'shown').catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      mounted.current = false;
      sub.remove();
    };
  }, [userId]);
  async function activate() {
    if (!userId || running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await acceptNotificationConsent(userId);
      if (permission === 'denied') {
        await openNotificationSettings();
        return;
      }
      const next = await requestNotificationPermission();
      if (!mounted.current || owner.current !== userId) return;
      setPermission(next);
      posthog?.capture('notification_permission_requested', { granted: next === 'granted' });
      if (next !== 'granted') return;
      const registered = await syncNotificationRegistration(
        userId,
        auth.getAccessToken,
        () => mounted.current && owner.current === userId,
      );
      if (!mounted.current || owner.current !== userId) return;
      if (registered) dismiss();
      else setError('Notifications are enabled. We couldn’t finish registration yet. Try again.');
    } catch {
      if (!mounted.current || owner.current !== userId) return;
      setError('Notification setup could not finish. Check your connection and try again.');
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const name = profile.alias && profile.alias !== 'Roundups member' ? `${profile.alias}, ` : '';
  return (
    <NotificationInvitation
      name={name}
      permission={permission}
      busy={busy}
      error={error}
      ready={!!userId}
      onActivate={() => void activate()}
      onDismiss={dismiss}
    />
  );
}

export function NotificationInvitation({
  name = '',
  permission,
  busy,
  error,
  ready,
  onActivate,
  onDismiss,
}: {
  name?: string;
  permission: NotificationPermissionState | null;
  busy: boolean;
  error: string | null;
  ready: boolean;
  onActivate: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="never"
      onAccessibilityEscape={onDismiss}
      contentContainerStyle={{
        flexGrow: 1,
        maxWidth: 520,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 28,
        paddingTop: insets.top + 24,
        paddingBottom: Math.max(insets.bottom, 24),
        gap: 24,
      }}
    >
      <View style={{ gap: 12, paddingTop: 16 }}>
        <Type
          variant="title"
          accessibilityRole="header"
          style={{ fontSize: 32, lineHeight: 38, textAlign: 'center', letterSpacing: -0.7 }}
        >
          {'Little updates. Real progress.'}
        </Type>
        <Type muted style={{ textAlign: 'center', lineHeight: 24 }}>
          Follow your spare change from everyday purchases to investments.
        </Type>
      </View>
      <View style={{ gap: 10, paddingVertical: 16 }}>
        <OnboardingNotificationCard
          beaverIcon
          index={0}
          merchant="Beaver"
          detail={`${name}your first roundup invested in Starbucks.`}
          amount="$0.35"
        />
        <OnboardingNotificationCard
          beaverIcon
          index={1}
          merchant="Beaver"
          detail="Your 25.00 USDC deposit arrived."
        />
        <OnboardingNotificationCard
          beaverIcon
          index={2}
          merchant="Beaver"
          detail="Your friend accepted your invite."
        />
      </View>
      <View style={{ marginTop: 'auto', gap: 12 }}>
        {error ? (
          <Type accessibilityRole="alert" style={{ textAlign: 'center' }}>
            {error}
          </Type>
        ) : null}
        {permission === 'denied' ? (
          <Type variant="caption" muted style={{ textAlign: 'center' }}>
            Notifications are off. Turn them on in system settings.
          </Type>
        ) : null}
        <OnboardingAnimation name="notifications" height={168} loop />
        <Button
          appearance="onboarding"
          title={
            permission === 'denied'
              ? 'Open system settings'
              : permission === 'granted'
                ? 'Finish notification setup'
                : 'Activate notifications'
          }
          loading={busy}
          disabled={!ready || permission === null}
          onPress={onActivate}
        />
        <TextButton title="Not now" onPress={onDismiss} />
      </View>
    </ScrollView>
  );
}
