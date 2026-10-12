import { View } from 'react-native';
import type { Institution } from '../lib/institution-directory';
import { CircularBankList } from './reacticx/circular-bank-list';
import { Type } from './ui';

export function BankDiscovery({ banks }: { banks: Institution[] }) {
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Type variant="headline" style={{ textAlign: 'center' }}>
          🇪🇺 🇺🇸 🇬🇧
        </Type>
        <Type muted style={{ textAlign: 'center' }}>
          700 banks supported
        </Type>
      </View>
      <CircularBankList banks={banks} />
    </View>
  );
}
