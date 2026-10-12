import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Type } from './ui';
import { useTheme } from '../theme';

export function BankInitialSyncStatus({ status }: { status: string }) {
  const { colors } = useTheme();
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 60_000);
    return () => clearTimeout(timer);
  }, []);
  const needsSignIn = status === 'relink_required';
  const delayed = status === 'error' || takingLonger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {!needsSignIn && !delayed ? <ActivityIndicator color={colors.muted} /> : null}
      <View style={{ flex: 1, gap: 4 }} accessibilityLiveRegion="polite">
        <Type muted>
          {needsSignIn
            ? 'Sign in again to finish connecting.'
            : delayed
              ? 'Still syncing. You can keep going and check back later.'
              : 'Loading accounts and purchases…'}
        </Type>
      </View>
    </View>
  );
}
