/* eslint-disable @typescript-eslint/no-require-imports -- Metro static assets. */
import type { ImageSourcePropType } from 'react-native';
export const achievementAssets: Record<
  string,
  { thumbnail: ImageSourcePropType; detail: ImageSourcePropType }
> = {
  'introduction-complete': {
    thumbnail: require('../../assets/achievements/introduction-complete-thumbnail.png'),
    detail: require('../../assets/achievements/introduction-complete-detail.png'),
  },
  'profile-personalized': {
    thumbnail: require('../../assets/achievements/profile-personalized-thumbnail.png'),
    detail: require('../../assets/achievements/profile-personalized-detail.png'),
  },
  'rules-reviewed': {
    thumbnail: require('../../assets/achievements/rules-reviewed-thumbnail.png'),
    detail: require('../../assets/achievements/rules-reviewed-detail.png'),
  },
  'first-friend': {
    thumbnail: require('../../assets/achievements/first-friend-thumbnail.png'),
    detail: require('../../assets/achievements/first-friend-detail.png'),
  },
  'three-friends': { thumbnail: require('../../assets/achievements/three-friends-thumbnail.png'), detail: require('../../assets/achievements/three-friends-detail.png') },
  'five-friends': { thumbnail: require('../../assets/achievements/five-friends-thumbnail.png'), detail: require('../../assets/achievements/five-friends-detail.png') },
};
