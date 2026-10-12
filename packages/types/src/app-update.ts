import { z } from 'zod';

const testflightUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.hostname === 'testflight.apple.com' &&
    !url.username &&
    !url.password &&
    !url.port &&
    /^\/(join\/[A-Za-z0-9]+|v1\/app\/\d+)\/?$/.test(url.pathname)
  );
}, 'Use a Beaver TestFlight invitation or app link');
const supportUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' && !!url.hostname && !url.username && !url.password) ||
      (url.protocol === 'mailto:' && /^[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(url.pathname))
    );
  } catch {
    return false;
  }
}, 'Use an HTTPS support page or mailto address');

/** Deliberately scoped to iOS TestFlight; never reused as an App Store policy. */
export const appUpdatePolicySchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z
    .object({
      enabled: z.literal(true),
      minimumBuild: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      recommendedBuild: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      updateUrl: testflightUrl,
      supportUrl,
    })
    .refine((value) => value.recommendedBuild >= value.minimumBuild, {
      message: 'Recommended build must be at least the minimum build',
    }),
]);
export type AppUpdatePolicy = z.infer<typeof appUpdatePolicySchema>;
