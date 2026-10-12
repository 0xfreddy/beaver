import React, { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpendingSetup } from './spending-setup';
import { BankConnectingSheet } from './bank-connecting-sheet';
import type { BankConnectStep } from '../lib/bank-connect-state';

const flow = vi.hoisted(() => ({ step: { kind: 'idle' } as BankConnectStep }));
vi.mock('react-native', () => ({
  View: 'View',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: unknown) => s },
  AccessibilityInfo: {},
  Alert: {},
  BackHandler: {},
  Keyboard: {},
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  SlideInRight: {},
  SlideInLeft: {},
  useReducedMotion: () => true,
  useSharedValue: () => ({ get: () => 0, set: vi.fn() }),
  useAnimatedStyle: () => ({}),
  FadeIn: { duration: () => undefined },
}));
vi.mock('expo-clipboard', () => ({}));
vi.mock('expo-haptics', () => ({}));
vi.mock('expo-router', () => ({ router: {}, useFocusEffect: () => {} }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
vi.mock('../lib/institution-directory', () => ({ useInstitutionDirectory: () => ({}) }));
vi.mock('../lib/api', () => ({}));
vi.mock('../lib/telemetry', () => ({ posthog: null }));
vi.mock('../providers/auth-provider', () => ({ useAuth: () => ({}) }));
vi.mock('../providers/onchain-preview-provider', () => ({
  useOnchainPreview: () => ({ setPreview: vi.fn() }),
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./ui', () => ({ Button: 'Button', TextButton: 'TextButton', Type: 'Type' }));
vi.mock('./setup-page', () => ({
  SetupPage: ({ children, actions }: React.PropsWithChildren<{ actions: React.ReactNode }>) =>
    createElement(React.Fragment, null, children, actions),
}));
vi.mock('./onboarding-animation', () => ({ OnboardingAnimation: 'Artwork' }));
vi.mock('./onchain-transaction-preview', () => ({}));
vi.mock('./reacticx/circular-bank-list', () => ({}));
vi.mock('./provider-segmented-control', () => ({}));
vi.mock('./crypto-card-guide-tray', () => ({}));
vi.mock('./bank-controls', () => ({
  BankControls: ({
    onStatusActiveChange,
  }: {
    onStatusActiveChange?: (active: boolean) => void;
  }) => {
    useEffect(() => {
      onStatusActiveChange?.(flow.step.kind === 'finishing' || flow.step.kind === 'failed');
    }, [onStatusActiveChange]);
    return createElement(BankConnectingSheet, {
      step: flow.step,
      canFinalize: true,
      onRetryLink: () => {},
      onRetryFinalize: () => {},
      onDismiss: () => {},
    });
  },
}));
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.unstubAllGlobals();
});
it.each(['finishing', 'failed'] as const)('shows only recovery controls while %s', async (kind) => {
  flow.step =
    kind === 'finishing'
      ? { kind, bank: null }
      : { kind, reason: 'other', message: 'The request could not be completed. Please retry.' };
  await act(async () => {
    renderer = create(createElement(SpendingSetup, { initialStage: 'connect' }));
  });
  const titles = renderer.root
    .findAll((n) => typeof n.props.onPress === 'function')
    .map((n) => n.props.title);
  expect(titles.filter((t) => t === 'Back')).toHaveLength(1);
  expect(titles).not.toContain('Connect bank');
  expect(titles).not.toContain('Connect crypto card');
});
it('keeps normal connection actions when idle', async () => {
  flow.step = { kind: 'idle' };
  await act(async () => {
    renderer = create(createElement(SpendingSetup, { initialStage: 'connect' }));
  });
  const titles = renderer.root
    .findAll((n) => typeof n.props.onPress === 'function')
    .map((n) => n.props.title);
  expect(titles).toContain('Connect bank');
  expect(titles.filter((t) => t === 'Back')).toHaveLength(1);
});
