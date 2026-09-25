/* eslint-disable @typescript-eslint/no-require-imports -- Metro static assets. */
import type { ImageSourcePropType } from 'react-native';

// Bank marks come from the server directory (/v1/logos and
// /v1/bank/institutions) with logo.dev fallbacks, so no bundled bank art.
export const cryptoCardBrandLogos = {
  EtherFi: require('../../assets/brands/crypto-cards/etherfi.png'),
  Tuyo: require('../../assets/brands/crypto-cards/tuyo.png'),
} as const satisfies Record<'EtherFi' | 'Tuyo', ImageSourcePropType>;
