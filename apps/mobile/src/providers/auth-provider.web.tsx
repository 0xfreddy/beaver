import type { PropsWithChildren } from 'react';
import { UnavailableAuthProvider } from './auth-context';
import { isMockDataEligible } from '../lib/mock-data';
import { SampleAuthProvider } from './sample-auth-provider';
export { useAuth } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  if (isMockDataEligible()) return <SampleAuthProvider>{children}</SampleAuthProvider>;
  return (
    <UnavailableAuthProvider reason="Sign-in is available in the iOS and Android app.">
      {children}
    </UnavailableAuthProvider>
  );
}
