export function nextRoundupMilestoneCents(totalCents: number) {
  const milestone = 15_000;
  return Math.max(milestone, (Math.floor(Math.max(0, totalCents) / milestone) + 1) * milestone);
}
