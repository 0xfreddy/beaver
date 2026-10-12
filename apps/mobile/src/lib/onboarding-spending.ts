/**
 * A presentation-only monthly estimate for onboarding. Without a rule it
 * combines a small spend-based contribution with the average change from
 * rounding purchases to the next whole dollar, so both controls materially
 * affect the result. A chosen rule replaces the model with its own math.
 * Exact roundups still come from the user's chosen rule and real purchases.
 */
export function estimatedMonthlyRoundup(
  monthlySpend: number,
  transactions: number,
  percentage?: number,
) {
  if (monthlySpend <= 0 || transactions <= 0) return 0;
  if (percentage === 100) return Math.round(monthlySpend);
  if (percentage !== undefined && percentage > 0 && percentage < 100)
    return Math.round((monthlySpend * percentage) / 100);
  const spendContribution = monthlySpend * 0.01;
  const wholeDollarContribution = transactions * 0.5;
  return Math.round(spendContribution + wholeDollarContribution);
}
