import { afterEach, expect, it, vi } from 'vitest';
import {
  fetchUpdatePolicy,
  readUpdateCache,
  recommendationDismissed,
  updateDecision,
} from './app-update';
const policy = {
  enabled: true as const,
  minimumBuild: 58,
  recommendedBuild: 100,
  updateUrl: 'https://testflight.apple.com/join/Example1',
  supportUrl: 'mailto:test@example.com',
};
afterEach(() => vi.unstubAllGlobals());
it.each([
  ['57', 'required'],
  ['58', 'recommended'],
  ['99', 'recommended'],
  ['100', 'none'],
  ['101', 'none'],
  [null, 'none'],
  ['1.2.3', 'none'],
  ['unknown', 'none'],
  ['0', 'none'],
])('compares native build %s numerically (%s)', (build, decision) => {
  expect(updateDecision(policy, build)).toBe(decision);
});
it('releases the gate when disabled or no policy is known', () => {
  expect(updateDecision({ enabled: false }, '57')).toBe('none');
  expect(updateDecision(null, '57')).toBe('none');
});
it('validates persisted policies and survives corrupted storage', () => {
  expect(readUpdateCache('not JSON')).toBeNull();
  expect(readUpdateCache(JSON.stringify({ policy: { ...policy, minimumBuild: 200 } }))).toBeNull();
  expect(readUpdateCache(JSON.stringify({ policy }))?.policy).toEqual(policy);
});
it('dismisses only the same recommendation for 24 hours, never a new one', () => {
  const cache = { policy, dismissedBuild: 100, dismissedAt: 1000 };
  expect(recommendationDismissed(cache, 2000)).toBe(true);
  expect(recommendationDismissed(cache, 1000 + 86400000)).toBe(false);
  expect(recommendationDismissed(cache, 999)).toBe(false);
  expect(recommendationDismissed({ ...cache, dismissedBuild: 99 }, 2000)).toBe(false);
  expect(updateDecision(cache.policy, '57')).toBe('required');
});
it('fetches without auth and rejects malformed server responses', async () => {
  const request = vi.fn(async () => new Response(JSON.stringify(policy)));
  vi.stubGlobal('fetch', request);
  const signal = new AbortController().signal;
  await expect(fetchUpdatePolicy('https://api.example.com', signal)).resolves.toEqual(policy);
  expect(request).toHaveBeenCalledWith('https://api.example.com/v1/app-update/ios/testflight', {
    signal,
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  request.mockResolvedValue(new Response('{"enabled":true}'));
  await expect(fetchUpdatePolicy('https://api.example.com', signal)).rejects.toThrow();
  await expect(fetchUpdatePolicy('http://api.example.com', signal)).rejects.toThrow('HTTPS');
});
