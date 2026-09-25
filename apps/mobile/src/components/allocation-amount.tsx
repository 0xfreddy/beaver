import { Text } from 'react-native';
import { formatUsd } from '@roundups/domain';
import { useTheme } from '../theme';

export function AllocationAmount({ cents }: { cents: number }) {
  const { colors } = useTheme();
  const [whole, fraction] = formatUsd(cents).split('.');
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={1.2}
      adjustsFontSizeToFit
      style={{
        color: colors.ink,
        fontSize: 52,
        lineHeight: 62,
        letterSpacing: -2,
        fontVariant: ['tabular-nums'],
      }}
    >
      {whole}
      <Text style={{ fontSize: 32 }}>.{fraction}</Text>
    </Text>
  );
}
