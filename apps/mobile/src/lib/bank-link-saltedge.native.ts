import { router, type Href } from 'expo-router';

export const supportsSaltEdgeLink = true;

type Session = {
  id: string;
  returnUrl: string;
  returnTo: string;
  resolve: ((outcome: string | null) => void) | null;
  lastUrl?: string;
};
let active: Session | null = null;
let sequence = 0;

export async function openSaltEdgeLink(
  connectUrl: string,
  returnUrl: string,
  returnTo = '/onboarding/bank',
): Promise<string | null> {
  // A session whose widget never resolved (lost redirect, relaunched app) must
  // not lock the flow until a process restart: supersede it as cancelled.
  if (active) {
    const stale = active;
    active = null;
    stale.resolve?.(null);
  }
  const session = { id: String(++sequence), returnUrl, returnTo, resolve: null } as Session;
  active = session;
  try {
    return await new Promise<string | null>((resolve) => {
      if (!active) return resolve(null);
      active.resolve = resolve;
      router.push({
        pathname: '/saltedge/link',
        params: {
          url: encodeURIComponent(connectUrl),
          returnUrl,
          sessionId: session.id,
        },
      });
    });
  } finally {
    if (active === session) active = null;
  }
}

// The WebView screen reports its outcome through the same single resolver.
export function resolveSaltEdge(result: string | null, sessionId?: string) {
  if (!active || (sessionId !== undefined && active.id !== sessionId)) return;
  const session = active;
  active = null;
  session.resolve?.(result);
}

// An EU bank may finish OAuth in the system browser and deep-link back in.
export async function continueSaltEdgeLink(url: string): Promise<boolean> {
  if (!active) return false;
  const incoming = new URL(url);
  const expected = new URL(active.returnUrl);
  if (
    incoming.protocol !== expected.protocol ||
    incoming.host !== expected.host ||
    incoming.pathname !== expected.pathname
  )
    return false;
  if (active.lastUrl === url) return true;
  active.lastUrl = url;
  const returnTo = active.returnTo;
  resolveSaltEdge('');
  try {
    router.dismissTo(returnTo as Href);
  } catch {
    // The opening screen may not be on the stack after a relaunch; fall back
    // to a plain pop, then the app root, so this screen never strands the flow.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }
  return true;
}
