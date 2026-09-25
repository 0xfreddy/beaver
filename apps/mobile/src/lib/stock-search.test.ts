import { describe, expect, it } from 'vitest';
import { matchesStockQuery } from './stock-search';

describe('matchesStockQuery', () => {
  it('matches by ticker, including the tokenized xStock ticker', () => {
    expect(matchesStockQuery('AAPL', 'Apple xStock', 'aapl')).toBe(true);
    expect(matchesStockQuery('AAPL', 'Apple xStock', 'aaplx')).toBe(true);
    expect(matchesStockQuery('TSLA', 'Tesla xStock', 'TSLA')).toBe(true);
  });

  it('matches by name fragment case-insensitively', () => {
    expect(matchesStockQuery('MSFT', 'Microsoft xStock', 'Micro')).toBe(true);
    expect(matchesStockQuery('NVDA', 'NVIDIA xStock', 'nvidia')).toBe(true);
  });

  it('matches consumer-brand aliases the registry name omits', () => {
    expect(matchesStockQuery('GOOGL', 'Alphabet xStock', 'google')).toBe(true);
    expect(matchesStockQuery('META', 'Meta xStock', 'facebook')).toBe(true);
    expect(matchesStockQuery('META', 'Meta xStock', 'instagram')).toBe(true);
    expect(matchesStockQuery('MSFT', 'Microsoft xStock', 'windows')).toBe(true);
  });

  it('indexes issuer terms for public and private tokenized stocks', () => {
    expect(matchesStockQuery('OPENAI', 'OpenAI PreStocks', 'private company', 'prestocks')).toBe(
      true,
    );
    expect(matchesStockQuery('NVDA', 'NVIDIA xStock', 'public stock', 'xstocks')).toBe(true);
    expect(matchesStockQuery('OPENAI', 'OpenAI PreStocks', 'xstock', 'prestocks')).toBe(false);
  });

  it('requires every query token to match', () => {
    expect(matchesStockQuery('NVDA', 'NVIDIA xStock', 'nvidia xstock')).toBe(true);
    expect(matchesStockQuery('AAPL', 'Apple xStock', 'apple inc')).toBe(false);
  });

  it('treats blank queries as a match for every stock', () => {
    expect(matchesStockQuery('AMZN', 'Amazon xStock', '')).toBe(true);
    expect(matchesStockQuery('AMZN', 'Amazon xStock', '   ')).toBe(true);
  });

  it('rejects queries outside the stock', () => {
    expect(matchesStockQuery('AMZN', 'Amazon xStock', 'netflix')).toBe(false);
    expect(matchesStockQuery('META', 'Meta xStock', 'google')).toBe(false);
  });
});
