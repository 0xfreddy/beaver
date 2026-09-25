import { describe, expect, it } from 'vitest';
import { nextRoundupMilestoneCents } from './roundup-milestone';

describe('nextRoundupMilestoneCents', () => {
  it.each([
    [0, 15_000],
    [14_999, 15_000],
    [15_000, 30_000],
    [31_250, 45_000],
  ])('moves %i cents to the next $150 milestone', (current, expected) => {
    expect(nextRoundupMilestoneCents(current)).toBe(expected);
  });
});
