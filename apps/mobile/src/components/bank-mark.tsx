import { useState } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Type } from './ui';
import { useTheme } from '../theme';
import { bundledBankLogo } from '../lib/bank-logos';
export function BankMark({
  name,
  uri,
  size = 44,
  fallbackLogo,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  fallbackLogo?: ImageSourcePropType;
}) {
  const { colors } = useTheme();
  const localLogo = fallbackLogo ?? bundledBankLogo(name);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.soft,
      }}
    >
      {uri && failed !== uri ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{ width: size, height: size }}
          onError={() => setFailed(uri)}
        />
      ) : localLogo ? (
        <Image
          source={localLogo}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      ) : (
        <Type style={{ fontSize: size * 0.35 }}>
          {name
            .split(' ')
            .slice(0, 2)
            .map((word) => word[0])
            .join('')}
        </Type>
      )}
    </View>
  );
}
