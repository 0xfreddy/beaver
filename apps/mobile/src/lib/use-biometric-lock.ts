import { useEffect, useState } from 'react';
import {
  biometricAvailability,
  isBiometricUnlockEnabled,
  subscribeBiometricPreference,
} from './biometric-auth';
import { useBiometricBackgroundLock } from './use-biometric-background-lock';

/** Local unlock belongs to the signed-in identity, not the refreshing API session. */
export function useBiometricLock(userId: string | null) {
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [biometricRequired, setBiometricRequired] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric unlock');
  const [biometricOfferEligible, setBiometricOfferEligible] = useState(false);
  useEffect(() => {
    let active = true;
    setBiometricChecked(false);
    setBiometricRequired(false);
    setBiometricLocked(false);
    setBiometricOfferEligible(false);
    if (!userId) {
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
  }, [userId]);
  useBiometricBackgroundLock(biometricRequired, () => setBiometricLocked(true));
  return {
    biometricChecked,
    biometricRequired,
    biometricLocked,
    biometricLabel,
    biometricOfferEligible,
    setBiometricOfferEligible,
    setBiometricLocked,
  };
}
