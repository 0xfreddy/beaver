import type { PropsWithChildren } from 'react';
import { UnavailableAuthProvider } from './auth-context';
export { useAuth } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  return (
    <UnavailableAuthProvider reason="Sign-in is available in the iOS and Android app.">
      {children}
    </UnavailableAuthProvider>
  );
}
