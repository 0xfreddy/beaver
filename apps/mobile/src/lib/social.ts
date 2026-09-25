import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';
import { useAuth } from '../providers/auth-provider';
export function useSocialMutation<T = unknown>(path: string, method = 'POST') {
  const auth = useAuth(),
    cache = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<T>(auth.getAccessToken, `/v1/social${path}`, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      await cache.invalidateQueries({ queryKey: ['social', auth.user?.id] });
    },
  });
}
export const invitationMessages = {
  available: 'Accept this invitation?',
  'already-friends': 'Already friends',
  'previously-accepted': 'This invitation was already used. Ask for a new invitation to reconnect.',
  self: 'This is your own invitation.',
  expired: 'This invitation expired. Ask for a new link.',
  revoked: 'This invitation was revoked.',
  invalid: 'This invitation is not valid.',
  exhausted: 'All 3 of your friend’s invites are used. Ask them to share once a spot frees up.',
  blocked: 'This connection is unavailable.',
};
