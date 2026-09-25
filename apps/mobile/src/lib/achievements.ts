import type { AchievementSummary } from '@roundups/types';

/** Layout follows available label width, including Dynamic Type. */
export function achievementColumns(width: number, fontScale: number) {
  if (fontScale >= 1.8) return 1;
  return width >= 390 && fontScale <= 1.05 ? 3 : 2;
}
export function achievementProgress(id: string, summary: AchievementSummary) {
  const progress = summary.progress?.[id];
  if (progress)
    return `${Math.min(progress.current, progress.target)} of ${progress.target} ${progress.unit}`;
  const target = (
    { 'first-friend': 1, 'three-friends': 3, 'five-friends': 5 } as Record<string, number>
  )[id];
  return target
    ? `${Math.min(summary.distinctFriends, target)} of ${target} distinct connections`
    : 'Not yet earned';
}
