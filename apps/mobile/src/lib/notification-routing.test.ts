import { expect, it, vi } from 'vitest';
vi.mock('expo-notifications', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Linking: {} }));
import { notificationRoute } from './notifications';
it('allows saved notification IDs and rejects external, malformed and arbitrary routes', () => {
  expect(notificationRoute('/notification/00000000-0000-4000-8000-000000000001')).toBe(
    '/notification/00000000-0000-4000-8000-000000000001',
  );
  for (const value of [
    'https://example.com',
    '/notification/../settings',
    '/notification/nope',
    '/admin',
    null,
  ])
    expect(notificationRoute(value)).toBeNull();
  expect(notificationRoute('/activity')).toBe('/activity');
});
