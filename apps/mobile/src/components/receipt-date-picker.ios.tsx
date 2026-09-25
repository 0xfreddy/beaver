import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '../theme';
import { localReceiptDate } from '../lib/receipt-date';

export function ReceiptDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const { isDark } = useTheme();
  const selected = new Date(`${value}T12:00:00`);
  return (
    <Host style={{ width: '100%', height: 44 }} colorScheme={isDark ? 'dark' : 'light'}>
      <DatePicker
        title="Purchase date"
        selection={Number.isNaN(selected.getTime()) ? new Date() : selected}
        range={{ end: new Date() }}
        displayedComponents={['date']}
        modifiers={[datePickerStyle('compact')]}
        onDateChange={(date) => onChange(localReceiptDate(date))}
      />
    </Host>
  );
}
