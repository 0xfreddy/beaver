import { afterEach, describe, expect, it, vi } from 'vitest';
const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  dismissTo: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  canGoBack: vi.fn(() => true),
}));
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
    await expect(continueSaltEdgeLink(callback)).resolves.toBe(true);
    expect(await pending).toBe('');
    expect(navigation.dismissTo).toHaveBeenCalledWith('/settings/banks');
    await expect(continueSaltEdgeLink(callback)).resolves.toBe(false);
  });
  it('returns an OAuth callback to the same picker session', async () => {
    const target = '/bank-picker?pickerId=42';
    const pending = openSaltEdgeLink('https://connect.saltedge.com/one', callback, target);
    expect(await continueSaltEdgeLink(callback)).toBe(true);
    expect(await pending).toBe('');
    expect(navigation.dismissTo).toHaveBeenCalledWith(target);
  });
  it('supersedes a stale session instead of locking the flow', async () => {
    const stale = openSaltEdgeLink('https://connect.saltedge.com/one', callback);
    const fresh = openSaltEdgeLink('https://connect.saltedge.com/two', callback);
    expect(await stale).toBeNull();
    resolveSaltEdge('', sessionId());
    expect(await fresh).toBe('');
  });
  it('falls back to a plain pop when the opening screen left the stack', async () => {
    navigation.dismissTo.mockImplementationOnce(() => {
      throw new Error('target not in stack');
    });
    const pending = openSaltEdgeLink('https://connect.saltedge.com/one', callback);
    await expect(continueSaltEdgeLink(callback)).resolves.toBe(true);
    expect(navigation.back).toHaveBeenCalled();
    expect(await pending).toBe('');
  });
  it('falls back to the app root when there is nothing to pop after a relaunch', async () => {
    navigation.dismissTo.mockImplementationOnce(() => {
      throw new Error('target not in stack');
    });
    navigation.canGoBack.mockReturnValueOnce(false);
    const pending = openSaltEdgeLink('https://connect.saltedge.com/one', callback);
    await expect(continueSaltEdgeLink(callback)).resolves.toBe(true);
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('/');
    expect(await pending).toBe('');
  });
});
