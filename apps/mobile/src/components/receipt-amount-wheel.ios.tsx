import { Host, HStack, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

export function ReceiptAmountWheel({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const { isDark } = useTheme();
  const groups = [Math.floor(value / 100000), Math.floor(value / 100) % 1000, value % 100];
  function change(index: number, next: number) {
    const parts = [...groups];
    parts[index] = next;
    const cents = Math.min(100_000_000, parts[0]! * 100000 + parts[1]! * 100 + parts[2]!);
    if (cents === value) return;
    void Haptics.selectionAsync().catch(() => {});
    onChange(cents);
  }
  return (
    <Host style={{ width: '100%', height: 180 }} colorScheme={isDark ? 'dark' : 'light'}>
      <HStack spacing={0}>
        {groups.map((selected, index) => (
          <Picker
            key={index}
            label={['Thousands', 'Units', 'Cents'][index]}
            selection={selected}
            modifiers={[pickerStyle('wheel')]}
            onSelectionChange={(next: number) => change(index, next)}
          >
            {Array.from({ length: index === 0 ? 1001 : index === 1 ? 1000 : 100 }, (_, n) => (
              <Text key={n} modifiers={[tag(n)]}>
                {index === 2 ? String(n).padStart(2, '0') : String(n)}
              </Text>
            ))}
          </Picker>
        ))}
      </HStack>
    </Host>
  );
}
