import * as Linking from 'expo-linking';

export const supportsBankLink = true;
let active: { redirectUri: string; lastUrl?: string } | null = null;

export async function continueBankLink(url: string): Promise<boolean> {
  if (!active) return false;
  const incoming = new URL(url);
  const expected = new URL(active.redirectUri);
  if (
    incoming.protocol !== expected.protocol ||
    incoming.host !== expected.host ||
    incoming.pathname !== expected.pathname
  )
    return false;
  if (active.lastUrl === url) return true;
  active.lastUrl = url;
  const { continueFlow } = await import('@moneykit/connect-react-native');
  await continueFlow(url);
  return true;
}

export async function openBankLink(
  token: string,
  redirectUri: string,
  mode: string,
  persistToken?: (token: string) => Promise<void>,
): Promise<string | null> {
  if (active) throw new Error('A bank connection is already in progress.');
  active = { redirectUri };
  let listener: ReturnType<typeof Linking.addEventListener> | undefined;
  try {
    const { presentLinkFlow } = await import('@moneykit/connect-react-native');
    return await new Promise<string | null>((resolve, reject) => {
      let succeeded = false;
      listener = Linking.addEventListener('url', ({ url }) => {
        void continueBankLink(url).catch(() =>
          reject(new Error('Couldn’t resume bank sign-in. Please reconnect.')),
        );
      });
      void presentLinkFlow({
        linkSessionToken: token,
        onSuccess: (payload) => {
          succeeded = true;
          if (mode === 'update') resolve('');
          else if (payload.token?.value) {
            const value = payload.token.value;
            // Persist at the SDK boundary, before handing control back to UI.
            // A storage failure must still allow the live server exchange.
            void Promise.resolve(persistToken?.(value))
              .catch(() => {})
              .then(() => resolve(value));
          } else reject(new Error('The bank did not return a connection token. Please try again.'));
        },
        onExit: (error) => {
          if (succeeded) return;
          if (error) reject(new Error('Bank connection could not be completed. Please try again.'));
          else resolve(null);
        },
      }).catch(() =>
        reject(new Error('Bank connection is unavailable in this build. Please update the app.')),
      );
    });
  } finally {
    listener?.remove();
    active = null;
  }
}
