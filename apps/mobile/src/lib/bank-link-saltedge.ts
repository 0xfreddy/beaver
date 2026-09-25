// Native Salt Edge implementation resolves through Metro on iOS/Android.
export const supportsSaltEdgeLink = false;
export async function openSaltEdgeLink(
  _connectUrl: string,
  _returnUrl: string,
  _returnTo?: string,
): Promise<string | null> {
  throw new Error('Connect your bank in the iOS or Android app.');
}
export async function continueSaltEdgeLink(_url: string): Promise<boolean> {
  return false;
}
export function resolveSaltEdge(_result: string | null, _sessionId?: string) {}
