import { describe, expect, it } from 'vitest';
import { bankAccountLabel, bankLogoSources, currencySymbol } from './bank-presentation';

describe('bank presentation', () => {
  it('keeps real provider SVGs first and offers a second source on image failure', () => {
    const svg = 'https://provider.example/revolut.svg';
    const fallback = 'https://img.logo.dev/name/Revolut?token=pk_test';
    expect(bankLogoSources(svg, fallback, svg)).toEqual([svg, fallback]);
    expect(
      bankLogoSources('https://cdn.example/logos/providers/xf/placeholder_global.svg', fallback),
    ).toEqual([fallback]);
    expect(bankLogoSources('', 'http://example.com/logo.png', 'invalid')).toEqual([]);
  });
  it('masks provider-generated IBAN names and separates the currency', () => {
    expect(
      bankAccountLabel({ name: 'LT773250009422474796-EUR', currency: 'EUR', mask: null }),
    ).toEqual({
      name: 'Bank account',
      detail: 'EUR · •• 4796',
    });
    expect(bankAccountLabel({ name: 'Travel savings', currency: 'USD', mask: '1234' })).toEqual({
      name: 'Travel savings',
      detail: 'USD · •• 1234',
    });
    expect(bankAccountLabel({ name: 'EUR', currency: 'EUR', mask: null })).toEqual({
      name: 'Bank account',
      detail: 'EUR',
    });
  });
  it('keeps currencies identifiable when symbols are shared or unfamiliar', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('THB')).toBe('฿');
    expect(currencySymbol(' thb ')).toBe('฿');
    expect(currencySymbol('SGD')).toBe('S$');
    expect(currencySymbol('VND')).toBe('₫');
    expect(currencySymbol('XYZ')).toBe('XYZ');
  });
});
