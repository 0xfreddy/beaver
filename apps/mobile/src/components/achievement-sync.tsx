import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { flushIntroduction } from '../lib/introduction-event';
export function AchievementSync() {
  const auth = useAuth();
  useQuery({
    queryKey: ['social', auth.user?.id, 'introduction-sync'],
    enabled: !!auth.session,
    queryFn: async () => {
      await flushIntroduction(auth.user!.id, auth.getAccessToken);
      return true;
    },
    retry: 2,
  });
  return null;
}
