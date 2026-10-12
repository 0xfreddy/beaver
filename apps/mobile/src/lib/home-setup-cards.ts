import type { InvestmentPolicy } from './live';
import { money } from './purchases';

export interface MonthlyRoundups {
  items: { symbol: string; investedCents: string; purchaseCount: number }[];
}
/** Local calendar month, serialized as exact UTC instants for the server query. */
export function monthlyRange(now = new Date()) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
}
export function homeSetupCards(policy: InvestmentPolicy, stats?: MonthlyRoundups, failed = false) {
  const items = [...(stats?.items ?? [])].sort((a, b) =>
    BigInt(a.investedCents) === BigInt(b.investedCents)
      ? a.symbol.localeCompare(b.symbol)
      : BigInt(a.investedCents) > BigInt(b.investedCents)
        ? -1
        : 1,
  );
  const favourite = items[0];
  const count = items.reduce((sum, item) => sum + item.purchaseCount, 0);
  const total = items.reduce((sum, item) => sum + BigInt(item.investedCents), 0n);
  const waiting = failed
    ? 'Couldn’t load this month’s activity.'
    : 'Loading this month’s activity…';
  return [
    {
      id: 'rule',
      title: policy.roundupRuleConfigured ? 'Roundups this month' : 'Choose when',
      body: policy.roundupRuleConfigured
        ? !stats
          ? waiting
          : count
            ? `${count} ${count === 1 ? 'purchase' : 'purchases'} got you ${money(total.toString())}`
            : 'No completed roundups this month yet.'
        : 'Choose how purchases generate roundups.',
      action: policy.roundupRuleConfigured ? 'View activity' : 'Choose',
      href: policy.roundupRuleConfigured ? '/activity' : '/settings/rules',
    },
    {
      id: 'favourite',
      title: 'Favourite stock',
      body: !stats
        ? waiting
        : favourite
          ? `Got ${money(favourite.investedCents)} in ${favourite.symbol} this month`
          : 'Your first investment will start the story.',
      action: 'View portfolio',
      href: '/portfolio',
    },
    {
      id: 'fallback',
      title: 'Fallback stock',
      body: policy.fallbackSymbol
        ? `${policy.fallbackSymbol} for unmatched purchases.`
        : 'Choose where unmatched purchases invest.',
      action: policy.fallbackSymbol ? 'Change stock' : 'Choose stock',
      href: '/settings/fallback',
    },
  ];
}
