import { describe, expect, it } from 'vitest';
import { parseCryptoCardProvider } from './crypto-card-providers';

describe('parseCryptoCardProvider', () => {
  it.each(['EtherFi', 'Tuyo'] as const)('keeps the supported provider %s', (provider) => {
    expect(parseCryptoCardProvider(provider)).toBe(provider);
  });

  it('uses the first route parameter value', () => {
    expect(parseCryptoCardProvider(['Tuyo', 'EtherFi'])).toBe('Tuyo');
  });

  it.each([undefined, 'Unknown', 'Gnosis', []])('falls back to EtherFi for %j', (value) => {
    expect(parseCryptoCardProvider(value)).toBe('EtherFi');
  });
});
