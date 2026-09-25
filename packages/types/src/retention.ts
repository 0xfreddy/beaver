import { z } from 'zod';
import type { AchievementDefinition } from './social';

export const retentionEpoch = '2026-09-21T00:00:00.000Z';
export const weekMs = 7 * 24 * 60 * 60 * 1000;
export function retentionPeriod(now = new Date()) {
  const week = Math.floor((now.getTime() - Date.parse(retentionEpoch)) / weekMs);
  const season = Math.floor(week / 4);
  const startsAt = new Date(Date.parse(retentionEpoch) + season * 4 * weekMs).toISOString();
  return {
    id: startsAt.slice(0, 10),
    number: season + 1,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 4 * weekMs).toISOString(),
    weekStartsAt: new Date(Date.parse(retentionEpoch) + week * weekMs).toISOString(),
    weekNumber: (((week % 4) + 4) % 4) + 1,
  };
}
export type Season = ReturnType<typeof retentionPeriod>;
export const everydayCategories = ['coffee', 'lunch', 'ride', 'movie'] as const;
export type EverydayCategory = (typeof everydayCategories)[number];
export const everydayDefaults = { coffee: 700, lunch: 1500, ride: 2000, movie: 1800 } as const;
export const everydayTargetSchema = z
  .object({
    category: z.enum(everydayCategories),
    currency: z.literal('USD'),
    targetCents: z.number().int().min(100).max(100000),
  })
  .strict();
export const retentionActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recap'), sourceId: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal('lesson'),
      sourceId: z.string().min(1).max(80),
      answer: z.string().max(80),
    })
    .strict(),
  z.object({ kind: z.literal('roundup'), sourceId: z.uuid() }).strict(),
  z.object({ kind: z.literal('rules'), sourceId: z.literal('current') }).strict(),
]);
export const retentionLessons = [
  {
    id: 'roundup-basics',
    title: 'Where your roundups come from',
    body: 'Roundups are money you contribute from your available balance. They are not cashback, and a calculated roundup is only invested after execution succeeds.',
    question: 'When is a roundup invested?',
    choices: ['When a purchase appears', 'After execution succeeds'],
    answer: 'After execution succeeds',
  },
  {
    id: 'coffee-equivalent',
    title: 'A coffee-sized milestone',
    body: 'A coffee-sized milestone compares your contributed roundups with a coffee price you choose. It is a personal milestone, not a coffee voucher.',
    question: 'What does Coffee-Sized unlock?',
    choices: ['A personal milestone', 'A free coffee voucher'],
    answer: 'A personal milestone',
  },
  {
    id: 'your-pace',
    title: 'Progress at your pace',
    body: 'One successful roundup week earns the same points whatever the amount. Missing a week or pausing does not erase achievements. Your settings should fit your budget.',
    question: 'Do larger roundups earn more points?',
    choices: ['Yes', 'No'],
    answer: 'No',
  },
  {
    id: 'contributions-and-value',
    title: 'Contributions and value',
    body: 'Everyday milestones measure money you contributed. Your current investment value can rise or fall, so a milestone is not an available cash balance.',
    question: 'Can investment value change after a milestone?',
    choices: ['Yes', 'No'],
    answer: 'Yes',
  },
] as const;
const definition = (
  id: string,
  title: string,
  description: string,
  group: string,
): AchievementDefinition => ({
  id,
  title,
  description,
  group,
  criterionVersion: 1,
  points: 0,
  assetKey: '',
});
export const retentionAchievements = [
  definition(
    'first-twig',
    'First Twig',
    'Your first successfully executed live roundup.',
    'Getting started',
  ),
  definition(
    'know-your-beaver',
    'Know Your Beaver',
    'Complete the roundup explanation and answer its question.',
    'Getting started',
  ),
  definition(
    'your-rules',
    'Your Rules',
    'Review and confirm your current roundup settings.',
    'Getting started',
  ),
  definition(
    'second-visit',
    'Second Visit',
    'Review something meaningful again at least 24 hours after your first review.',
    'Your rhythm',
  ),
  definition(
    'first-weekly-wrap',
    'First Weekly Wrap',
    'Complete your first weekly recap.',
    'Your rhythm',
  ),
  definition(
    'building-a-habit',
    'Building a Habit',
    'Complete recaps in four different weeks.',
    'Your rhythm',
  ),
  definition(
    'in-your-rhythm',
    'In Your Rhythm',
    'Complete recaps in twelve different weeks.',
    'Your rhythm',
  ),
  definition(
    'year-in-review',
    'A Year in Review',
    'Complete recaps in 52 different weeks.',
    'Your rhythm',
  ),
  definition(
    'steady-builder',
    'Steady Builder',
    'Successfully execute roundups in four different weeks.',
    'Your rhythm',
  ),
  definition(
    'strong-foundations',
    'Strong Foundations',
    'Successfully execute roundups in twelve different weeks.',
    'Your rhythm',
  ),
  definition(
    'beaver-veteran',
    'Beaver Veteran',
    'Successfully execute roundups in 26 different weeks.',
    'Your rhythm',
  ),
  definition(
    'back-in-the-flow',
    'Back in the Flow',
    'Return for a meaningful review after 30 days away.',
    'Your rhythm',
  ),
  definition(
    'better-together',
    'Better Together',
    'Refer a friend who activates and returns at least seven days later.',
    'Your colony',
  ),
  definition(
    'small-colony',
    'Small Colony',
    'Refer three friends who activate and return.',
    'Your colony',
  ),
  definition(
    'growing-colony',
    'Growing Colony',
    'Refer five friends who activate and return.',
    'Your colony',
  ),
  ...everydayCategories.map((category) =>
    definition(
      `${category}-sized`,
      `${category[0]!.toUpperCase()}${category.slice(1)}-Sized`,
      `Contribute your chosen ${category} equivalent through executed ${category === 'lunch' ? 'dining' : category === 'ride' ? 'transport' : category === 'movie' ? 'entertainment' : 'coffee'} roundups. A personal milestone, not cashback or a voucher.`,
      'Everyday progress',
    ),
  ),
  definition(
    'little-things',
    'Little Things, Added Up',
    'Unlock three different everyday milestones.',
    'Everyday progress',
  ),
  definition(
    'full-season',
    'Full Season',
    'Complete all three weekly point actions in all four weeks of a season.',
    'Your rhythm',
  ),
] as const;
export type RetentionSummary = {
  season: Season;
  points: number;
  weeklyPoints: number;
  actions: { id: string; title: string; points: number; completed: boolean }[];
  referralCompleted: boolean;
  recap: { id: string; startsAt: string; endsAt: string; roundupCount: number; completed: boolean };
  lessons: {
    id: string;
    title: string;
    body: string;
    question: string;
    choices: readonly string[];
  }[];
  reviews: { id: string; title: string; executedAt: string }[];
  milestones: {
    category: EverydayCategory;
    currency: 'USD';
    targetCents: number;
    contributedCents: number;
    confirmed: boolean;
    earned: boolean;
  }[];
  history: { seasonId: string; points: number }[];
};
