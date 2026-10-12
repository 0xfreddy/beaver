import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ open: vi.fn(async (_url: string) => {}) }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: 1 }),
  View: 'View',
  ScrollView: 'ScrollView',
  Linking: { openURL: fixture.open },
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./ui', () => ({ Button: 'Button', TextButton: 'TextButton', Type: 'Type' }));
vi.mock('./onboarding-animation', () => ({ OnboardingAnimation: 'OnboardingAnimation' }));
import { AppUpdateScreen, type AppUpdateScreenProps } from './app-update-screen';
let renderer: ReactTestRenderer;
const props: AppUpdateScreenProps = {
  policy: {
    enabled: true,
    minimumBuild: 58,
    recommendedBuild: 60,
    updateUrl: 'https://testflight.apple.com/join/u2B71KkZ',
    supportUrl: 'mailto:test@example.com',
  },
  installedBuild: '57',
  mode: 'required',
  checking: false,
  checkFailed: false,
  onCheck: vi.fn(),
  onDismiss: vi.fn(),
};
beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  fixture.open.mockResolvedValue();
  await act(async () => {
    renderer = create(createElement(AppUpdateScreen, props));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
it('has no dismiss or accessibility-escape path for required updates', () => {
  expect(
    renderer.root.findByType('ScrollView' as never).props.onAccessibilityEscape,
  ).toBeUndefined();
  expect(renderer.root.findAllByProps({ title: 'Not now' })).toHaveLength(0);
});
it('leaves the requirement visible when TestFlight fails to open and offers actionable recovery', async () => {
  fixture.open.mockRejectedValueOnce(new Error('Unavailable'));
  await act(async () =>
    renderer.root.findByProps({ title: 'Update in TestFlight' }).props.onPress(),
  );
  expect(fixture.open).toHaveBeenCalledWith(props.policy.updateUrl);
  expect(JSON.stringify(renderer.toJSON())).toContain('Couldn’t open TestFlight');
  expect(props.onDismiss).not.toHaveBeenCalled();
  await act(async () =>
    renderer.root.findByProps({ title: 'Update in TestFlight' }).props.onPress(),
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Couldn’t open TestFlight');
});
it('offers dismissal and accessibility escape only for recommendations', async () => {
  await act(async () =>
    renderer.update(createElement(AppUpdateScreen, { ...props, mode: 'recommended' })),
  );
  await act(async () => renderer.root.findByProps({ title: 'Not now' }).props.onPress());
  expect(props.onDismiss).toHaveBeenCalledOnce();
  expect(renderer.root.findByType('ScrollView' as never).props.onAccessibilityEscape).toBe(
    props.onDismiss,
  );
});
it('keeps the required screen focused on the update action', () => {
  const rendered = JSON.stringify(renderer.toJSON());
  expect(rendered).toContain('Beaver has a new version');
  expect(rendered).not.toContain('Contact support');
  expect(rendered).not.toContain('Check again');
  expect(rendered).not.toContain('Installed build');
  expect(renderer.root.findAllByProps({ title: 'Update in TestFlight' })).toHaveLength(1);
});
