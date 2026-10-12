import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import type { AchievementSummary } from '@roundups/types';
import { useAuth } from '../providers/auth-provider';
import { useMockData } from '../providers/mock-data-provider';
import { flushIntroduction } from '../lib/introduction-event';
import { useLive } from '../lib/live';
import { canPresentAchievement, nextAchievementUnlock } from '../lib/achievement-unlocks';

export function AchievementSync({ enabled = true }: { enabled?: boolean }) {
  const auth = useAuth();
  return <AccountAchievements key={auth.user?.id ?? 'signed-out'} enabled={enabled} />;
}
function AccountAchievements({ enabled }: { enabled: boolean }) {
  const auth = useAuth();
  const sample = useMockData();
  const pathname = usePathname();
  const shown = useRef(new Set<string>());
  const query = useLive<AchievementSummary>('/v1/social/achievements', enabled && sample.ready);
  useQuery({
    queryKey: ['social', auth.user?.id, 'introduction-sync'],
    enabled: !!auth.session,
    queryFn: async () => {
      await flushIntroduction(auth.user!.id, auth.getAccessToken);
      return true;
    },
    retry: 2,
  });
  useEffect(() => {
    if (!enabled || !sample.ready || !auth.session || !canPresentAchievement(pathname)) return;
    const next = nextAchievementUnlock(query.data, shown.current);
    if (!next) return;
    const timer = setTimeout(() => {
      shown.current.add(next.definitionId);
      router.push({ pathname: '/achievement/[id]', params: { id: next.definitionId } });
    }, 700);
    return () => clearTimeout(timer);
  }, [enabled, sample.ready, auth.session, pathname, query.data]);
  return null;
}
