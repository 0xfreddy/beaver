import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { BrandedWaitSurface } from './branded-wait-surface';
const fixture = vi.hoisted(() => ({ width: 393 }));
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { absoluteFill: {} },
  useWindowDimensions: () => ({ width: fixture.width }),
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: { background: '#000' } }) }));
vi.mock('./onboarding-animation', () => ({ OnboardingAnimation: 'OnboardingAnimation' }));
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.unstubAllGlobals();
});
it('keeps the square greeting canvas flush with both phone edges across size changes', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  for (const width of [393, 430, 320]) {
    fixture.width = width;
    await act(async () => {
      const element = createElement(BrandedWaitSurface, { accessibilityLabel: 'Beaver is locked' });
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
    const animation = renderer.root.find((node) => node.type === ('OnboardingAnimation' as never));
    expect(animation.props.name).toBe('invite-peek');
    expect(animation.props.height).toBe(width);
  }
});
