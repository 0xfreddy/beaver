import type { PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../providers/auth-provider';
import { Button, Type } from './ui';

export function AccountGate({ children }: PropsWithChildren) {
  const auth = useAuth();
  if (!auth.session || auth.sessionError)
    return (
      <>
        <Type muted>
          {auth.sessionError ?? 'Sign in to see your wallet and confirmed balances.'}
        </Type>
        <Button
          title={auth.user ? 'Finish account setup' : 'Sign in'}
          onPress={() => router.push('/onboarding/account')}
        />
      </>
    );
  return children;
}
