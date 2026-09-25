import { Image, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useState } from 'react';
import { Type } from './ui';
import { useTheme } from '../theme';
import { pickLogo, useLogoDirectory } from '../lib/logo-directory';

// Bundled Metro assets cover the shipped universe with zero network requests;
// symbols added server-side resolve through the logo directory instead.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const starbucks: ImageSourcePropType = require('../../assets/logos/SBUX.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const apple: ImageSourcePropType = require('../../assets/logos/AAPL.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const amazon: ImageSourcePropType = require('../../assets/logos/AMZN.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const uber: ImageSourcePropType = require('../../assets/logos/UBER.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const netflix: ImageSourcePropType = require('../../assets/logos/NFLX.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chipotle: ImageSourcePropType = require('../../assets/logos/CMG.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const alphabet: ImageSourcePropType = require('../../assets/logos/GOOGL.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const meta: ImageSourcePropType = require('../../assets/logos/META.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const microsoft: ImageSourcePropType = require('../../assets/logos/MSFT.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nvidia: ImageSourcePropType = require('../../assets/logos/NVDA.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tesla: ImageSourcePropType = require('../../assets/logos/TSLA.png');

const companies: Record<string, { name: string; source: ImageSourcePropType; scale: number }> = {
  SBUX: { name: 'Starbucks', source: starbucks, scale: 0.88 },
  AAPL: { name: 'Apple', source: apple, scale: 0.58 },
  AMZN: { name: 'Amazon', source: amazon, scale: 0.66 },
  UBER: { name: 'Uber', source: uber, scale: 0.76 },
  NFLX: { name: 'Netflix', source: netflix, scale: 0.66 },
  CMG: { name: 'Chipotle', source: chipotle, scale: 0.88 },
  GOOGL: { name: 'Alphabet', source: alphabet, scale: 0.6 },
  META: { name: 'Meta', source: meta, scale: 0.72 },
  MSFT: { name: 'Microsoft', source: microsoft, scale: 0.68 },
  NVDA: { name: 'NVIDIA', source: nvidia, scale: 0.66 },
  TSLA: { name: 'Tesla', source: tesla, scale: 0.8 },
};

export function CompanyMark({
  symbol,
  merchant,
  size = 46,
  seal = false,
  unframed = false,
}: {
  symbol?: string;
  merchant?: string;
  size?: number;
  seal?: boolean;
  unframed?: boolean;
}) {
  const { colors } = useTheme();
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const logos = useLogoDirectory();
  const company = symbol
    ? companies[symbol]
    : Object.values(companies).find(
        (entry) => entry.name.toLowerCase() === merchant?.trim().toLowerCase(),
      );
  // Server-side additions to the universe render from the logo directory.
  const directoryUri = pickLogo(logos.data, 'stocks', symbol);
  const showLogo = company && failedSource !== company.source;
  const showRemote = !showLogo && directoryUri && failedUri !== directoryUri;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.3,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
          seal || unframed ? 'transparent' : showLogo || showRemote ? '#242424' : colors.soft,
      }}
    >
      {showLogo ? (
        <Image
          source={company.source}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
          onError={() => setFailedSource(company.source)}
          style={{
            width: size * (unframed ? 1 : company.scale),
            height: size * (unframed ? 1 : company.scale),
            opacity: seal ? 0.9 : 1,
          }}
        />
      ) : showRemote ? (
        <Image
          source={{ uri: directoryUri ?? undefined }}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
          onError={() => setFailedUri(directoryUri)}
          style={{
            width: size * (unframed ? 1 : 0.72),
            height: size * (unframed ? 1 : 0.72),
            opacity: seal ? 0.9 : 1,
          }}
        />
      ) : (
        <Type
          style={{
            fontSize: size * 0.38,
            fontWeight: '600',
            color: seal ? '#73501C' : colors.muted,
          }}
        >
          {(merchant ?? symbol ?? '?').charAt(0).toUpperCase()}
        </Type>
      )}
    </View>
  );
}

export function MerchantIcon({
  merchant,
  symbol,
  size,
}: {
  merchant: string;
  symbol?: string | null;
  size?: number;
}) {
  return <CompanyMark merchant={merchant} symbol={symbol ?? undefined} size={size} />;
}
