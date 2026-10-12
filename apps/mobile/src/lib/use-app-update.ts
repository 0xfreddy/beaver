import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import {
  fetchUpdatePolicy,
  readUpdateCache,
  recommendationDismissed,
  updateDecision,
  type UpdateCache,
} from './app-update';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const enabled =
  Platform.OS === 'ios' && Constants.expoConfig?.extra?.updateAudience === 'ios-testflight';
// Scope saved policy to this backend and audience; staging cannot block production.
const cacheKey = `beaver.app-update.v1.${encodeURIComponent(apiUrl).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
const installedBuild = Application.nativeBuildVersion;

export function useAppUpdate() {
  const [hydrated, setHydrated] = useState(!enabled);
  const [cache, setCache] = useState<UpdateCache | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const mounted = useRef(false);
  const cacheRef = useRef<UpdateCache | null>(null);
  const request = useRef<AbortController | null>(null);
  // Serialize storage writes so a slower old requirement cannot overwrite a rollback.
  const writes = useRef(Promise.resolve());
  const save = useCallback((next: UpdateCache) => {
    cacheRef.current = next;
    setCache(next);
    writes.current = writes.current
      .then(() => SecureStore.setItemAsync(cacheKey, JSON.stringify(next)))
      .catch(() => {});
  }, []);
  const refresh = useCallback(async () => {
    if (!enabled || !apiUrl || request.current || !mounted.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setCheckFailed(false);
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const policy = await fetchUpdatePolicy(apiUrl, controller.signal);
      if (mounted.current && request.current === controller && !controller.signal.aborted)
        save({ ...cacheRef.current, policy });
    } catch {
      // A known requirement survives outages. No confirmed policy fails open.
      if (mounted.current && request.current === controller) setCheckFailed(true);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        if (mounted.current) setChecking(false);
      }
    }
  }, [save]);
  useEffect(() => {
    mounted.current = true;
    if (!enabled)
      return () => {
        mounted.current = false;
      };
    let cancelled = false;
    void (async () => {
      const raw = await SecureStore.getItemAsync(cacheKey).catch(() => null);
      if (cancelled) return;
      const saved = readUpdateCache(raw);
      cacheRef.current = saved;
      setCache(saved);
      setHydrated(true);
      void refresh();
    })();
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      // Ignore inactive -> active transitions caused by Face ID and system alerts.
      const returned = state === 'active' && previousState === 'background';
      if (state !== 'inactive') previousState = state;
      if (returned) void refresh();
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      request.current?.abort();
      request.current = null;
      subscription.remove();
    };
  }, [refresh]);
  const decision = updateDecision(cache?.policy ?? null, installedBuild);
  const visible =
    decision === 'required' ||
    (decision === 'recommended' && !recommendationDismissed(cache, Date.now()));
  return {
    hydrated,
    checking,
    checkFailed,
    refresh,
    installedBuild,
    policy: cache?.policy ?? null,
    mode: decision === 'required' ? ('required' as const) : ('recommended' as const),
    visible,
    dismiss: () => {
      if (decision !== 'recommended' || !cache?.policy.enabled) return;
      save({ ...cache, dismissedBuild: cache.policy.recommendedBuild, dismissedAt: Date.now() });
    },
  };
}
