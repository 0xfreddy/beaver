import { describe, expect, it } from 'vitest';
import { estimatedMonthlyRoundup } from './onboarding-spending';

describe('estimatedMonthlyRoundup', () => {
  it('adapts the monthly estimate to spend and purchase count', () => {
    expect(estimatedMonthlyRoundup(500, 10)).toBe(10);
    expect(estimatedMonthlyRoundup(6050, 100)).toBe(111);
    expect(estimatedMonthlyRoundup(1000, 10)).not.toBe(estimatedMonthlyRoundup(500, 10));
    expect(estimatedMonthlyRoundup(500, 20)).not.toBe(estimatedMonthlyRoundup(500, 10));
  });

  it('does not imply roundups when the selected spend is zero', () => {
    expect(estimatedMonthlyRoundup(0, 25)).toBe(0);
  });
});
