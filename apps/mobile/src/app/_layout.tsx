import { AchievementSync } from '../components/achievement-sync';
import { InviteContinuation } from '../components/invite-continuation';
import { router, Stack, usePathname } from 'expo-router';
import { AppState, type AppStateStatus, Platform, Pressable, View } from 'react-native';
import { AppProviders } from '../providers/app-providers';
import { captureScreenView, initializeMobileTelemetry } from '../lib/telemetry';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useAuth } from '../providers/auth-provider';
import { useOnboarding } from '../providers/onboarding-provider';
import { useTheme } from '../theme';
import { Button, Type } from '../components/ui';
import {
  onboardingRedirect,
  shouldShowOnboarding,
  shouldWaitForSession,
} from '../lib/auth-routing';
import {
  authenticateWithBiometrics,
  biometricAvailability,
  isBiometricUnlockEnabled,
  subscribeBiometricAuthSettled,
  subscribeBiometricPreference,
} from '../lib/biometric-auth';

function CloseSheet() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close sheet"
      onPress={() => router.back()}
      hitSlop={8}
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Type>Done</Type>
    </Pressable>
  );
}

initializeMobileTelemetry();

export const unstable_settings = { initialRouteName: '(tabs)' };
void SplashScreen.preventAutoHideAsync().catch(() => {});
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <AppProviders>
      <Navigation />
    </AppProviders>
  );
}

