/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static asset references. */
import type { ImageSourcePropType } from 'react-native';

// Bundled brand marks keep connected banks and the carousel available offline.
// Revolut icon: https://developer.revolut.com/docs/resources/open-banking-logo-guidelines
const logos: Record<string, ImageSourcePropType> = {
  n26: require('../../assets/logos/banks/n26.png'),
  ing: require('../../assets/logos/banks/ing.png'),
  revolut: require('../../assets/logos/banks/revolut.png'),
  chase: require('../../assets/logos/banks/chase.com.png'),
  'bank of america': require('../../assets/logos/banks/bankofamerica.com.png'),
  'wells fargo': require('../../assets/logos/banks/wellsfargo.com.png'),
  citi: require('../../assets/logos/banks/citi.com.png'),
  'capital one': require('../../assets/logos/banks/capitalone.com.png'),
  'u.s. bank': require('../../assets/logos/banks/usbank.com.png'),
  pnc: require('../../assets/logos/banks/pnc.com.png'),
  'td bank': require('../../assets/logos/banks/td.com.png'),
  'ally bank': require('../../assets/logos/banks/ally.com.png'),
  discover: require('../../assets/logos/banks/discover.com.png'),
};

export function bundledBankLogo(name: string): ImageSourcePropType | undefined {
  const normalized = name.trim().toLowerCase();
  if (/^revolut(?:\b|_)/.test(normalized)) return logos.revolut;
  return logos[normalized];
}
