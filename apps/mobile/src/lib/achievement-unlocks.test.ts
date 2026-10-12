import { describe, expect, it } from 'vitest';
import type { AchievementSummary } from '@roundups/types';
import { canPresentAchievement, nextAchievementUnlock } from './achievement-unlocks';
const summary: AchievementSummary = {
  metric: 'season-points',
  version: 2,
  points: 0,
  distinctFriends: 0,
  definitions: ['first-link', 'first-twig'].map((id) => ({
    id,
    title: id,
    description: '',
    criterionVersion: 1,
    points: 0,
    assetKey: id,
  })),
  awards: [
    { definitionId: 'first-link', criterionVersion: 1, earnedAt: '2026-10-12', presentedAt: null },
    { definitionId: 'first-twig', criterionVersion: 1, earnedAt: '2026-10-12', presentedAt: null },
  ],
};
describe('achievement presentation queue', () => {
  it('presents one unseen award at a time and skips awards already opened in this session', () => {
    expect(nextAchievementUnlock(summary, new Set())?.definitionId).toBe('first-link');
    expect(nextAchievementUnlock(summary, new Set(['first-link']))?.definitionId).toBe(
      'first-twig',
    );
    expect(nextAchievementUnlock(summary, new Set(['first-link', 'first-twig']))).toBeUndefined();
  });
  it('never replays acknowledged or legacy awards after relaunch', () => {
    expect(
      nextAchievementUnlock(
        { ...summary, awards: summary.awards.map((a) => ({ ...a, presentedAt: '2026-10-12' })) },
        new Set(),
      ),
    ).toBeUndefined();
    expect(
      nextAchievementUnlock(
        { ...summary, awards: summary.awards.map(({ presentedAt: _p, ...a }) => a) },
        new Set(),
      ),
    ).toBeUndefined();
  });
  it('waits for banking and other sheets to close', () => {
    for (const path of [
      '/onboarding/enter-app',
      '/saltedge/link',
      '/funding',
      '/achievement/first-link',
      '/transaction/123',
    ])
      expect(canPresentAchievement(path)).toBe(false);
    expect(canPresentAchievement('/leaderboards')).toBe(true);
    expect(canPresentAchievement('/beaver-progress')).toBe(true);
  });
});
