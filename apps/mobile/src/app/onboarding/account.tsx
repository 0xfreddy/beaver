import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Type } from '../../components/ui';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { useTheme } from '../../theme';
import { useAuth } from '../../providers/auth-provider';
import { useOnboarding } from '../../providers/onboarding-provider';
import { fetchSession } from '../../lib/api';
import { classifyOtpError } from '../../lib/otp-error';
import { normalizePhoneNumber } from '../../lib/phone';
import {
  isReviewAuthCode,
  isReviewAuthEmail,
  isReviewAuthEnabled,
  isTeamAuthCode,
} from '../../lib/review-auth';
import { AppSymbol } from '../../components/app-symbol';

type VerificationState = 'idle' | 'granted' | 'denied' | 'expired';
const appleSignInEnabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';
const phoneSignInEnabled = false;

function triggerErrorShake(value: SharedValue<number>, reducedMotion: boolean) {
  if (!reducedMotion) {
    value.set(
      withSequence(
        withTiming(-12, { duration: 45 }),
        withTiming(10, { duration: 55 }),
        withTiming(-8, { duration: 55 }),
        withTiming(5, { duration: 55 }),
        withSpring(0, { stiffness: 620, damping: 34 }),
      ),
    );
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export default function Account() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'options' | 'email' | 'phone' | 'code'>('options');
  const [codeChannel, setCodeChannel] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [verification, setVerification] = useState<VerificationState>('idle');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const transitionClaimed = useRef(false);
  const shake = useSharedValue(0);
  const termsShake = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (Platform.OS === 'ios' && appleSignInEnabled)
      void AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const completeSignIn = useCallback(async () => {
    if (transitionClaimed.current) return;
    transitionClaimed.current = true;
    setLeaving(true);
    // Returning users must land in the app, not back in the introduction. The
    // layout-level redirect only settles after the biometric check, so decide
    // here from a freshly fetched session state.
    const session = await fetchSession(auth.getAccessToken).catch(() => null);
    const serverState = session?.user.onboardingState ?? null;
    const completed =
      (serverState !== null && serverState !== 'new') ||
      onboarding.completedUserIds.includes(auth.user?.id ?? '');
    router.replace(completed ? '/' : '/onboarding/invite-code');
  }, [auth.getAccessToken, auth.user?.id, onboarding.completedUserIds]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: reducedMotion ? [] : [{ translateX: shake.get() }],
  }));
  const termsShakeStyle = useAnimatedStyle(() => ({
    transform: reducedMotion ? [] : [{ translateX: termsShake.get() }],
  }));

  function continueAfterTerms(action: () => void) {
    if (termsAccepted) {
      action();
      return;
    }
    triggerErrorShake(termsShake, reducedMotion);
    void AccessibilityInfo.announceForAccessibility('Accept the Terms and Conditions to continue.');
  }

  async function enterApp() {
    if (leaving || !auth.session) return;
    completeSignIn();
  }
  async function sendCode() {
    if (busy || !auth.isReady || !auth.configured) return;
    // Resends arrive from the code screen, where the channel lives in state.
    const channel: 'email' | 'phone' =
      mode === 'phone' || (mode === 'code' && codeChannel === 'phone') ? 'phone' : 'email';
    if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (channel === 'phone' && !normalizePhoneNumber(phone)) {
      setError('Enter a valid phone number including its country code, like +1 555 010 1234.');
      return;
    }
    setBusy(true);
    setError(null);
    setVerification('idle');
    try {
      if (channel === 'phone') await auth.sendPhoneCode(phone);
      else await auth.sendEmailCode(email.trim());
      setCodeChannel(channel);
      setMode('code');
      setCode('');
      setCooldown(30);
    } catch (cause) {
      setError(
        classifyOtpError(cause) === 'rate-limited'
          ? 'Too many requests. Wait a moment, then try again.'
          : 'We couldn’t send a code. Please try again or use another sign-in method.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function verifyCode() {
    if (busy || verification === 'granted' || (!bypassCodeUsable && !/^\d{6}$/.test(code))) return;
    setBusy(true);
    setError(null);
    setVerification('idle');
    try {
      if (codeChannel === 'phone') await auth.loginWithPhone(phone, code);
      else await auth.loginWithEmail(email.trim(), code);
      setVerification('granted');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) {
      const failure = classifyOtpError(cause);
      if (failure === 'expired' || failure === 'rate-limited') {
        setCode('');
        setCooldown(failure === 'rate-limited' ? 10 : 0);
        setVerification('expired');
        setError(
          failure === 'rate-limited'
            ? 'Too many attempts. Wait a moment, then request a new code.'
            : 'That code expired. Request a fresh one below.',
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      if (failure === 'unavailable') {
        setVerification('idle');
        setError('We couldn’t complete sign-in. Check your connection and try again.');
        return;
      }
      setVerification('denied');
      setError('That code isn’t right. Check the digits and try again.');
      triggerErrorShake(shake, reducedMotion);
    } finally {
      setBusy(false);
    }
  }
  async function signInWithApple() {
    if (busy || !auth.isReady) return;
    setBusy(true);
    setError(null);
    try {
      await auth.loginWithApple();
      completeSignIn();
    } catch {
      setError('Apple sign-in wasn’t completed. You can try again or use another method.');
    } finally {
      setBusy(false);
    }
  }
  async function signInWithGoogle() {
    if (busy || !auth.isReady) return;
    setBusy(true);
    setError(null);
    try {
      await auth.loginWithGoogle();
      completeSignIn();
    } catch {
      setError('Google sign-in wasn’t completed. You can try again or use another method.');
    } finally {
      setBusy(false);
    }
  }
  async function switchAccount() {
    if (busy || leaving) return;
    setBusy(true);
    setError(null);
    try {
      await auth.logout();
      setMode('options');
      setEmail('');
      setPhone('');
      setCode('');
      setVerification('idle');
      transitionClaimed.current = false;
    } catch {
      setError('We couldn’t sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function retrySession() {
    if (busy || leaving) return;
    setBusy(true);
    setError(null);
    try {
      await auth.refreshSession();
    } catch {
      setError('We couldn’t finish connecting. Try again, or use another account.');
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle = [
    styles.input,
    {
      color: colors.ink,
      backgroundColor: colors.surface,
      borderColor: colors.line,
    },
  ];
  // Mock-data builds accept the alphanumeric review/team access codes; everywhere
  // else the field stays a plain six-digit OTP input.
  const bypassCodeUsable =
    isReviewAuthEnabled() &&
    codeChannel === 'email' &&
    (isTeamAuthCode(code) || isReviewAuthCode(email, code));
  // Alphanumeric entry only exists on the email channel of a review-enabled build.
  // Everyone else — including testers on those builds — gets the number pad; the
  // qwerty keyboard stays only for the dedicated review address, whose code has
  // letters. Team codes remain usable elsewhere via paste.
  const alphanumericCodeEntry = isReviewAuthEnabled() && codeChannel === 'email';
  const qwertyCodeEntry = alphanumericCodeEntry && isReviewAuthEmail(email);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {mode === 'options' ? (
          <View style={{ paddingTop: 24 }}>
            <OnboardingAnimation name="first-screen" height={220} />
          </View>
        ) : null}
        <View style={[styles.intro, mode === 'options' && { paddingTop: 24, gap: 20 }]}>
          <Type
            variant="story"
            accessibilityRole="header"
            style={
              mode === 'options' ? { fontSize: 28, lineHeight: 34, textAlign: 'center' } : undefined
            }
          >
            {mode === 'code'
              ? 'Verify.'
              : auth.session
                ? 'Welcome back.'
                : auth.user
                  ? 'Signing you in.'
                  : mode === 'email'
                    ? 'What’s your email?'
                    : mode === 'phone'
                      ? 'What’s your phone number?'
                      : 'Create your account.'}
          </Type>
          {mode === 'code' || auth.session || auth.user ? (
            <Type
              muted
              style={{
                fontSize: 17,
                lineHeight: 25,
                textAlign: 'left',
              }}
            >
              {mode === 'code'
                ? isReviewAuthEnabled() && codeChannel === 'email' && isReviewAuthEmail(email)
                  ? 'Use your review access code. No email is sent for this sample account.'
                  : codeChannel === 'phone'
                    ? `Enter the six-digit code sent to ${phone.trim()}. Check your messages if it hasn’t arrived.`
                    : `We sent an email to ${email.trim()}. Check your spam folder if it hasn’t arrived.`
                : auth.session
                  ? (auth.user?.email ?? auth.user?.phone ?? 'Continue with your current account.')
                  : 'Just a moment.'}
            </Type>
          ) : null}
        </View>
        <View style={{ flex: 1, minHeight: 28 }} />
        <View style={styles.actions}>
          {auth.user && verification !== 'granted' ? (
            <>
              {auth.session ? (
                <>
                  <Button
                    appearance="onboarding"
                    title={
                      auth.user.email
                        ? `Continue as ${auth.user.email}`
                        : auth.user.phone
                          ? `Continue as ${auth.user.phone}`
                          : 'Continue with Privy'
                    }
                    onPress={() => void enterApp()}
                    loading={leaving}
                  />
                  <Button
                    title="Use another account"
                    secondary
                    loading={busy}
                    disabled={leaving}
                    onPress={() => void switchAccount()}
                  />
                </>
              ) : (
                <>
                  <Button
                    appearance="onboarding"
                    title={auth.isSyncing ? 'Finishing sign-in…' : 'Try connecting again'}
                    loading={busy || auth.isSyncing}
                    disabled={busy}
                    onPress={() => void retrySession()}
                  />
                  <Button
                    title="Use another account"
                    secondary
                    loading={busy}
                    disabled={auth.isSyncing}
                    onPress={() => void switchAccount()}
                  />
                </>
              )}
            </>
          ) : !auth.configured ? (
            <>
              <View
                style={[
                  styles.notice,
                  { backgroundColor: colors.surface, borderColor: colors.line },
                ]}
              >
                <Type variant="headline">Sign-in unavailable</Type>
                <Type muted>
                  {Platform.OS === 'web'
                    ? 'Use the iOS app to create or access your account.'
                    : 'Sign-in is not configured for this build.'}
                </Type>
              </View>
            </>
          ) : mode === 'options' ? (
            <>
              <Button
                appearance="onboarding"
                title="Continue with Google"
                labelStyle={{ fontWeight: '500' }}
                disabled={busy || !auth.isReady}
                loading={busy}
                onPress={() => continueAfterTerms(() => void signInWithGoogle())}
              />
              {appleAvailable ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={
                    isDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={14}
                  style={{ height: 56, width: '100%', opacity: busy || !auth.isReady ? 0.5 : 1 }}
                  onPress={() => continueAfterTerms(() => void signInWithApple())}
                />
              ) : null}
              <Button
                appearance="onboarding"
                title="Continue with email"
                secondary
                disabled={busy || !auth.isReady}
                loading={busy}
                onPress={() => {
                  continueAfterTerms(() => {
                    setMode('email');
                    setError(null);
                    setVerification('idle');
                  });
                }}
              />
              {phoneSignInEnabled ? (
                <Button
                  appearance="onboarding"
                  title="Continue with phone"
                  secondary
                  disabled={busy || !auth.isReady}
                  loading={busy}
                  onPress={() => {
                    continueAfterTerms(() => {
                      setMode('phone');
                      setError(null);
                      setVerification('idle');
                    });
                  }}
                />
              ) : null}
              <Animated.View style={[termsShakeStyle, styles.termsRow]}>
                <Pressable
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityLabel="Accept Terms and Conditions and Privacy Policy"
                  accessibilityState={{ checked: termsAccepted }}
                  onPress={() => {
                    setTermsAccepted((accepted) => !accepted);
                    void Haptics.selectionAsync().catch(() => {});
                  }}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: termsAccepted ? colors.ink : 'transparent',
                        borderColor: termsAccepted ? colors.ink : colors.muted,
                      },
                    ]}
                  >
                    {termsAccepted ? (
                      <AppSymbol name="check" color={colors.background} size={14} />
                    ) : null}
                  </View>
                </Pressable>
                <Type style={styles.termsText}>
                  I accept the{' '}
                  <Type
                    accessibilityRole="link"
                    style={styles.legalLink}
                    onPress={() => {
                      void WebBrowser.openBrowserAsync('https://trybeaver.app/terms').catch(() => {
                        setError('Couldn’t open the terms. Please try again.');
                      });
                    }}
                  >
                    Terms & Conditions
                  </Type>
                  {' and '}
                  <Type
                    accessibilityRole="link"
                    style={styles.legalLink}
                    onPress={() => {
                      void WebBrowser.openBrowserAsync('https://trybeaver.app/privacy').catch(
                        () => {
                          setError('Couldn’t open the privacy policy. Please try again.');
                        },
                      );
                    }}
                  >
                    Privacy Policy
                  </Type>
                </Type>
              </Animated.View>
            </>
          ) : (
            <>
              {mode === 'email' ? (
                <>
                  <TextInput
                    accessibilityLabel="Email address"
                    autoFocus
                    defaultValue={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setError(null);
                    }}
                    editable={!busy}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    returnKeyType="go"
                    onSubmitEditing={() => void sendCode()}
                    style={fieldStyle}
                  />
                  <Button
                    appearance="onboarding"
                    title="Send me a code"
                    loading={busy}
                    onPress={() => void sendCode()}
                  />
                </>
              ) : mode === 'phone' ? (
                <>
                  <TextInput
                    accessibilityLabel="Phone number"
                    autoFocus
                    defaultValue={phone}
                    onChangeText={(value) => {
                      setPhone(value);
                      setError(null);
                    }}
                    editable={!busy}
                    placeholder="+1 555 010 1234"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    keyboardType="phone-pad"
                    returnKeyType="go"
                    onSubmitEditing={() => void sendCode()}
                    style={fieldStyle}
                  />
                  <Button
                    appearance="onboarding"
                    title="Send me a code"
                    loading={busy}
                    onPress={() => void sendCode()}
                  />
                </>
              ) : (
                <>
                  {verification === 'granted' ? (
                    <View
                      accessibilityRole="alert"
                      accessibilityLabel="Access granted"
                      pointerEvents="none"
                      style={styles.verificationResult}
                    >
                      <OnboardingAnimation
                        name="access-granted"
                        height={148}
                        onAnimationFinish={completeSignIn}
                      />
                    </View>
                  ) : (
                    <>
                      {verification === 'denied' ? (
                        <View pointerEvents="none" style={styles.verificationResult}>
                          <OnboardingAnimation name="access-denied" height={104} />
                        </View>
                      ) : null}
                      <Animated.View
                        style={[
                          styles.codeField,
                          styles.input,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.line,
                          },
                          shakeStyle,
                        ]}
                      >
                        <View pointerEvents="none" style={styles.codeDigits}>
                          {Array.from({ length: 6 }, (_, index) => (
                            <CodeDigit key={index} digit={code[index] ?? ''} />
                          ))}
                        </View>
                        <TextInput
                          accessibilityLabel="Verification code"
                          autoFocus
                          value={code}
                          onChangeText={(value) => {
                            setCode(
                              (alphanumericCodeEntry
                                ? value.replace(/[^A-Za-z0-9]/g, '')
                                : value.replace(/\D/g, '')
                              )
                                .toUpperCase()
                                .slice(0, 6),
                            );
                            setError(null);
                            setVerification('idle');
                          }}
                          editable={!busy}
                          placeholder="000000"
                          placeholderTextColor={colors.muted}
                          keyboardType={qwertyCodeEntry ? 'default' : 'number-pad'}
                          autoCapitalize={alphanumericCodeEntry ? 'characters' : 'none'}
                          autoCorrect={false}
                          autoComplete="one-time-code"
                          textContentType="oneTimeCode"
                          maxLength={6}
                          caretHidden
                          selectionColor="transparent"
                          style={styles.codeInput}
                        />
                      </Animated.View>
                    </>
                  )}
                  {verification === 'expired' || (error && mode === 'code') ? (
                    <Type accessibilityRole="alert" muted>
                      {error}
                    </Type>
                  ) : null}
                  {verification === 'granted' ? null : verification === 'expired' ? (
                    <Button
                      appearance="onboarding"
                      title={cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                      disabled={busy || cooldown > 0}
                      loading={busy}
                      onPress={() => void sendCode()}
                    />
                  ) : (
                    <>
                      <Button
                        appearance="onboarding"
                        title="Verify and continue"
                        disabled={code.length !== 6 && !bypassCodeUsable}
                        loading={busy}
                        onPress={() => void verifyCode()}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || cooldown > 0}
                        onPress={() => void sendCode()}
                        style={styles.textButton}
                      >
                        <Type variant="caption" muted>
                          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Send a new code'}
                        </Type>
                      </Pressable>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {error && mode !== 'code' ? (
            <Type accessibilityRole="alert" muted>
              {error}
            </Type>
          ) : null}
          {!auth.user && mode !== 'options' && verification !== 'granted' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'code'
                  ? codeChannel === 'phone'
                    ? 'Use a different phone number'
                    : 'Use a different email'
                  : 'Back to sign-up options'
              }
              disabled={busy}
              onPress={() => {
                if (mode === 'code') setMode(codeChannel);
                else setMode('options');
                setError(null);
                setVerification('idle');
              }}
              style={styles.textButton}
            >
              <Type muted>
                {mode === 'code'
                  ? codeChannel === 'phone'
                    ? 'Use a different phone number'
                    : 'Use a different email'
                  : 'Back'}
              </Type>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CodeDigit({ digit }: { digit: string }) {
  const arrival = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!digit) return;
    arrival.set(reducedMotion ? 0.65 : 0.72);
    arrival.set(
      reducedMotion
        ? withTiming(1, { duration: 130 })
        : withSpring(1, { stiffness: 420, damping: 19, mass: 0.7 }),
    );
  }, [arrival, digit, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: digit ? arrival.get() : 0.28,
    transform: reducedMotion ? [] : [{ scale: arrival.get() }],
  }));
  return (
    <Animated.View style={[styles.codeDigit, style]}>
      <Type style={styles.codeDigitText}>{digit || '0'}</Type>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  intro: { paddingTop: 24, gap: 20 },
  actions: { gap: 14 },
  codeField: { position: 'relative', justifyContent: 'center', overflow: 'visible' },
  codeDigits: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  codeDigit: { width: 24, alignItems: 'center' },
  codeDigitText: { fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] },
  codeInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    backgroundColor: 'transparent',
    opacity: 0.02,
  },
  verificationResult: { alignItems: 'center', gap: 10 },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 18,
  },
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  termsRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 0,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 7,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: { flexShrink: 1, fontSize: 12, lineHeight: 18 },
  legalLink: { fontSize: 12, lineHeight: 18, textDecorationLine: 'underline' },
  notice: { padding: 20, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, gap: 12 },
});
