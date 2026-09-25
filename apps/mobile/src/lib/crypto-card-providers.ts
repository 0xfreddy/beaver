export const cryptoCardProviders = ['EtherFi', 'Tuyo'] as const;

export type CryptoCardProvider = (typeof cryptoCardProviders)[number];

export function parseCryptoCardProvider(value: string | string[] | undefined): CryptoCardProvider {
  const candidate = Array.isArray(value) ? value[0] : value;
  return cryptoCardProviders.find((provider) => provider === candidate) ?? 'EtherFi';
}
