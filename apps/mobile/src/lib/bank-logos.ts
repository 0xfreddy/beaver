/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static asset references. */
import type { ImageSourcePropType } from 'react-native';

// Bundled brand marks keep the popular-bank carousel available offline.
const logos: Record<string, ImageSourcePropType> = {
  'chase': require('../../assets/logos/banks/chase.com.png'),
  'bank of america': require('../../assets/logos/banks/bankofamerica.com.png'),
  'wells fargo': require('../../assets/logos/banks/wellsfargo.com.png'),
  'citi': require('../../assets/logos/banks/citi.com.png'),
  'capital one': require('../../assets/logos/banks/capitalone.com.png'),
  'u.s. bank': require('../../assets/logos/banks/usbank.com.png'),
  'pnc': require('../../assets/logos/banks/pnc.com.png'),
  'td bank': require('../../assets/logos/banks/td.com.png'),
  'ally bank': require('../../assets/logos/banks/ally.com.png'),
  'discover': require('../../assets/logos/banks/discover.com.png'),
};

export function bundledBankLogo(name: string): ImageSourcePropType | undefined {
  return logos[name.trim().toLowerCase()];
}