function Navigation() {
  const { ready, completedUserIds } = useOnboarding();
  const auth = useAuth();
  const pathname = usePathname();
  const screenSince = useRef<{ path: string; at: number } | null>(null);
  useEffect(() => {
    const previous = screenSince.current;
    if (previous?.path === pathname) return;
    const now = Date.now();
    const previousDuration =
      previous && now > previous.at ? Math.round((now - previous.at) / 1000) : null;
    captureScreenView(pathname || 'unknown', previous?.path ?? null, previousDuration);
    screenSince.current = { path: pathname, at: now };
  }, [pathname]);
  const { isDark, colors } = useTheme();
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [biometricRequired, setBiometricRequired] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [biometricOfferEligible, setBiometricOfferEligible] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const inOnboarding = pathname.startsWith('/onboarding');
  const userId = auth.user?.id ?? null;
  const hasSession = auth.session !== null;
  const locallyCompleted = userId !== null && completedUserIds.includes(userId);
  const sessionResolutionPending = shouldWaitForSession(userId, hasSession, auth.isSyncing);
  const sessionCompletionPending = sessionResolutionPending && !locallyCompleted;
  const readyToRender = ready && auth.isReady;
  const waitingBehindSplash = sessionResolutionPending && !inOnboarding;
  const needsOnboarding = shouldShowOnboarding(
    completedUserIds,
    userId,
    auth.session?.user.onboardingState ?? null,
  );
  const onboardingDestination = onboardingRedirect(
    pathname,
    needsOnboarding,
    sessionCompletionPending,
    userId !== null,
  );
  useEffect(() => {
    let active = true;
    setBiometricChecked(false);
    setBiometricRequired(false);
    setBiometricLocked(false);
    setBiometricOfferEligible(false);
    if (!hasSession || !userId) {
      setBiometricChecked(true);
      return () => {
        active = false;
      };
    }
    // Face ID stays strictly opt-in; until it is enabled, each session offers
    // the setup sheet once after the user settles into the main app.
    const check = (lockWhenRequired: boolean) =>
      Promise.all([isBiometricUnlockEnabled(userId), biometricAvailability()])
        .then(([enabled, availability]) => {
          if (!active) return;
          setBiometricLabel(availability.label);
          const required = enabled && availability.available;
          setBiometricRequired(required);
          setBiometricOfferEligible(!enabled && availability.available);
          if (lockWhenRequired || !required) setBiometricLocked(required);
        })
        .catch(() => {
          if (!active) return;
          setBiometricRequired(false);
          setBiometricOfferEligible(false);
          if (lockWhenRequired) setBiometricLocked(false);
        })
        .finally(() => {
          if (active) setBiometricChecked(true);
        });
    void check(true);
    // Keep the lock requirement current when Face ID is toggled from settings
    // while the app is open, without locking the user mid-session.
    const unsubscribe = subscribeBiometricPreference(() => void check(false));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [hasSession, userId]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!biometricRequired) return;
    const lockNow = () => setBiometricLocked(true);
    const subscription = AppState.addEventListener('change', (state) => {
      // System permission dialogs and Face ID make iOS inactive without the
      // user leaving. Only backgrounding should require another unlock.
      if (state === 'background') lockNow();
    });
    // A prompt settling in the background must never reveal account content.
    const unsubscribe = subscribeBiometricAuthSettled(() => {
      if (AppState.currentState === 'background') lockNow();
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [biometricRequired]);
  useEffect(() => {
    if (readyToRender && !waitingBehindSplash && biometricChecked) void SplashScreen.hideAsync();
  }, [readyToRender, waitingBehindSplash, biometricChecked]);
  useEffect(() => {
    if (readyToRender && biometricChecked && onboardingDestination)
      router.replace(onboardingDestination);
  }, [readyToRender, biometricChecked, onboardingDestination]);
  const onMainAppSurface =
    pathname === '/' ||
    pathname === '/portfolio' ||
    pathname === '/leaderboards' ||
    pathname === '/settings';
  useEffect(() => {
    if (
      !hasSession ||
      !biometricChecked ||
      !biometricOfferEligible ||
      !readyToRender ||
      waitingBehindSplash ||
      onboardingDestination ||
      needsOnboarding ||
      biometricLocked ||
      appState !== 'active' ||
      !onMainAppSurface
    )
      return;
    const timer = setTimeout(() => {
      if (AppState.currentState !== 'active') return;
      setBiometricOfferEligible(false);
      router.push('/biometric-setup');
    }, 4500);
    return () => clearTimeout(timer);
  }, [
    appState,
    hasSession,
    userId,
    biometricChecked,
    biometricLocked,
    biometricOfferEligible,
    needsOnboarding,
    onMainAppSurface,
    onboardingDestination,
    readyToRender,
    waitingBehindSplash,
  ]);
  const locked = biometricLocked && hasSession && !inOnboarding && !needsOnboarding;
  const obscured =
    !readyToRender || waitingBehindSplash || !biometricChecked || !!onboardingDestination || locked;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {readyToRender && !onboardingDestination ? <InviteContinuation /> : null}
      {readyToRender ? <AchievementSync /> : null}
      <View
        style={{ flex: 1, opacity: obscured ? 0 : 1 }}
        pointerEvents={obscured ? 'none' : 'auto'}
        accessibilityElementsHidden={obscured}
        importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}
      >
        <Stack
          screenOptions={{
            scrollEdgeEffects: {
              top: 'soft',
              bottom: 'automatic',
              left: 'hidden',
              right: 'hidden',
            },
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            contentStyle: { backgroundColor: colors.background },
            statusBarStyle: isDark ? 'light' : 'dark',
          }}
        >
          <Stack.Screen
            name="achievement/[id]"
            options={{
              title: '',
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.85, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="saltedge/link" options={{ headerShown: false }} />
          <Stack.Screen name="saltedge/callback" options={{ headerShown: false }} />
          <Stack.Screen name="invite" options={{ title: 'Invitation' }} />
          <Stack.Screen
            name="invite-friends"
            options={{
              title: '',
              headerShown: Platform.OS !== 'ios',
              headerRight: CloseSheet,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Beaver' }} />
          <Stack.Screen
            name="biometric-setup"
            options={{
              title: '',
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.72, 1],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="transaction/[id]"
            options={{
              title: '',
              headerShown: Platform.OS !== 'ios',
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
              headerRight: CloseSheet,
            }}
          />
          <Stack.Screen
            name="onboarding/welcome"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/account"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/invite-code"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/name"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/intro"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="funding/index"
            options={{
              title: '',
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.65, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="withdraw/index"
            options={{
              title: '',
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.72, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="mock-data"
            options={{
              title: '',
              headerShown: Platform.OS !== 'ios',
              headerRight: CloseSheet,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.58, 0.72],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="activity"
            options={{
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="settings/[section]"
            options={({ route }) => ({
              title: '',
              headerShown: Platform.OS !== 'ios',
              headerRight: CloseSheet,
              presentation: 'formSheet',
              sheetAllowedDetents:
                (route.params as { section?: string } | undefined)?.section === 'manual'
                  ? [0.42, 0.65]
                  : [0.92, 1],
              sheetGrabberVisible: true,
              // The rules and fallback sections float their save button on the
              // sheet's own material instead of an opaque page background.
              contentStyle: {
                backgroundColor: ['rules', 'fallback'].includes(
                  (route.params as { section?: string } | undefined)?.section ?? '',
                )
                  ? 'transparent'
                  : colors.background,
              },
            })}
          />
          <Stack.Screen
            name="receipt-scan"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'fade',
              statusBarStyle: 'light',
            }}
          />
          <Stack.Screen
            name="receipt-review"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'fade',
              statusBarStyle: 'dark',
            }}
          />
          <Stack.Screen
            name="profile/alias"
            options={{
              title: '',
              headerShown: Platform.OS !== 'ios',
              headerRight: CloseSheet,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="profile/avatar"
            options={{
              title: '',
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.85, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="onboarding/fallback"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/manual"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/rules"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/bank"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/crypto-card-help"
            options={{
              title: '',
              headerShown: Platform.OS !== 'ios',
              headerRight: CloseSheet,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="onboarding/spending"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/controls"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="onboarding/enter-app"
            options={{ headerShown: false, animation: 'fade' }}
          />
        </Stack>
      </View>
      {locked ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <BiometricUnlock
            label={biometricLabel}
            onUnlock={() => setBiometricLocked(false)}
            onUseAccount={() => auth.logout()}
          />
        </View>
      ) : null}
    </View>
  );
}

function BiometricUnlock({
  label,
  onUnlock,
  onUseAccount,
}: {
  label: string;
  onUnlock: () => void;
  onUseAccount: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPrompted = useRef(false);
  const promptInFlight = useRef(false);
  async function unlock() {
    if (promptInFlight.current || AppState.currentState !== 'active') return;
    promptInFlight.current = true;
    autoPrompted.current = true;
    setBusy(true);
    setError(null);
    try {
      await authenticateWithBiometrics(`Unlock Beaver with ${label}`);
      if ((AppState.currentState as AppStateStatus) !== 'background') onUnlock();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please retry.');
    } finally {
      promptInFlight.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let frame: number | undefined;
    const promptWhenActive = () => {
      if (AppState.currentState !== 'active' || autoPrompted.current) return;
      frame = requestAnimationFrame(() => void unlock());
    };
    promptWhenActive();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') autoPrompted.current = false;
      if (state === 'active') promptWhenActive();
    });
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      subscription.remove();
    };
    // One automatic attempt per foreground visit; failed attempts expose retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
      {error ? (
        <View style={{ paddingHorizontal: 28, gap: 18 }}>
          <Type variant="title" accessibilityRole="header">
            Try unlocking again
          </Type>
          <Type muted>{label} protects this account on this device.</Type>
          {error ? <Type accessibilityRole="alert">{error}</Type> : null}
          <Button title={`Unlock with ${label}`} loading={busy} onPress={() => void unlock()} />
          <Button
            title="Use account sign-in"
            secondary
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void onUseAccount()
                .catch(() => setError('Couldn’t sign out. Please try again.'))
                .finally(() => setBusy(false));
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
