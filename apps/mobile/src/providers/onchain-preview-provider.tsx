import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { OnchainSpendingPreview } from '@roundups/types';
import { useAuth } from './auth-provider';

const Context = createContext<{
  preview: OnchainSpendingPreview | null;
  setPreview: (preview: OnchainSpendingPreview | null) => void;
} | null>(null);

/** Ephemeral onboarding data. Address-to-user associations are never persisted on device. */
export function OnchainPreviewProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const owner = useRef(auth.user?.id);
  const [preview, setPreview] = useState<OnchainSpendingPreview | null>(null);
  useEffect(() => {
    if (owner.current !== auth.user?.id) {
      owner.current = auth.user?.id;
      setPreview(null);
    }
  }, [auth.user?.id]);
  return <Context.Provider value={{ preview, setPreview }}>{children}</Context.Provider>;
}

export function useOnchainPreview() {
  const value = useContext(Context);
  if (!value) throw new Error('OnchainPreviewProvider is missing');
  return value;
}
