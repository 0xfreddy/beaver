/* eslint-disable @typescript-eslint/no-require-imports -- Metro static coin assets. */
import type { ImageSourcePropType } from 'react-native';
const coins: Record<string, ImageSourcePropType> = {
  'know-your-beaver': require('../../assets/achievements/coins/know-your-beaver.png'),
  'your-rules': require('../../assets/achievements/coins/your-rules.png'),
  'first-review': require('../../assets/achievements/coins/first-review.png'),
  'first-weekly-wrap': require('../../assets/achievements/coins/first-weekly-wrap.png'),
  'building-a-habit': require('../../assets/achievements/coins/building-a-habit.png'),
  'in-your-rhythm': require('../../assets/achievements/coins/in-your-rhythm.png'),
  'year-in-review': require('../../assets/achievements/coins/year-in-review.png'),
  'strong-foundations': require('../../assets/achievements/coins/strong-foundations.png'),
  'beaver-veteran': require('../../assets/achievements/coins/beaver-veteran.png'),
  'better-together': require('../../assets/achievements/coins/better-together.png'),
  'small-colony': require('../../assets/achievements/coins/small-colony.png'),
  'growing-colony': require('../../assets/achievements/coins/growing-colony.png'),
  'coffee-sized': require('../../assets/achievements/coins/coffee-sized.png'),
  'lunch-sized': require('../../assets/achievements/coins/lunch-sized.png'),
  'ride-sized': require('../../assets/achievements/coins/ride-sized.png'),
  'movie-sized': require('../../assets/achievements/coins/movie-sized.png'),
  'little-things': require('../../assets/achievements/coins/little-things.png'),
  'full-season': require('../../assets/achievements/coins/full-season.png'),
  'introduction-complete': require('../../assets/achievements/coins/introduction-complete.png'),
  'profile-personalized': require('../../assets/achievements/coins/profile-personalized.png'),
  'rules-reviewed': require('../../assets/achievements/coins/rules-reviewed.png'),
  'first-friend': require('../../assets/achievements/coins/first-friend.png'),
  'three-friends': require('../../assets/achievements/coins/three-friends.png'),
  'five-friends': require('../../assets/achievements/coins/five-friends.png'),
  'second-visit': require('../../assets/achievements/coins/second-visit.png'),
  'back-in-the-flow': require('../../assets/achievements/coins/back-in-the-flow.png'),
  'first-link': require('../../assets/achievements/coins/first-link.png'),
  'first-twig': require('../../assets/achievements/coins/first-twig.png'),
  'steady-builder': require('../../assets/achievements/coins/steady-builder.png'),
};
export const achievementAssets: Record<
  string,
  { thumbnail: ImageSourcePropType; detail: ImageSourcePropType }
> = Object.fromEntries(
  Object.entries(coins).map(([id, source]) => [id, { thumbnail: source, detail: source }]),
);
