import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BankConnectingSheet } from './bank-connecting-sheet';
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('./ui', () => ({ Button: 'Button', TextButton: 'TextButton', Type: 'Type' }));
vi.mock('./setup-page', () => ({ SetupPage: 'SetupPage' }));
vi.mock('./onboarding-animation', () => ({ OnboardingAnimation: 'OnboardingAnimation' }));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: { muted: '#888', surface: '#111' } }) }));
let renderer: ReactTestRenderer;
const dismiss = vi.fn();
const retry = vi.fn();
const props = { canFinalize: true, onRetryLink: retry, onRetryFinalize: retry, onDismiss: dismiss };
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.unstubAllGlobals();
});
it('does not present a second native sheet as the bank widget dismisses', async () => {
  await act(async () => {
    renderer = create(
      createElement(BankConnectingSheet, {
        ...props,
        step: { kind: 'finishing', bank: null },
      }),
    );
  });
  expect(renderer.root.findAll((node) => node.type === ('Modal' as never))).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain('Finishing your connection');
  await act(async () =>
    renderer.update(
      createElement(BankConnectingSheet, {
        ...props,
        step: { kind: 'success', bank: 'Revolut' },
      }),
    ),
  );
  expect(JSON.stringify(renderer.toJSON())).toContain('Revolut');
  expect(JSON.stringify(renderer.toJSON())).toContain('connected');
  expect(renderer.root.findAll((node) => node.type === ('Modal' as never))).toHaveLength(0);
});
it('shows a recoverable error and an always-available dismissal', async () => {
  await act(async () => {
    renderer = create(
      createElement(BankConnectingSheet, {
        ...props,
        step: { kind: 'failed', reason: 'busy', message: 'Try again later.' },
      }),
    );
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Try again later.');
  const buttons = renderer.root.findAll((node) => typeof node.props.onPress === 'function');
  await act(async () => buttons.find((node) => node.props.title === 'Try again')!.props.onPress());
  expect(retry).toHaveBeenCalledOnce();
  await act(async () => buttons.find((node) => node.props.title === 'Back')!.props.onPress());
  expect(dismiss).toHaveBeenCalledOnce();
});
