import { afterEach, describe, expect, it, vi } from 'vitest';
const navigation = vi.hoisted(() => ({ push: vi.fn(), dismissTo: vi.fn() }));
vi.mock('expo-router', () => ({ router: navigation }));
import {
  openSaltEdgeLink,
  resolveSaltEdge,
  continueSaltEdgeLink,
} from './bank-link-saltedge.native';
const callback = 'roundups-development://saltedge/callback';
afterEach(() => {
  resolveSaltEdge(null);
  vi.clearAllMocks();
});
function sessionId() {
  return navigation.push.mock.lastCall![0].params.sessionId as string;
}
describe('Salt Edge native handoff', () => {
  it('cancels a popped screen and immediately permits a new connection', async () => {
    const first = openSaltEdgeLink('https://connect.saltedge.com/one', callback);
    const oldId = sessionId();
    resolveSaltEdge(null, oldId);
    const second = openSaltEdgeLink('https://connect.saltedge.com/two', callback);
    const newId = sessionId();
    expect(await first).toBeNull();
    resolveSaltEdge(null, oldId); // late unmount from the old screen must not cancel the new one
    resolveSaltEdge('', newId);
    expect(await second).toBe('');
  });
  it('checks the full callback and returns to the screen that opened the link', async () => {
    const pending = openSaltEdgeLink(
      'https://connect.saltedge.com/one',
      callback,
      '/settings/banks',
    );
    await expect(continueSaltEdgeLink('roundups-development://saltedge/unrelated')).resolves.toBe(
      false,
    );
    await expect(openSaltEdgeLink('https://connect.saltedge.com/two', callback)).rejects.toThrow(
      'already in progress',
    );
    await expect(continueSaltEdgeLink(callback)).resolves.toBe(true);
    expect(await pending).toBe('');
    expect(navigation.dismissTo).toHaveBeenCalledWith('/settings/banks');
    await expect(continueSaltEdgeLink(callback)).resolves.toBe(false);
  });
});
