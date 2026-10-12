import { useState } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Type } from './ui';
import { useTheme } from '../theme';
import { bundledBankLogo } from '../lib/bank-logos';
import { bankLogoSources } from '../lib/bank-presentation';
import { useLogoDirectory } from '../lib/logo-directory';
export function BankMark({
  name,
  uri,
  size = 44,
  fallbackLogo,
  fallbackUri,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  fallbackLogo?: ImageSourcePropType;
  fallbackUri?: string | null;
}) {
  const { colors } = useTheme();
  const localLogo = fallbackLogo ?? bundledBankLogo(name);
  const directory = useLogoDirectory();
  const directoryUri = directory.data?.banks?.find(
    (bank) => bank.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )?.uri;
  const [failed, setFailed] = useState<string[]>([]);
  const source = bankLogoSources(uri, fallbackUri, directoryUri).find(
    (value) => !failed.includes(value),
  );
  const fail = () => {
    if (source) setFailed((values) => [...values, source]);
  };
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(12, size * 0.25),
        borderCurve: 'continuous',
        flexShrink: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: source || localLogo ? '#FFFFFF' : colors.soft,
      }}
    >
      {localLogo ? (
        <Image source={localLogo} resizeMode="contain" style={{ width: size, height: size }} />
      ) : source && /\.svg(?:\?|$)/i.test(source) ? (
        <SvgUri key={source} uri={source} width={size - 8} height={size - 8} onError={fail} />
      ) : source ? (
        <Image
          key={source}
          source={{ uri: source }}
          resizeMode="contain"
          style={{ width: size, height: size }}
          onError={fail}
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
