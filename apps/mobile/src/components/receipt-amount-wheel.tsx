import { useState } from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '../theme';

/** Android's decimal keyboard may use a comma. Invalid drafts must not retain a saved amount. */
export function receiptAmountCents(text: string) {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(normalized)) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents <= 100_000_000 ? cents : 0;
}

export function ReceiptAmountWheel({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => (value / 100).toFixed(2));
  return (
    <TextInput
      accessibilityLabel="Purchase amount"
      keyboardType="decimal-pad"
      value={text}
      selectTextOnFocus
      style={{ fontSize: 32, color: colors.ink, padding: 20 }}
      onChangeText={(next) => {
        setText(next);
        onChange(receiptAmountCents(next));
      }}
    />
  );
}
