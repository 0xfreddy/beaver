import { expect, it } from 'vitest';
import { homeSetupCards, monthlyRange } from './home-setup-cards';
const policy = { enabled: true, maxRoundupCents: 900, dailyLimitCents: 5000 };
const stats = {
  items: [
    { symbol: 'AAPL', investedCents: '825', purchaseCount: 12 },
    { symbol: 'SBUX', investedCents: '1015', purchaseCount: 15 },
  ],
};
it('replaces completed setup independently', () => {
  expect(homeSetupCards(policy).map((c) => c.title)).toEqual([
    'Choose when',
    'Favourite stock',
    'Fallback stock',
  ]);
  expect(
    homeSetupCards({ ...policy, roundupRuleConfigured: true }, stats).map((c) => c.title),
  ).toEqual(['Roundups this month', 'Favourite stock', 'Fallback stock']);
  expect(homeSetupCards({ ...policy, fallbackSymbol: 'AAPL' }, stats).map((c) => c.title)).toEqual([
    'Choose when',
    'Favourite stock',
    'Fallback stock',
  ]);
});
it('uses exact invested dollars and most-funded stock, not the saved fallback', () => {
  const cards = homeSetupCards(
    { ...policy, roundupRuleConfigured: true, fallbackSymbol: 'AAPL', enabled: false },
    stats,
  );
  expect(cards[0]?.body).toBe('27 purchases got you $18.40');
  expect(cards[1]?.body).toBe('Got $10.15 in SBUX this month');
});
it('separates loading, error and zero activity and resolves ties consistently', () => {
  const p = { ...policy, roundupRuleConfigured: true, fallbackSymbol: 'AAPL' };
  expect(homeSetupCards(p)[0]?.body).toContain('Loading');
  expect(homeSetupCards(p, undefined, true)[0]?.body).toContain('Couldn’t');
  expect(homeSetupCards(p, { items: [] })[0]?.body).toContain('No completed');
  expect(
    homeSetupCards(p, {
      items: [
        { symbol: 'Z', investedCents: '10', purchaseCount: 1 },
        { symbol: 'A', investedCents: '10', purchaseCount: 1 },
      ],
    })[1]?.body,
  ).toContain('in A this month');
});
it('uses local calendar boundaries including December rollover', () => {
  expect(monthlyRange(new Date(2026, 11, 15))).toEqual({
    start: new Date(2026, 11, 1).toISOString(),
    end: new Date(2027, 0, 1).toISOString(),
  });
});

it('keeps fallback editing available after a selection', () => {
  expect(homeSetupCards({ ...policy, fallbackSymbol: 'AAPL' }, stats)[2]).toMatchObject({
    id: 'fallback',
    href: '/settings/fallback',
    action: 'Change stock',
  });
});
