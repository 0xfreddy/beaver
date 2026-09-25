/**
 * A presentation-only monthly estimate for onboarding. It combines a small
 * spend-based contribution with the average change from rounding purchases to
 * the next whole dollar, so both controls materially affect the result. Exact
 * roundups still come from the user's chosen rule and real purchases.
 */
export function estimatedMonthlyRoundup(monthlySpend: number, transactions: number) {
  if (monthlySpend <= 0 || transactions <= 0) return 0;
  const spendContribution = monthlySpend * 0.01;
  const wholeDollarContribution = transactions * 0.5;
  return Math.round(spendContribution + wholeDollarContribution);
}
