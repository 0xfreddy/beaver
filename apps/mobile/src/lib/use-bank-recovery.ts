import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { recoverPendingBank } from './bank-recovery';

export function useBankRecovery() {
  const auth = useAuth();
  const cache = useQueryClient();
  const userId = auth.user?.id;
  const enabled = !!auth.session && !auth.sessionError;
  const getToken = useEffectEvent(() => auth.getAccessToken());
  useEffect(() => {
    if (!enabled || !userId) return;
    let current = true;
    let running = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function recover() {
      if (!current || running || AppState.currentState !== 'active') return;
      clearTimeout(retry);
      running = true;
      attempts += 1;
      try {
        const recovered = await recoverPendingBank(userId!, async () => {
          const token = await getToken();
          if (!current) throw new Error('Bank recovery account changed.');
          return token;
        });
        if (current && recovered) await cache.invalidateQueries({ queryKey: ['live', userId] });
      } catch {
        // Network failures and delayed webhooks leave the marker durable. A
        // foreground retry can finish without forcing another bank sign-in.
        if (current && attempts < 4)
          retry = setTimeout(() => void recover(), Math.min(15_000 * 2 ** (attempts - 1), 60_000));
      } finally {
        running = false;
      }
    }
    void recover();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        attempts = 0;
        void recover();
      }
    });
    return () => {
      current = false;
      clearTimeout(retry);
      subscription.remove();
    };
  }, [userId, enabled, cache]);
}
