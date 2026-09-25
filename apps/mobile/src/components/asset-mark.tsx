import { Image, View } from 'react-native';
import type { DepositAsset } from '../lib/deposit-options';

const assetLogos = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static image asset.
  USDC: require('../../assets/logos/USDC.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static image asset.
  SOL: require('../../assets/logos/SOL.png'),
} as const;

export function AssetMark({ asset, size = 48 }: { asset: DepositAsset; size?: number }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Image
        source={assetLogos[asset]}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}
