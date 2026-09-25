import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Type } from './ui';
import { useTheme } from '../theme';
import { localReceiptDate } from '../lib/receipt-date';

export function ReceiptDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => new Date(`${value}T12:00:00`));
  const year = month.getFullYear(),
    index = month.getMonth();
  const first = new Date(year, index, 1).getDay();
  const count = new Date(year, index + 1, 0).getDate();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth(new Date(year, index - 1, 1))}
          style={{ padding: 14 }}
        >
          <Type>‹</Type>
        </Pressable>
        <Type>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Type>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => setMonth(new Date(year, index + 1, 1))}
          style={{ padding: 14 }}
        >
          <Type>›</Type>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: first + count }, (_, cell) => {
          const day = cell - first + 1;
          const date = localReceiptDate(new Date(year, index, day));
          return day < 1 ? (
            <View key={cell} style={{ width: '14.28%' }} />
          ) : (
            <Pressable
              key={cell}
              accessibilityRole="button"
              accessibilityLabel={date}
              accessibilityState={{ selected: value === date }}
              disabled={date > localReceiptDate(new Date())}
              onPress={() => onChange(date)}
              style={{
                width: '14.28%',
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: value === date ? colors.soft : undefined,
                opacity: date > localReceiptDate(new Date()) ? 0.3 : 1,
              }}
            >
              <Type>{day}</Type>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
