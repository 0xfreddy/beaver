import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cryptoCardProviders, type CryptoCardProvider } from '../lib/crypto-card-providers';
import { useTheme } from '../theme';
import { Type } from './ui';

export function ProviderSegmentedControl<T extends string = CryptoCardProvider>({
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
  const { colors } = useTheme();
  const resolvedOptions = options ?? (cryptoCardProviders as unknown as readonly T[]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      {resolvedOptions.map((provider) => {
        const selected = provider === value;
        return (
          <Pressable
            key={provider}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (provider === value) return;
              void Haptics.selectionAsync().catch(() => {});
              onChange(provider);
            }}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: colors.ink },
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Type style={{ color: selected ? colors.background : colors.ink, fontWeight: '500' }}>
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </Type>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    minHeight: 44,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    borderCurve: 'continuous',
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
