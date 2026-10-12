import { DynamicNotificationHost } from '../components/dynamic-notification-host';
import { AchievementSync } from '../components/achievement-sync';
import { InviteContinuation } from '../components/invite-continuation';
import { router, Stack, usePathname, type Href } from 'expo-router';
import { AppState, type AppStateStatus, Platform, Pressable, View } from 'react-native';
import { AppProviders } from '../providers/app-providers';
import { captureScreenView, initializeMobileTelemetry } from '../lib/telemetry';
import { useNotifications } from '../lib/use-notifications';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useAuth } from '../providers/auth-provider';
import { useBiometricLock } from '../lib/use-biometric-lock';
import { useBankRecovery } from '../lib/use-bank-recovery';
import { useOnboarding } from '../providers/onboarding-provider';
import { useTheme } from '../theme';
import { Type } from '../components/ui';
import { BrandedWaitSurface } from '../components/branded-wait-surface';
import {
  onboardingRedirect,
  shouldShowOnboarding,
  shouldWaitForSession,
} from '../lib/auth-routing';
import { BiometricUnlock } from '../components/biometric-unlock';

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
  return (
    <AppProviders>
      <Navigation fontsReady={fontsLoaded || !!fontError} />
    </AppProviders>
  );
}

function Navigation({ fontsReady }: { fontsReady: boolean }) {
  useBankRecovery();
  const { ready, completedUserIds, resumePath, rememberPath } = useOnboarding();
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
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const inOnboarding = pathname.startsWith('/onboarding');
  const userId = auth.user?.id ?? null;
  const hasSession = auth.session !== null;
  const {
    biometricChecked,
    biometricRequired,
    biometricLocked,
    biometricLabel,
    biometricOfferEligible,
    setBiometricOfferEligible,
    setBiometricLocked,
  } = useBiometricLock(userId);
  const locallyCompleted = userId !== null && completedUserIds.includes(userId);
  const sessionResolutionPending = shouldWaitForSession(userId, hasSession, auth.isSyncing);
  const sessionCompletionPending = sessionResolutionPending && !locallyCompleted;
  const readyToRender = fontsReady && ready && auth.isReady;
  const waitingBehindSplash = sessionResolutionPending && !inOnboarding;
  const needsOnboarding = shouldShowOnboarding(
    completedUserIds,
    userId,
    auth.session?.user.onboardingState ?? null,
  );
  const redirect = onboardingRedirect(
    pathname,
    needsOnboarding,
    sessionCompletionPending,
    userId !== null,
  );
  const onboardingDestination =
    redirect === '/onboarding/invite-code' && resumePath ? resumePath : redirect;
  useEffect(() => {
    if (readyToRender && userId && !onboardingDestination && pathname.startsWith('/onboarding/'))
      rememberPath(pathname);
    // Record route transitions, not provider callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, readyToRender, userId, onboardingDestination]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (readyToRender && biometricChecked && onboardingDestination)
      router.replace(onboardingDestination as Href);
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
    setBiometricOfferEligible,
    needsOnboarding,
    onMainAppSurface,
    onboardingDestination,
    readyToRender,
    waitingBehindSplash,
  ]);
  const locked =
    biometricLocked && !!userId && !inOnboarding && (locallyCompleted || !needsOnboarding);
  const resolvingAccount =
    !readyToRender || waitingBehindSplash || !biometricChecked || !!onboardingDestination;
  const privacyCovered = biometricRequired && !!userId && appState !== 'active';
  const obscured = resolvingAccount || locked || privacyCovered;
  useNotifications({
    canNavigate: !obscured && !needsOnboarding && hasSession && appState === 'active',
    canOffer:
      !obscured &&
      !needsOnboarding &&
      hasSession &&
      !biometricOfferEligible &&
      onMainAppSurface &&
      appState === 'active',
  });
  const splashHidden = useRef(false);
  const hideNativeSplash = () => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    void SplashScreen.hideAsync();
  };
  return (
    <View onLayout={hideNativeSplash} style={{ flex: 1, backgroundColor: colors.background }}>
      <DynamicNotificationHost
        enabled={
          !obscured &&
          !needsOnboarding &&
          hasSession &&
          !biometricOfferEligible &&
          appState === 'active'
        }
      />
      {readyToRender && !onboardingDestination ? <InviteContinuation /> : null}
      {readyToRender ? (
        <AchievementSync
          enabled={
            !obscured && !needsOnboarding && !biometricOfferEligible && appState === 'active'
          }
        />
      ) : null}
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
              sheetAllowedDetents: [0.65, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="saltedge/link"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="bank-picker"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="saltedge/callback" options={{ headerShown: false }} />
          <Stack.Screen name="invite" options={{ title: 'Invitation' }} />
          <Stack.Screen
            name="invite-friends"
            options={{
              title: '',
              headerShown: Platform.OS === 'web',
              headerRight: CloseSheet,
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Beaver' }} />
          <Stack.Screen
            name="notification/[id]"
            options={{
              headerShown: false,
              presentation: 'formSheet',
              sheetAllowedDetents: [1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="notification-setup"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
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
              headerShown: Platform.OS === 'web',
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
              headerShown: Platform.OS === 'web',
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
              headerShown:
                Platform.OS === 'web' ||
                (Platform.OS === 'android' &&
                  (route.params as { section?: string } | undefined)?.section === 'fallback'),
              headerRight: CloseSheet,
              // Android's sheet drag recognizer competes with the nested stock
              // list. A regular modal leaves vertical gestures with the list.
              presentation:
                Platform.OS === 'android' &&
                (route.params as { section?: string } | undefined)?.section === 'fallback'
                  ? 'modal'
                  : 'formSheet',
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
              headerShown: Platform.OS === 'web',
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
              sheetAllowedDetents: [0.65, 1],
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
            name="onboarding/explainer"
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
              headerShown: Platform.OS === 'web',
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
      {resolvingAccount || privacyCovered ? (
        <BrandedWaitSurface accessibilityLabel="Loading Beaver" still />
      ) : null}
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
