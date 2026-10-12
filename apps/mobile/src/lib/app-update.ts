import { appUpdatePolicySchema, type AppUpdatePolicy } from '@roundups/types';

export type UpdateDecision = 'none' | 'recommended' | 'required';
export function updateDecision(
  policy: AppUpdatePolicy | null,
  nativeBuild: string | null,
): UpdateDecision {
  // Apple allows dotted build numbers. Our EAS builds are positive integers;
  // never guess an ordering for an unknown format or a missing native value.
  if (!policy?.enabled || !nativeBuild || !/^\d+$/.test(nativeBuild)) return 'none';
  const build = Number(nativeBuild);
  if (!Number.isSafeInteger(build) || build < 1) return 'none';
  if (build < policy.minimumBuild) return 'required';
  if (build < policy.recommendedBuild) return 'recommended';
  return 'none';
}

export type UpdateCache = {
  policy: AppUpdatePolicy;
  dismissedBuild?: number;
  dismissedAt?: number;
};
export function readUpdateCache(raw: string | null): UpdateCache | null {
  try {
    if (!raw) return null;
    const data = JSON.parse(raw);
    const policy = appUpdatePolicySchema.parse(data.policy);
    const dismissedBuild = Number.isSafeInteger(data.dismissedBuild)
      ? data.dismissedBuild
      : undefined;
    const dismissedAt =
      typeof data.dismissedAt === 'number' && Number.isFinite(data.dismissedAt)
        ? data.dismissedAt
        : undefined;
    return { policy, dismissedBuild, dismissedAt };
  } catch {
    return null;
  }
}
export function recommendationDismissed(cache: UpdateCache | null, now: number) {
  if (
    !cache?.policy.enabled ||
    cache.dismissedBuild !== cache.policy.recommendedBuild ||
    cache.dismissedAt === undefined
  )
    return false;
  const age = now - cache.dismissedAt;
  return age >= 0 && age < 24 * 60 * 60 * 1000;
}

/** No auth, mock interception, or session retries: this must work before sign-in. */
export async function fetchUpdatePolicy(baseUrl: string, signal: AbortSignal) {
  const url = new URL(baseUrl);
  const localDev =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localDev && url.protocol === 'http:'))
    throw new Error('Update policy requires HTTPS');
  const response = await fetch(new URL('/v1/app-update/ios/testflight', url).toString(), {
    signal,
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error('Update check unavailable');
  return appUpdatePolicySchema.parse(await response.json());
}
