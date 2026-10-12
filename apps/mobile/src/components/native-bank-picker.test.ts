import React, { createElement as h, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const backHandler = vi.hoisted(() => ({
  listener: null as null | (() => boolean),
  remove: vi.fn(),
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});
const keyboard = vi.hoisted(() => ({ dismiss: vi.fn() }));
vi.mock('react-native', () => ({
  FlatList: 'FlatList',
  View: 'View',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  Keyboard: keyboard,
  Platform: { OS: 'android' },
  BackHandler: {
    addEventListener: (_event: string, listener: () => boolean) => {
      backHandler.listener = listener;
      return { remove: backHandler.remove };
    },
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./onboarding-animation', () => ({ OnboardingAnimation: 'OnboardingAnimation' }));
vi.mock('./reacticx/gooey-search-tabs', () => ({ ExpandedSearchBar: 'TextInput' }));
vi.mock('./bank-mark', () => ({ BankMark: 'BankMark' }));
vi.mock('./ui', () => ({ Button: 'Button', TextButton: 'TextButton', Type: 'Type' }));
import { NativeBankPicker } from './native-bank-picker';
let renderer: ReactTestRenderer;
let props: ComponentProps<typeof NativeBankPicker>;
const list = () => renderer.root.findByType('FlatList' as never).props;
// Inspect actual header elements without remounting the picker or fabricating state.
function descendants(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...descendants(child.props.children as React.ReactNode)];
  });
}
function header(label: string) {
  return descendants(list().ListHeaderComponent).find(
    (element) =>
      element.props.accessibilityLabel === label ||
      element.props.title === label ||
      element.props.placeholder === label,
  )!;
}
beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  keyboard.dismiss.mockClear();
  props = {
    countries: [
      { code: 'LT', name: 'Lithuania' },
      { code: 'DE', name: 'Germany' },
    ],
    country: 'LT',
    onCountry: vi.fn(),
    banks: ['Revolut', 'Revolut Business', 'SEB'].map((name, i) => ({
      id: String(i),
      provider: 'saltedge',
      providerCode: `bank_${i}`,
      country: 'LT',
      name,
      mode: 'oauth',
      logoUrl: null,
    })),
    loading: false,
    countriesLoading: false,
    moneyKit: false,
    onRetry: vi.fn(),
    onRetryCountries: vi.fn(),
    onBack: vi.fn(),
    onSelect: vi.fn(async () => {}),
  };
  await act(async () => {
    renderer = create(h(NativeBankPicker, props));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
it('shows banks before searching, selects an exact entry once and retains search after cancellation', async () => {
  expect(list().data).toHaveLength(3);
  await act(async () => {
    (header('Search banks, e.g. Revolut').props.onChangeText as (text: string) => void)('Revolut');
  });
  expect(list().data.map((bank: { name: string }) => bank.name)).toEqual([
    'Revolut',
    'Revolut Business',
  ]);
  let cancel!: () => void;
  vi.mocked(props.onSelect).mockImplementation(
    () =>
      new Promise<void>((done) => {
        cancel = done;
      }),
  );
  const row = list().renderItem({ item: props.banks[1] });
  await act(async () => {
    row.props.onPress();
    row.props.onPress();
  });
  expect(props.onSelect).toHaveBeenCalledTimes(1);
  expect(props.onSelect).toHaveBeenCalledWith({
    provider: 'saltedge',
    country: 'LT',
    providerCode: 'bank_1',
  });
  expect(keyboard.dismiss).toHaveBeenCalledTimes(1);
  await act(async () => cancel());
  expect(header('Search banks, e.g. Revolut').props.value).toBe('Revolut');
  expect(list().data).toHaveLength(2);
});
it('filters countries and clears the prior bank query after changing country', async () => {
  await act(async () => {
    (
      renderer.root.findAll((node) => node.props.title === 'Change country')[0]!.props
        .onPress as () => void
    )();
  });
  await act(async () => {
    (header('Search countries').props.onChangeText as (text: string) => void)('germ');
  });
  expect(list().data).toEqual([{ code: 'DE', name: 'Germany' }]);
  await act(async () => list().renderItem({ item: list().data[0] }).props.onPress());
  expect(props.onCountry).toHaveBeenCalledWith('DE');
  expect(header('Search banks, e.g. Revolut').props.value).toBe('');
});
it('surfaces a handoff failure and permits another attempt', async () => {
  vi.mocked(props.onSelect).mockRejectedValueOnce(new Error('Bank unavailable'));
  await act(async () => list().renderItem({ item: props.banks[0] }).props.onPress());
  expect(
    descendants(list().ListHeaderComponent).some(
      (node) => node.props.children === 'Bank unavailable',
    ),
  ).toBe(true);
  await act(async () => list().renderItem({ item: props.banks[0] }).props.onPress());
  expect(props.onSelect).toHaveBeenCalledTimes(2);
});

it('Android Back closes country selection before leaving the bank picker', async () => {
  await act(async () => {
    (
      renderer.root.findAll((node) => node.props.title === 'Change country')[0]!.props
        .onPress as () => void
    )();
  });
  expect(header('Search countries')).toBeDefined();
  await act(async () => {
    expect(backHandler.listener?.()).toBe(true);
  });
  expect(header('Search banks, e.g. Revolut')).toBeDefined();
  expect(props.onBack).not.toHaveBeenCalled();
  expect(backHandler.remove).toHaveBeenCalled();
});
