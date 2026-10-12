import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, View } from 'react-native';
import { authenticateWithBiometrics } from '../lib/biometric-auth';
import { useTheme } from '../theme';
import { Button, Type } from './ui';
import { BrandedWaitSurface } from './branded-wait-surface';

export function BiometricUnlock({
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
  const mounted = useRef(false);
  const leftDuringPrompt = useRef(false);
  async function unlock() {
    if (promptInFlight.current || AppState.currentState !== 'active') return;
    promptInFlight.current = true;
    leftDuringPrompt.current = false;
    autoPrompted.current = true;
    setBusy(true);
    setError(null);
    try {
      await authenticateWithBiometrics(`Unlock Beaver with ${label}`);
      if (!mounted.current) return;
      if (leftDuringPrompt.current || (AppState.currentState as AppStateStatus) === 'background') {
        setError('Please unlock again to continue.');
        return;
      }
      onUnlock();
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please retry.');
    } finally {
      promptInFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const promptWhenActive = () => {
      if (AppState.currentState !== 'active' || autoPrompted.current) return;
      void unlock();
    };
    promptWhenActive();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (promptInFlight.current) leftDuringPrompt.current = true;
        autoPrompted.current = false;
      }
      if (state === 'active') promptWhenActive();
    });
    return () => {
      mounted.current = false;
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
      ) : (
        <BrandedWaitSurface accessibilityLabel="Beaver is locked" still />
      )}
    </View>
  );
}
