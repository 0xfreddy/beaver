import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { isMockDataActive } from '../lib/mock-data';
import { posthog } from '../lib/telemetry';
import { useLive, type Authorization, type InvestmentPolicy } from '../lib/live';
import { useAuth } from '../providers/auth-provider';
import { useOnboarding } from '../providers/onboarding-provider';

const DEFAULT_DAILY_LIMIT = 5000;
const DEFAULT_MAX_ROUNDUP = 900;

/**
 * Investing is on by default. Once onboarding is complete the wallet owner
 * approves the automation signer once (Privy consent) and the policy activates,
 * so confirming a purchase never waits on setup. Deliberate setup stays
 * reachable from Automatic investing in settings.
 */
export function AutoActivateInvesting() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const cache = useQueryClient();
  const attemptedFor = useRef<string | null>(null);
  const userId = auth.user?.id ?? null;
  const eligible =
    !!userId && onboarding.ready && onboarding.completedUserIds.includes(userId) && !isMockDataActive();
  const authorization = useLive<Authorization>('/v1/automation/authorization', eligible);
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy', eligible);

  useEffect(() => {
    if (!eligible || !authorization.data || !policy.data) return;
    if (authorization.data.authorized && policy.data.enabled) return;
    if (attemptedFor.current === userId) return;
    attemptedFor.current = userId;
    let active = true;
    void (async () => {
      try {
        if (!authorization.data!.authorized) {
          await auth.authorizeAutomation(
            authorization.data!.address,
            authorization.data!.signerId,
            authorization.data!.policyId,
          );
          posthog?.capture('wallet_access_approved');
        }
        const confirmed = await apiRequest<InvestmentPolicy>(
          auth.getAccessToken,
          '/v1/activation',
          {
            method: 'POST',
            body: JSON.stringify({
              enabled: true,
              policyVersion: 'automatic-spot-v1',
              dailyLimitCents: policy.data!.dailyLimitCents ?? DEFAULT_DAILY_LIMIT,
              maxRoundupCents: policy.data!.maxRoundupCents ?? DEFAULT_MAX_ROUNDUP,
            }),
          },
        );
        if (confirmed.enabled) posthog?.capture('investing_activated', { auto: true });
      } catch {
        // A declined consent or transient failure retries on the next launch,
        // or immediately from Automatic investing in settings.
        if (active) attemptedFor.current = null;
      }
      if (!active) return;
      await auth.refreshSession().catch(() => {});
      await cache.invalidateQueries({ queryKey: ['live', userId] }).catch(() => {});
    })();
    return () => {
      active = false;
    };
  }, [eligible, authorization.data, policy.data, userId, auth, cache]);

  return null;
}
