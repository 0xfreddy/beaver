import { describe, expect, it } from 'vitest';
import type { RoundupPercentage } from '@roundups/types';
import { calculateRoundupCents } from './index';

describe('purchase roundup rules', () => {
  it.each([
    [465, 0, 35],
    [500, 0, 0],
    [499, 0, 1],
    [0, 0, 0],
    [465, 1, 5],
    [920, 2, 18],
    [465, 3, 14],
    [465, 5, 23],
    [920, 8, 74],
    [1000, 10, 100],
    [1000, 20, 200],
    [1000, 100, 1000],
    [50, 1, 1],
    [49, 1, 0],
    [150, 1, 2],
  ])('calculates %i cents at %i%% as %i cents', (purchase, rate, result) => {
    expect(calculateRoundupCents(purchase, rate as RoundupPercentage)).toBe(result);
  });
  it('uses integer arithmetic for large purchases', () => {
    expect(calculateRoundupCents(Number.MAX_SAFE_INTEGER, 5)).toBe(
      Number((BigInt(Number.MAX_SAFE_INTEGER) * 5n + 50n) / 100n),
    );
  });
  it.each([-1, 1.5, NaN, Infinity])('rejects invalid cents %s', (value) =>
    expect(() => calculateRoundupCents(value)).toThrow(),
  );
});
