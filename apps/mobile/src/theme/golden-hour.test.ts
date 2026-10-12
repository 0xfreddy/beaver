import { describe, expect, it } from 'vitest';
import { goldenProgress, newGoldenConfirmations } from './golden-hour';
const markets = [
  { symbol: 'AAPL', minimumInputCents: 1000 },
  { symbol: 'AMZN', minimumInputCents: 500 },
];
const bucket = (symbol: string, amountCents: string, currency = 'USD', status = 'pending') => ({
  symbol,
  amountCents,
  currency,
  status,
});
describe('Golden Hour financial boundaries', () => {
  it('uses the nearest individual market minimum, not a combined dollar threshold', () => {
    expect(goldenProgress([bucket('AAPL', '400'), bucket('AMZN', '300')], markets, true)).toBe(0.6);
    expect(goldenProgress([bucket('AAPL', '400'), bucket('AAPL', '350')], markets, true)).toBe(
      0.75,
    );
  });
  it('ignores foreign currency, missing minima, completed or failed roundups', () => {
    expect(
      goldenProgress(
        [
          bucket('AAPL', '990', 'EUR'),
          bucket('OTHER', '9999'),
          bucket('AMZN', '500', 'USD', 'executed'),
          bucket('AAPL', '500', 'USD', 'execution_failed'),
        ],
        markets,
        true,
      ),
    ).toBe(0);
  });
  it('holds warmth during processing without interpreting it as a confirmation', () => {
    expect(goldenProgress([bucket('AAPL', '1000', 'USD', 'redeeming')], markets, true)).toBe(1);
    expect(
      newGoldenConfirmations([{ id: 'in-flight', side: 'buy', status: 'submitted' }], new Set())
        .bloom,
    ).toBe(false);
  });
  it('caps warmth and returns resting when paused', () => {
    expect(goldenProgress([bucket('AAPL', '999999999999999999999999')], markets, true)).toBe(1);
    expect(goldenProgress([bucket('AAPL', '900')], markets, false)).toBe(0);
  });
  it('does not celebrate history, pending orders, failures or sales', () => {
    const old = { id: 'old', side: 'buy', status: 'confirmed' };
    const initial = newGoldenConfirmations([old], null);
    expect(initial.bloom).toBe(false);
    expect(
      newGoldenConfirmations(
        [
          old,
          { id: 'sale', side: 'sell', status: 'confirmed' },
          { id: 'pending', side: 'buy', status: 'submitted' },
          { id: 'failure', side: 'buy', status: 'failed' },
        ],
        initial.ids,
      ).bloom,
    ).toBe(false);
    const updated = newGoldenConfirmations(
      [old, { id: 'pending', side: 'buy', status: 'confirmed' }],
      initial.ids,
    );
    expect(updated.bloom).toBe(true);
    expect(
      newGoldenConfirmations([{ id: 'pending', side: 'buy', status: 'confirmed' }], updated.ids)
        .bloom,
    ).toBe(false);
  });
});
