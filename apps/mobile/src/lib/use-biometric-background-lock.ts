import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';
import { subscribeBiometricAuthSettled } from './biometric-auth';

export const BIOMETRIC_BACKGROUND_GRACE_MS = 30_000;

/** Cold-start locking is owned by Navigation; this only handles warm returns. */
export function useBiometricBackgroundLock(required: boolean, lock: () => void) {
  const lockNow = useEffectEvent(lock);
  useEffect(() => {
    if (!required) return;
    let backgroundAt: number | null = null;
    let lockedThisVisit = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearTimer = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const requireUnlock = () => {
      if (lockedThisVisit) return;
      lockedThisVisit = true;
      lockNow();
    };
    const onChange = (state: string) => {
      if (state === 'background' && backgroundAt === null) {
        backgroundAt = Date.now();
        lockedThisVisit = false;
        timer = setTimeout(requireUnlock, BIOMETRIC_BACKGROUND_GRACE_MS);
      } else if (state === 'active' && backgroundAt !== null) {
        // iOS can suspend JS timers while backgrounded. Always check elapsed
        // time on return, before uncovering the account content.
        const elapsed = Date.now() - backgroundAt;
        if (elapsed >= BIOMETRIC_BACKGROUND_GRACE_MS || elapsed < 0) requireUnlock();
        clearTimer();
        backgroundAt = null;
      }
    };
    onChange(AppState.currentState);
    const subscription = AppState.addEventListener('change', onChange);
    const unsubscribe = subscribeBiometricAuthSettled(() => {
      // A prompt finishing after the user leaves must not unlock the app.
      if (AppState.currentState === 'background') requireUnlock();
    });
    return () => {
      clearTimer();
      subscription.remove();
      unsubscribe();
    };
  }, [required]);
}
