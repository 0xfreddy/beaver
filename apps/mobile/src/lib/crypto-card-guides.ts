/* eslint-disable @typescript-eslint/no-require-imports -- Metro static video assets. */
import type { VideoSource } from 'expo-video';
import { cryptoCardProviders, parseCryptoCardProvider } from './crypto-card-providers';

export const cryptoCardGuideProviders = cryptoCardProviders;

export type CryptoCardGuideProvider = (typeof cryptoCardGuideProviders)[number];

export const cryptoCardGuideVideos: Partial<Record<CryptoCardGuideProvider, VideoSource>> = {
  EtherFi: require('../../assets/videos/crypto-card-guides/etherfi.mov'),
};

export function parseCryptoCardGuideProvider(
  value: string | string[] | undefined,
): CryptoCardGuideProvider {
  return parseCryptoCardProvider(value);
}
