// Terms beyond the ticker and registry name: the on-chain xStock ticker and
// consumer brands people type whose company name does not contain the query.
const brandAliases: Record<string, readonly string[]> = {
  AAPL: ['iphone'],
  GOOGL: ['google', 'android', 'youtube'],
  META: ['facebook', 'instagram', 'whatsapp'],
  MSFT: ['windows', 'xbox', 'office'],
  NVDA: ['geforce'],
};

export type StockIssuer = 'xstocks' | 'prestocks';

export function matchesStockQuery(
  symbol: string,
  name: string,
  query: string,
  issuer: StockIssuer = 'xstocks',
) {
  const issuerTerms =
    issuer === 'prestocks'
      ? ['prestock', 'prestocks', 'pre ipo', 'pre-ipo', 'private company']
      : ['xstock', 'xstocks', 'public stock', 'etf'];
  const haystack = [
    symbol,
    issuer === 'xstocks' ? `${symbol}x` : symbol,
    name,
    ...issuerTerms,
    ...(brandAliases[symbol] ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
