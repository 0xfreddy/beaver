import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ TextInput: 'TextInput' }));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: {} }) }));
import { ReceiptAmountWheel, receiptAmountCents } from './receipt-amount-wheel';
afterEach(() => vi.unstubAllGlobals());
it.each([
  ['2.92', 292],
  ['4,92', 492],
  ['12.', 1200],
  ['0.01', 1],
  ['1000000', 100000000],
  ['', 0],
  ['1.234', 0],
  ['1000000.01', 0],
  ['-1', 0],
  ['invalid', 0],
])('parses %s without carrying forward an old amount', (text, cents) => {
  expect(receiptAmountCents(String(text))).toBe(cents);
});
it('invalidates the prior amount when the field is cleared and accepts a replacement', async () => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const onChange = vi.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(createElement(ReceiptAmountWheel, { value: 292, onChange }));
  });
  const input = () => tree.root.findByType('TextInput' as never);
  await act(async () => input().props.onChangeText(''));
  expect(input().props.value).toBe('');
  expect(onChange).toHaveBeenLastCalledWith(0);
  await act(async () => input().props.onChangeText('4,92'));
  expect(onChange).toHaveBeenLastCalledWith(492);
  await act(async () => tree.unmount());
});
