import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicProfile } from '@roundups/types';
import { useAuth } from './auth-provider';
import { useMockData } from './mock-data-provider';
import { avatars } from '../lib/avatars';
import { isMockDataEligible } from '../lib/mock-data';
import { defaultProfile, validateAlias, type PreviewProfile } from '../lib/profile-preview';
import { apiRequest } from '../lib/api';
// An optional cache from an older build must never block the authoritative profile.
function localProfile(raw: string | null): PreviewProfile {
  try {
    const stored = raw ? JSON.parse(raw) : null;
    if (!stored || typeof stored !== 'object') return defaultProfile;
    let alias = '';
    try {
      if (typeof stored.alias === 'string' && stored.alias) alias = validateAlias(stored.alias);
    } catch {
      /* Ignore an obsolete alias. */
    }
    return {
      ...defaultProfile,
      alias,
      avatarId: avatars.some((a) => a.id === stored.avatarId)
        ? stored.avatarId
        : defaultProfile.avatarId,
    };
  } catch {
    return defaultProfile;
  }
}
const Context = createContext<{
  scope: string;
  profile: PreviewProfile;
  ready: boolean;
  error: string | null;
  retry: () => Promise<void>;
  live: boolean;
  save: (patch: Partial<Pick<PreviewProfile, 'alias' | 'avatarId'>>) => Promise<void>;
} | null>(null);
export function ProfileProvider({ children }: PropsWithChildren) {
  const auth = useAuth(),
    cache = useQueryClient();
  const sample = useMockData();
  const sampleReady = sample.ready && !sample.busy && !sample.error;
  const key = `roundups.profile.v1:${auth.user?.id ?? 'anonymous'}`;
  const owner = useRef(key);
  owner.current = key;
  const [state, setState] = useState({
    key: '',
    profile: defaultProfile,
    error: null as string | null,
  });
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        const profile = localProfile(raw);
        if (active) setState({ key, profile, error: null });
      })
      .catch(() => {
        if (active)
          setState({
            key,
            profile: defaultProfile,
            error: 'Couldn’t load your local profile. Reopen the app to retry.',
          });
      });
    return () => {
      active = false;
    };
  }, [key]);
  const server = useQuery({
    queryKey: ['social', auth.user?.id, 'profile'],
    // Wait for fixture restoration instead of sending a synthetic token to the
    // live API while the sample account is still initializing.
    enabled: !!auth.session && !auth.sessionError && state.key === key && sampleReady,
    retry: isMockDataEligible() ? 5 : 1,
    retryDelay: 900,
    queryFn: async () => {
      // The server migration only fills an untouched profile and never awards from flags.
      const raw = await AsyncStorage.getItem(key).catch(() => null);
      const local = localProfile(raw);
      return apiRequest<PublicProfile>(auth.getAccessToken, '/v1/social/profile/migrate', {
        method: 'POST',
        body: JSON.stringify(
          local
            ? {
                ...(local.alias ? { alias: validateAlias(local.alias) } : {}),
                ...(avatars.some((avatar) => avatar.id === local.avatarId)
                  ? { avatarId: local.avatarId }
                  : {}),
              }
            : {},
        ),
      });
    },
  });
  const live = !!auth.session;
  const ready = state.key === key && (!live || (sampleReady && !!server.data));
  const profile = live
    ? server.data
      ? { version: 1 as const, alias: server.data.alias, avatarId: server.data.avatarId }
      : defaultProfile
    : state.key === key
      ? state.profile
      : defaultProfile;
  async function save(patch: Partial<Pick<PreviewProfile, 'alias' | 'avatarId'>>) {
    if (!ready) throw new Error('Your profile is not available yet.');
    if (patch.alias !== undefined) patch = { ...patch, alias: validateAlias(patch.alias) };
    if (patch.avatarId && !avatars.some((a) => a.id === patch.avatarId))
      throw new Error('Choose an available avatar.');
    if (live) {
      const result = await apiRequest<PublicProfile>(auth.getAccessToken, '/v1/social/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (owner.current !== key) throw new Error('Account changed. Reopen your profile.');
      cache.setQueryData(['social', auth.user?.id, 'profile'], result);
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      await cache.invalidateQueries({ queryKey: ['social', auth.user?.id, 'board'] });
    } else {
      const next = { ...profile, ...patch };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (owner.current !== key) throw new Error('Account changed. Reopen your profile.');
      setState({ key, profile: next, error: null });
    }
  }
  return (
    <Context.Provider
      value={{
        scope: key,
        profile,
        ready,
        live,
        error: live
          ? (auth.sessionError ?? sample.error ?? server.error?.message ?? null)
          : state.error,
        retry: async () => {
          if (sample.error) await sample.reload();
          const result = await server.refetch();
          if (result.error) throw result.error;
        },
        save,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProfile() {
  const v = useContext(Context);
  if (!v) throw new Error('ProfileProvider missing');
  return v;
}
