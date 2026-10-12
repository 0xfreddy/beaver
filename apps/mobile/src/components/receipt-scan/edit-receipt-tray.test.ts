import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  View: 'View',
  Image: 'Image',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Keyboard: { dismiss: vi.fn() },
  useWindowDimensions: () => ({ width: 390 }),
}));
vi.mock('expo-haptics', () => ({ selectionAsync: async () => {} }));
vi.mock('../../theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('../ui', () => ({ Button: 'Button', TextButton: 'TextButton', Type: 'Type' }));
vi.mock('../reacticx/tray', () => ({
  Tray: ({ children, footer }: React.PropsWithChildren<{ footer: React.ReactNode }>) =>
    React.createElement('View', null, children, footer),
}));
vi.mock('../reacticx/gooey-search-tabs', () => ({ ExpandedSearchBar: 'Search' }));
vi.mock('../company-mark', () => ({ CompanyMark: 'Mark' }));
vi.mock('../receipt-date-picker', () => ({ ReceiptDatePicker: 'Date' }));
vi.mock('../receipt-amount-wheel', () => ({ ReceiptAmountWheel: 'Wheel' }));
vi.mock('./currency-artwork', () => ({ currencyArtwork: {} }));
vi.mock('../../lib/live', () => ({
  useLive: () => ({ data: { items: [{ symbol: 'AAPL', name: 'Apple xStock' }] } }),
}));
import { EditReceiptTray } from './edit-receipt-tray';
afterEach(() => vi.unstubAllGlobals());
it('preserves edits across steps and saves only at the final confirmation', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const save = vi.fn();
  let r: ReactTestRenderer;
  await act(async () => {
    r = create(
      React.createElement(EditReceiptTray, {
        visible: true,
        onClose: vi.fn(),
        onSave: save,
        value: {
          merchant: 'Apple',
          symbol: 'AAPL',
          date: '2026-10-11',
          currency: 'USD',
          amountCents: 292,
        },
        policy: { percentage: 0, maxRoundupCents: 900, usdCents: 292 },
      }),
    );
  });
  const button = (title: string) =>
    r!.root.findAllByType('Button' as never).find((n) => n.props.title === title)!;
  await act(async () => {
    r!.root.findByType('Wheel' as never).props.onChange(375);
  });
  await act(async () => button('Continue').props.onPress());
  await act(async () =>
    r!.root
      .findAllByType('Pressable' as never)
      .find((n) => n.props.accessibilityLabel === 'EUR')!
      .props.onPress(),
  );
  await act(async () => r!.root.findByType('Date' as never).props.onChange('2026-10-10'));
  await act(async () => button('Continue').props.onPress());
  expect(save).not.toHaveBeenCalled();
  await act(async () => r!.root.findByType('TextButton' as never).props.onPress());
  expect(r!.root.findByType('Date' as never).props.value).toBe('2026-10-10');
  await act(async () => button('Continue').props.onPress());
  await act(async () => button('Save changes').props.onPress());
  expect(save).toHaveBeenCalledWith(
    { merchant: 'Apple', symbol: 'AAPL', date: '2026-10-10', currency: 'EUR', amountCents: 375 },
    true,
  );
  await act(async () => r!.unmount());
});
