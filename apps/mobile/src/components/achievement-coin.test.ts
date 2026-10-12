import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ shared: vi.fn(), accessibility: vi.fn() }));
vi.mock('react-native', () => ({
  Image: 'Image',
  View: 'View',
  StyleSheet: { absoluteFill: {} },
  AccessibilityInfo: { addEventListener: hooks.accessibility },
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useSharedValue: hooks.shared,
  useAnimatedStyle: vi.fn(),
  cancelAnimation: vi.fn(),
  Easing: {},
  interpolate: vi.fn(),
  withDelay: vi.fn(),
  withRepeat: vi.fn(),
  withTiming: vi.fn(),
}));
vi.mock('@react-native-masked-view/masked-view', () => ({ default: 'MaskedView' }));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
import { AchievementCoin } from './achievement-coin';

it('renders locked and earned grid coins as static native images without animation subscriptions', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        createElement(
          React.Fragment,
          null,
          ...Array.from({ length: 30 }, (_, id) =>
            createElement(AchievementCoin, {
              key: id,
              source: { uri: `coin-${id}` },
              size: 96,
              locked: id % 2 === 0,
            }),
          ),
        ),
      );
    });
    expect(tree!.root.findAllByType('Image' as never)).toHaveLength(30);
    expect(tree!.root.findAllByType('MaskedView' as never)).toHaveLength(0);
    expect(hooks.shared).not.toHaveBeenCalled();
    expect(hooks.accessibility).not.toHaveBeenCalled();
  } finally {
    await act(async () => tree?.unmount());
    vi.unstubAllGlobals();
  }
});
