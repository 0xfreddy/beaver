import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  url: null as string | null,
  resume: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('expo-linking', () => ({ useURL: () => fixture.url }));
vi.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: fixture.back, replace: fixture.replace },
}));
vi.mock('../components/ui', () => ({ Screen: 'Screen', Type: 'Type', Button: 'Button' }));
vi.mock('./bank-link', () => ({ continueBankLink: fixture.resume }));
import BankCallback from '../app/moneykit/callback';
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.url = null;
  vi.clearAllMocks();
  fixture.resume.mockImplementation(() => new Promise(() => {}));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it.each([null, 'beaver://moneykit/callback'])(
  'offers an escape when the callback stalls (%s)',
  async (url) => {
    fixture.url = url;
    await act(async () => {
      renderer = create(createElement(BankCallback));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    const button = renderer.root.findByType('Button' as never);
    await act(async () => button.props.onPress());
    expect(fixture.replace).toHaveBeenCalled();
  },
);
it('returns to the live bank flow when the SDK resumes', async () => {
  fixture.url = 'beaver://moneykit/callback';
  fixture.resume.mockResolvedValue(true);
  await act(async () => {
    renderer = create(createElement(BankCallback));
  });
  expect(fixture.back).toHaveBeenCalledTimes(1);
});
