import type { AchievementSummary } from '@roundups/types';

export function nextAchievementUnlock(
  summary: AchievementSummary | undefined,
  shown: ReadonlySet<string>,
) {
  return summary?.awards.find(
    (award) =>
      award.presentedAt === null &&
      !shown.has(award.definitionId) &&
      summary.definitions.some((definition) => definition.id === award.definitionId),
  );
}

/** Present only over settled app surfaces, never banking, onboarding, or another sheet. */
export function canPresentAchievement(path: string) {
  return ['/', '/index', '/leaderboards', '/portfolio', '/settings', '/beaver-progress'].includes(
    path,
  );
}
