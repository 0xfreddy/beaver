import { memo } from 'react';
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { cryptoCardProviders, type CryptoCardProvider } from '../lib/crypto-card-providers';

function ProviderSegmentedControlBase<T extends string = CryptoCardProvider>({
  value,
  onChange,
  options,
  accessibilityLabel = 'Crypto card provider',
}: {
  value: T;
  onChange: (value: T) => void;
  options?: readonly T[];
  accessibilityLabel?: string;
}) {
  const resolvedOptions = options ?? (cryptoCardProviders as unknown as readonly T[]);

  return (
    <Host style={{ width: '100%', height: 44 }}>
      <Picker
        label={accessibilityLabel}
        selection={value}
        onSelectionChange={(selection) => {
          const next = selection as T;
          if (next === value) return;
          void Haptics.selectionAsync().catch(() => {});
          onChange(next);
        }}
        modifiers={[pickerStyle('segmented')]}
      >
        {resolvedOptions.map((provider) => (
          <Text key={provider} modifiers={[tag(provider)]}>
            {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}

// The SwiftUI picker mirrors `selection` into local @State and can re-emit its
// first tag when its content is recreated mid-render, which silently reset the
// provider back to EtherFi after unrelated state updates (e.g. pasting an
// address). Memoizing with stable call-site props keeps unrelated re-renders
// from touching the native view at all.
export const ProviderSegmentedControl = memo(ProviderSegmentedControlBase);
