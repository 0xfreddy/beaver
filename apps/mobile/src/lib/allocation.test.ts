import { describe, expect, it } from 'vitest';
import {
  allocationHitFraction,
  allocationPath,
  allocationScrollState,
  allocationSegments,
} from './allocation';

describe('historical allocation', () => {
  it('conserves all cents and keeps even tiny buckets in their real proportions', () => {
    const result = allocationSegments([
      { symbol: 'SBUX', amountCents: 560 },
      { symbol: 'CMG', amountCents: 455 },
      { symbol: 'AAPL', amountCents: 420 },
      { symbol: 'UBER', amountCents: 322 },
      { symbol: 'AMZN', amountCents: 84 },
      { symbol: 'NFLX', amountCents: 7 },
    ]);
    expect(result.reduce((sum, item) => sum + item.amountCents, 0)).toBe(1848);
    expect(result[0]?.start).toBe(0);
    expect(result.at(-1)?.end).toBe(1);
    expect(result.at(-1)?.fraction).toBeCloseTo(7 / 1848);
    result.slice(1).forEach((item, i) => expect(item.start).toBe(result[i]?.end));
  });
  it('has no allocations for an empty or zero balance', () => {
    expect(allocationSegments([])).toEqual([]);
    expect(allocationSegments([{ symbol: 'AAPL', amountCents: 0 }])).toEqual([]);
  });
  it('keeps requested trailing sections at the right edge without changing their cents', () => {
    const result = allocationSegments(
      [
        { symbol: 'SBUX', amountCents: 575 },
        { symbol: 'UBER', amountCents: 875 },
        { symbol: 'NFLX', amountCents: 612 },
      ],
      ['UBER'],
    );
    expect(result.map((item) => item.symbol)).toEqual(['SBUX', 'NFLX', 'UBER']);
    expect(result.reduce((sum, item) => sum + item.amountCents, 0)).toBe(2062);
    expect(result.at(-1)?.end).toBe(1);
  });
  it('flattens symmetrically without crossing either edge', () => {
    const orientation = (a: number[], b: number[], c: number[]) =>
      (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
    for (let step = 1; step < 40; step++) {
      const coordinates = allocationPath(0, 1, step / 40, 354, 184)
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number);
      const points = Array.from({ length: coordinates.length / 2 }, (_, i) =>
        coordinates.slice(i * 2, i * 2 + 2),
      );
      // Every intermediate shape keeps the companies ordered from left to right.
      if (step < 10) expect(points[1]![0]).toBeGreaterThan(points[0]![0]!);
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!,
          b = points[(i + 1) % points.length]!;
        for (let j = i + 2; j < points.length; j++) {
          if (i === 0 && j === points.length - 1) continue;
          const c = points[j]!,
            d = points[(j + 1) % points.length]!;
          const crosses =
            orientation(a, b, c) * orientation(a, b, d) < -1e-8 &&
            orientation(c, d, a) * orientation(c, d, b) < -1e-8;
          expect(crosses, `Ribbon crossed at progress ${step / 40}`).toBe(false);
        }
      }
    }
  });
  it('keeps the morph finite and inside the drawing surface in both directions', () => {
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const numbers = allocationPath(0.996, 1, progress, 354, 184)
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number);
      expect(numbers.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < numbers.length; i += 2) {
        expect(numbers[i]).toBeGreaterThanOrEqual(0);
        expect(numbers[i]).toBeLessThanOrEqual(354);
        expect(numbers[i + 1]).toBeGreaterThanOrEqual(0);
        expect(numbers[i + 1]).toBeLessThanOrEqual(220);
      }
    }
  });
});

describe('allocation scroll pinning', () => {
  it('folds progressively at the top, pins, and reverses at the same positions', () => {
    const positions = [180, 8, -52, -112, -400];
    const down = positions.map((y) => allocationScrollState(y, 8));
    expect(down.map((value) => value.collapse)).toEqual([0, 0, 0.5, 1, 1]);
    expect(down.at(-1)?.barTop).toBe(-86);
    expect(down.at(-1)?.circleTop).toBe(-86);
    expect(positions.toReversed().map((y) => allocationScrollState(y, 8))).toEqual(
      down.toReversed(),
    );
  });
  it('leaves the bar in its natural position before reaching the safe-area edge', () => {
    expect(allocationScrollState(200, 8).barTop).toBe(200);
    expect(allocationScrollState(-86, 8).barTop + 94).toBe(8);
  });
});

describe('allocation selection and tick retention', () => {
  it('selects the same allocation in the arc and flattened strip and resets at the center', () => {
    for (const fraction of [0.02, 0.25, 0.6, 0.98]) {
      const angle = Math.PI * (1 - fraction);
      expect(
        allocationHitFraction(
          177 + Math.cos(angle) * 153,
          179 - Math.sin(angle) * 153,
          1,
          354,
          354,
        ),
      ).toBeCloseTo(fraction);
      expect(allocationHitFraction(fraction * 354, 108, 0, 354, 354)).toBeCloseTo(fraction);
    }
    expect(allocationHitFraction(177, 155, 1, 354, 354)).toBeNull();
  });
  it('keeps a visible gap between neighboring ticks when fully flattened', () => {
    const xs = (start: number, end: number) =>
      allocationPath(start, end, 0, 354, 354)
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number)
        .filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs(0, 1 / 72))).toBeLessThan(Math.min(...xs(1 / 72, 2 / 72)));
  });
});
