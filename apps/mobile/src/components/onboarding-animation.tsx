import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import LottieView from 'lottie-react-native';
import {
  Canvas,
  ColorMatrix,
  Fill,
  Group,
  Image as SkiaImage,
  Paint,
  useImage,
} from '@shopify/react-native-skia';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../theme';

/* eslint-disable @typescript-eslint/no-require-imports */
const animations = {
  'empty-balance': require('../../assets/animations/empty-balance.json'),
  0: require('../../assets/animations/onboarding-0.json'),
  1: require('../../assets/animations/onboarding-1.json'),
  2: require('../../assets/animations/onboarding-2.json'),
  sad: require('../../assets/animations/sad.json'),
  'access-granted': require('../../assets/animations/access-granted.json'),
  'access-denied': require('../../assets/animations/access-denied.json'),
  'access-code-binoculars': require('../../assets/animations/access-code-binoculars.json'),
  'bank-bridge-builder': require('../../assets/animations/bank-bridge-builder.json'),
  'enter-home-door': require('../../assets/animations/enter-home-door.json'),
  'funding-thumbs-up': require('../../assets/animations/funding-thumbs-up.json'),
  handshake: require('../../assets/animations/handshake.json'),
  'invite-paper-plane': require('../../assets/animations/invite-paper-plane.json'),
  'invite-peek': require('../../assets/animations/invite-peek.json'),
  'invite-stamp-approved': require('../../assets/animations/invite-stamp-approved.json'),
  privacy: require('../../assets/animations/privacy.json'),
  'receipt-scanner': require('../../assets/animations/receipt-scanner.json'),
  'roundup-coin-sorter': require('../../assets/animations/roundup-coin-sorter.json'),
  spare: require('../../assets/animations/spare.json'),
} as const;
const themedRasterAnimations = new Set<keyof typeof animations>([
  'empty-balance',
  'access-code-binoculars',
  'bank-bridge-builder',
  'enter-home-door',
  'funding-thumbs-up',
  'invite-paper-plane',
  'invite-stamp-approved',
  'receipt-scanner',
  'roundup-coin-sorter',
]);
// Photographic artwork whose own black canvas is part of the design: shown
// full-color in a dark panel instead of being mapped to the theme palette.
const fullColorRasterAnimations = new Set<keyof typeof animations>(['invite-peek']);
// Preserve the source Lottie timing, including repeated frame holds.
const stocksFrames = [
  require('../../assets/animations/stocks-frames/frame-000.jpg'),
  require('../../assets/animations/stocks-frames/frame-000.jpg'),
  require('../../assets/animations/stocks-frames/frame-001.jpg'),
  require('../../assets/animations/stocks-frames/frame-002.jpg'),
  require('../../assets/animations/stocks-frames/frame-003.jpg'),
  require('../../assets/animations/stocks-frames/frame-004.jpg'),
  require('../../assets/animations/stocks-frames/frame-005.jpg'),
  require('../../assets/animations/stocks-frames/frame-006.jpg'),
  require('../../assets/animations/stocks-frames/frame-007.jpg'),
  require('../../assets/animations/stocks-frames/frame-008.jpg'),
  require('../../assets/animations/stocks-frames/frame-009.jpg'),
  require('../../assets/animations/stocks-frames/frame-010.jpg'),
  require('../../assets/animations/stocks-frames/frame-011.jpg'),
  require('../../assets/animations/stocks-frames/frame-012.jpg'),
  require('../../assets/animations/stocks-frames/frame-013.jpg'),
  require('../../assets/animations/stocks-frames/frame-014.jpg'),
  require('../../assets/animations/stocks-frames/frame-015.jpg'),
  require('../../assets/animations/stocks-frames/frame-016.jpg'),
  require('../../assets/animations/stocks-frames/frame-017.jpg'),
  require('../../assets/animations/stocks-frames/frame-018.jpg'),
  require('../../assets/animations/stocks-frames/frame-019.jpg'),
  require('../../assets/animations/stocks-frames/frame-020.jpg'),
  require('../../assets/animations/stocks-frames/frame-021.jpg'),
  require('../../assets/animations/stocks-frames/frame-022.jpg'),
  require('../../assets/animations/stocks-frames/frame-023.jpg'),
  require('../../assets/animations/stocks-frames/frame-024.jpg'),
  require('../../assets/animations/stocks-frames/frame-024.jpg'),
  require('../../assets/animations/stocks-frames/frame-025.jpg'),
  require('../../assets/animations/stocks-frames/frame-026.jpg'),
  require('../../assets/animations/stocks-frames/frame-027.jpg'),
  require('../../assets/animations/stocks-frames/frame-028.jpg'),
  require('../../assets/animations/stocks-frames/frame-029.jpg'),
  require('../../assets/animations/stocks-frames/frame-030.jpg'),
  require('../../assets/animations/stocks-frames/frame-031.jpg'),
  require('../../assets/animations/stocks-frames/frame-032.jpg'),
  require('../../assets/animations/stocks-frames/frame-033.jpg'),
  require('../../assets/animations/stocks-frames/frame-034.jpg'),
  require('../../assets/animations/stocks-frames/frame-035.jpg'),
  require('../../assets/animations/stocks-frames/frame-036.jpg'),
  require('../../assets/animations/stocks-frames/frame-037.jpg'),
  require('../../assets/animations/stocks-frames/frame-038.jpg'),
  require('../../assets/animations/stocks-frames/frame-039.jpg'),
  require('../../assets/animations/stocks-frames/frame-040.jpg'),
  require('../../assets/animations/stocks-frames/frame-041.jpg'),
  require('../../assets/animations/stocks-frames/frame-042.jpg'),
  require('../../assets/animations/stocks-frames/frame-043.jpg'),
  require('../../assets/animations/stocks-frames/frame-044.jpg'),
  require('../../assets/animations/stocks-frames/frame-045.jpg'),
  require('../../assets/animations/stocks-frames/frame-046.jpg'),
  require('../../assets/animations/stocks-frames/frame-047.jpg'),
  require('../../assets/animations/stocks-frames/frame-048.jpg'),
  require('../../assets/animations/stocks-frames/frame-048.jpg'),
  require('../../assets/animations/stocks-frames/frame-049.jpg'),
  require('../../assets/animations/stocks-frames/frame-050.jpg'),
  require('../../assets/animations/stocks-frames/frame-051.jpg'),
  require('../../assets/animations/stocks-frames/frame-052.jpg'),
  require('../../assets/animations/stocks-frames/frame-053.jpg'),
  require('../../assets/animations/stocks-frames/frame-054.jpg'),
  require('../../assets/animations/stocks-frames/frame-055.jpg'),
  require('../../assets/animations/stocks-frames/frame-056.jpg'),
  require('../../assets/animations/stocks-frames/frame-057.jpg'),
  require('../../assets/animations/stocks-frames/frame-058.jpg'),
  require('../../assets/animations/stocks-frames/frame-059.jpg'),
  require('../../assets/animations/stocks-frames/frame-060.jpg'),
  require('../../assets/animations/stocks-frames/frame-061.jpg'),
  require('../../assets/animations/stocks-frames/frame-062.jpg'),
  require('../../assets/animations/stocks-frames/frame-063.jpg'),
  require('../../assets/animations/stocks-frames/frame-064.jpg'),
  require('../../assets/animations/stocks-frames/frame-065.jpg'),
  require('../../assets/animations/stocks-frames/frame-066.jpg'),
  require('../../assets/animations/stocks-frames/frame-067.jpg'),
  require('../../assets/animations/stocks-frames/frame-068.jpg'),
  require('../../assets/animations/stocks-frames/frame-069.jpg'),
  require('../../assets/animations/stocks-frames/frame-070.jpg'),
  require('../../assets/animations/stocks-frames/frame-071.jpg'),
  require('../../assets/animations/stocks-frames/frame-072.jpg'),
  require('../../assets/animations/stocks-frames/frame-072.jpg'),
  require('../../assets/animations/stocks-frames/frame-073.jpg'),
  require('../../assets/animations/stocks-frames/frame-074.jpg'),
  require('../../assets/animations/stocks-frames/frame-075.jpg'),
  require('../../assets/animations/stocks-frames/frame-076.jpg'),
  require('../../assets/animations/stocks-frames/frame-077.jpg'),
  require('../../assets/animations/stocks-frames/frame-078.jpg'),
  require('../../assets/animations/stocks-frames/frame-079.jpg'),
  require('../../assets/animations/stocks-frames/frame-080.jpg'),
  require('../../assets/animations/stocks-frames/frame-081.jpg'),
  require('../../assets/animations/stocks-frames/frame-082.jpg'),
  require('../../assets/animations/stocks-frames/frame-083.jpg'),
  require('../../assets/animations/stocks-frames/frame-084.jpg'),
  require('../../assets/animations/stocks-frames/frame-085.jpg'),
  require('../../assets/animations/stocks-frames/frame-086.jpg'),
  require('../../assets/animations/stocks-frames/frame-087.jpg'),
  require('../../assets/animations/stocks-frames/frame-088.jpg'),
  require('../../assets/animations/stocks-frames/frame-089.jpg'),
  require('../../assets/animations/stocks-frames/frame-090.jpg'),
  require('../../assets/animations/stocks-frames/frame-091.jpg'),
  require('../../assets/animations/stocks-frames/frame-092.jpg'),
  require('../../assets/animations/stocks-frames/frame-093.jpg'),
  require('../../assets/animations/stocks-frames/frame-094.jpg'),
  require('../../assets/animations/stocks-frames/frame-095.jpg'),
  require('../../assets/animations/stocks-frames/frame-096.jpg'),
  require('../../assets/animations/stocks-frames/frame-096.jpg'),
  require('../../assets/animations/stocks-frames/frame-097.jpg'),
  require('../../assets/animations/stocks-frames/frame-098.jpg'),
  require('../../assets/animations/stocks-frames/frame-099.jpg'),
  require('../../assets/animations/stocks-frames/frame-100.jpg'),
  require('../../assets/animations/stocks-frames/frame-101.jpg'),
  require('../../assets/animations/stocks-frames/frame-102.jpg'),
  require('../../assets/animations/stocks-frames/frame-103.jpg'),
  require('../../assets/animations/stocks-frames/frame-104.jpg'),
  require('../../assets/animations/stocks-frames/frame-105.jpg'),
  require('../../assets/animations/stocks-frames/frame-106.jpg'),
  require('../../assets/animations/stocks-frames/frame-107.jpg'),
  require('../../assets/animations/stocks-frames/frame-108.jpg'),
  require('../../assets/animations/stocks-frames/frame-109.jpg'),
  require('../../assets/animations/stocks-frames/frame-110.jpg'),
  require('../../assets/animations/stocks-frames/frame-111.jpg'),
  require('../../assets/animations/stocks-frames/frame-112.jpg'),
  require('../../assets/animations/stocks-frames/frame-113.jpg'),
  require('../../assets/animations/stocks-frames/frame-114.jpg'),
  require('../../assets/animations/stocks-frames/frame-115.jpg'),
  require('../../assets/animations/stocks-frames/frame-116.jpg'),
  require('../../assets/animations/stocks-frames/frame-117.jpg'),
  require('../../assets/animations/stocks-frames/frame-118.jpg'),
  require('../../assets/animations/stocks-frames/frame-119.jpg'),
  require('../../assets/animations/stocks-frames/frame-120.jpg'),
  require('../../assets/animations/stocks-frames/frame-120.jpg'),
  require('../../assets/animations/stocks-frames/frame-121.jpg'),
  require('../../assets/animations/stocks-frames/frame-122.jpg'),
  require('../../assets/animations/stocks-frames/frame-123.jpg'),
  require('../../assets/animations/stocks-frames/frame-124.jpg'),
  require('../../assets/animations/stocks-frames/frame-125.jpg'),
  require('../../assets/animations/stocks-frames/frame-126.jpg'),
  require('../../assets/animations/stocks-frames/frame-127.jpg'),
  require('../../assets/animations/stocks-frames/frame-128.jpg'),
  require('../../assets/animations/stocks-frames/frame-129.jpg'),
  require('../../assets/animations/stocks-frames/frame-130.jpg'),
  require('../../assets/animations/stocks-frames/frame-131.jpg'),
  require('../../assets/animations/stocks-frames/frame-132.jpg'),
  require('../../assets/animations/stocks-frames/frame-133.jpg'),
  require('../../assets/animations/stocks-frames/frame-134.jpg'),
  require('../../assets/animations/stocks-frames/frame-135.jpg'),
  require('../../assets/animations/stocks-frames/frame-136.jpg'),
  require('../../assets/animations/stocks-frames/frame-137.jpg'),
  require('../../assets/animations/stocks-frames/frame-138.jpg'),
  require('../../assets/animations/stocks-frames/frame-139.jpg'),
  require('../../assets/animations/stocks-frames/frame-140.jpg'),
  require('../../assets/animations/stocks-frames/frame-141.jpg'),
  require('../../assets/animations/stocks-frames/frame-142.jpg'),
  require('../../assets/animations/stocks-frames/frame-143.jpg'),
  require('../../assets/animations/stocks-frames/frame-144.jpg'),
  require('../../assets/animations/stocks-frames/frame-144.jpg'),
  require('../../assets/animations/stocks-frames/frame-145.jpg'),
  require('../../assets/animations/stocks-frames/frame-146.jpg'),
  require('../../assets/animations/stocks-frames/frame-147.jpg'),
  require('../../assets/animations/stocks-frames/frame-148.jpg'),
  require('../../assets/animations/stocks-frames/frame-149.jpg'),
  require('../../assets/animations/stocks-frames/frame-150.jpg'),
  require('../../assets/animations/stocks-frames/frame-151.jpg'),
  require('../../assets/animations/stocks-frames/frame-152.jpg'),
  require('../../assets/animations/stocks-frames/frame-153.jpg'),
  require('../../assets/animations/stocks-frames/frame-154.jpg'),
  require('../../assets/animations/stocks-frames/frame-155.jpg'),
  require('../../assets/animations/stocks-frames/frame-156.jpg'),
  require('../../assets/animations/stocks-frames/frame-157.jpg'),
  require('../../assets/animations/stocks-frames/frame-158.jpg'),
  require('../../assets/animations/stocks-frames/frame-159.jpg'),
  require('../../assets/animations/stocks-frames/frame-160.jpg'),
  require('../../assets/animations/stocks-frames/frame-161.jpg'),
  require('../../assets/animations/stocks-frames/frame-162.jpg'),
  require('../../assets/animations/stocks-frames/frame-163.jpg'),
  require('../../assets/animations/stocks-frames/frame-164.jpg'),
  require('../../assets/animations/stocks-frames/frame-165.jpg'),
  require('../../assets/animations/stocks-frames/frame-166.jpg'),
  require('../../assets/animations/stocks-frames/frame-167.jpg'),
  require('../../assets/animations/stocks-frames/frame-168.jpg'),
  require('../../assets/animations/stocks-frames/frame-168.jpg'),
  require('../../assets/animations/stocks-frames/frame-169.jpg'),
  require('../../assets/animations/stocks-frames/frame-170.jpg'),
  require('../../assets/animations/stocks-frames/frame-171.jpg'),
  require('../../assets/animations/stocks-frames/frame-172.jpg'),
  require('../../assets/animations/stocks-frames/frame-173.jpg'),
  require('../../assets/animations/stocks-frames/frame-174.jpg'),
  require('../../assets/animations/stocks-frames/frame-175.jpg'),
  require('../../assets/animations/stocks-frames/frame-176.jpg'),
  require('../../assets/animations/stocks-frames/frame-177.jpg'),
  require('../../assets/animations/stocks-frames/frame-178.jpg'),
  require('../../assets/animations/stocks-frames/frame-179.jpg'),
  require('../../assets/animations/stocks-frames/frame-180.jpg'),
  require('../../assets/animations/stocks-frames/frame-181.jpg'),
  require('../../assets/animations/stocks-frames/frame-182.jpg'),
  require('../../assets/animations/stocks-frames/frame-183.jpg'),
  require('../../assets/animations/stocks-frames/frame-184.jpg'),
  require('../../assets/animations/stocks-frames/frame-185.jpg'),
  require('../../assets/animations/stocks-frames/frame-186.jpg'),
  require('../../assets/animations/stocks-frames/frame-187.jpg'),
  require('../../assets/animations/stocks-frames/frame-188.jpg'),
  require('../../assets/animations/stocks-frames/frame-189.jpg'),
  require('../../assets/animations/stocks-frames/frame-190.jpg'),
  require('../../assets/animations/stocks-frames/frame-191.jpg'),
  require('../../assets/animations/stocks-frames/frame-192.jpg'),
  require('../../assets/animations/stocks-frames/frame-192.jpg'),
  require('../../assets/animations/stocks-frames/frame-193.jpg'),
  require('../../assets/animations/stocks-frames/frame-194.jpg'),
  require('../../assets/animations/stocks-frames/frame-195.jpg'),
  require('../../assets/animations/stocks-frames/frame-196.jpg'),
  require('../../assets/animations/stocks-frames/frame-197.jpg'),
  require('../../assets/animations/stocks-frames/frame-198.jpg'),
  require('../../assets/animations/stocks-frames/frame-199.jpg'),
  require('../../assets/animations/stocks-frames/frame-200.jpg'),
  require('../../assets/animations/stocks-frames/frame-201.jpg'),
  require('../../assets/animations/stocks-frames/frame-202.jpg'),
  require('../../assets/animations/stocks-frames/frame-203.jpg'),
  require('../../assets/animations/stocks-frames/frame-204.jpg'),
  require('../../assets/animations/stocks-frames/frame-205.jpg'),
  require('../../assets/animations/stocks-frames/frame-206.jpg'),
  require('../../assets/animations/stocks-frames/frame-207.jpg'),
  require('../../assets/animations/stocks-frames/frame-208.jpg'),
  require('../../assets/animations/stocks-frames/frame-209.jpg'),
  require('../../assets/animations/stocks-frames/frame-210.jpg'),
  require('../../assets/animations/stocks-frames/frame-211.jpg'),
  require('../../assets/animations/stocks-frames/frame-212.jpg'),
  require('../../assets/animations/stocks-frames/frame-213.jpg'),
  require('../../assets/animations/stocks-frames/frame-214.jpg'),
  require('../../assets/animations/stocks-frames/frame-215.jpg'),
  require('../../assets/animations/stocks-frames/frame-216.jpg'),
  require('../../assets/animations/stocks-frames/frame-216.jpg'),
  require('../../assets/animations/stocks-frames/frame-217.jpg'),
  require('../../assets/animations/stocks-frames/frame-218.jpg'),
  require('../../assets/animations/stocks-frames/frame-219.jpg'),
  require('../../assets/animations/stocks-frames/frame-220.jpg'),
  require('../../assets/animations/stocks-frames/frame-221.jpg'),
  require('../../assets/animations/stocks-frames/frame-222.jpg'),
  require('../../assets/animations/stocks-frames/frame-223.jpg'),
] as const;
const sliderFrames = [
  require('../../assets/animations/slider-frames/frame-00.png'),
  require('../../assets/animations/slider-frames/frame-01.png'),
  require('../../assets/animations/slider-frames/frame-02.png'),
  require('../../assets/animations/slider-frames/frame-03.png'),
  require('../../assets/animations/slider-frames/frame-04.png'),
  require('../../assets/animations/slider-frames/frame-05.png'),
  require('../../assets/animations/slider-frames/frame-06.png'),
  require('../../assets/animations/slider-frames/frame-07.png'),
  require('../../assets/animations/slider-frames/frame-08.png'),
  require('../../assets/animations/slider-frames/frame-09.png'),
  require('../../assets/animations/slider-frames/frame-10.png'),
  require('../../assets/animations/slider-frames/frame-11.png'),
  require('../../assets/animations/slider-frames/frame-12.png'),
  require('../../assets/animations/slider-frames/frame-13.png'),
  require('../../assets/animations/slider-frames/frame-14.png'),
  require('../../assets/animations/slider-frames/frame-15.png'),
  require('../../assets/animations/slider-frames/frame-16.png'),
  require('../../assets/animations/slider-frames/frame-17.png'),
  require('../../assets/animations/slider-frames/frame-18.png'),
  require('../../assets/animations/slider-frames/frame-19.png'),
  require('../../assets/animations/slider-frames/frame-20.png'),
  require('../../assets/animations/slider-frames/frame-21.png'),
  require('../../assets/animations/slider-frames/frame-22.png'),
  require('../../assets/animations/slider-frames/frame-23.png'),
  require('../../assets/animations/slider-frames/frame-24.png'),
  require('../../assets/animations/slider-frames/frame-25.png'),
  require('../../assets/animations/slider-frames/frame-26.png'),
  require('../../assets/animations/slider-frames/frame-27.png'),
  require('../../assets/animations/slider-frames/frame-28.png'),
  require('../../assets/animations/slider-frames/frame-29.png'),
  require('../../assets/animations/slider-frames/frame-30.png'),
  require('../../assets/animations/slider-frames/frame-31.png'),
  require('../../assets/animations/slider-frames/frame-32.png'),
  require('../../assets/animations/slider-frames/frame-33.png'),
  require('../../assets/animations/slider-frames/frame-34.png'),
  require('../../assets/animations/slider-frames/frame-35.png'),
  require('../../assets/animations/slider-frames/frame-36.png'),
  require('../../assets/animations/slider-frames/frame-37.png'),
  require('../../assets/animations/slider-frames/frame-38.png'),
  require('../../assets/animations/slider-frames/frame-39.png'),
  require('../../assets/animations/slider-frames/frame-40.png'),
  require('../../assets/animations/slider-frames/frame-41.png'),
  require('../../assets/animations/slider-frames/frame-42.png'),
  require('../../assets/animations/slider-frames/frame-43.png'),
  require('../../assets/animations/slider-frames/frame-44.png'),
  require('../../assets/animations/slider-frames/frame-45.png'),
  require('../../assets/animations/slider-frames/frame-46.png'),
  require('../../assets/animations/slider-frames/frame-47.png'),
  require('../../assets/animations/slider-frames/frame-48.png'),
  require('../../assets/animations/slider-frames/frame-49.png'),
  require('../../assets/animations/slider-frames/frame-50.png'),
  require('../../assets/animations/slider-frames/frame-51.png'),
  require('../../assets/animations/slider-frames/frame-52.png'),
  require('../../assets/animations/slider-frames/frame-53.png'),
  require('../../assets/animations/slider-frames/frame-54.png'),
  require('../../assets/animations/slider-frames/frame-55.png'),
  require('../../assets/animations/slider-frames/frame-56.png'),
  require('../../assets/animations/slider-frames/frame-57.png'),
  require('../../assets/animations/slider-frames/frame-58.png'),
  require('../../assets/animations/slider-frames/frame-59.png'),
] as const;
const cryptoCardFrames = [
  require('../../assets/animations/crypto-card-frames/frame-00.png'),
  require('../../assets/animations/crypto-card-frames/frame-01.png'),
  require('../../assets/animations/crypto-card-frames/frame-02.png'),
  require('../../assets/animations/crypto-card-frames/frame-03.png'),
  require('../../assets/animations/crypto-card-frames/frame-04.png'),
  require('../../assets/animations/crypto-card-frames/frame-05.png'),
  require('../../assets/animations/crypto-card-frames/frame-06.png'),
  require('../../assets/animations/crypto-card-frames/frame-07.png'),
  require('../../assets/animations/crypto-card-frames/frame-08.png'),
  require('../../assets/animations/crypto-card-frames/frame-09.png'),
  require('../../assets/animations/crypto-card-frames/frame-10.png'),
  require('../../assets/animations/crypto-card-frames/frame-11.png'),
  require('../../assets/animations/crypto-card-frames/frame-12.png'),
  require('../../assets/animations/crypto-card-frames/frame-13.png'),
  require('../../assets/animations/crypto-card-frames/frame-14.png'),
  require('../../assets/animations/crypto-card-frames/frame-15.png'),
  require('../../assets/animations/crypto-card-frames/frame-16.png'),
  require('../../assets/animations/crypto-card-frames/frame-17.png'),
  require('../../assets/animations/crypto-card-frames/frame-18.png'),
  require('../../assets/animations/crypto-card-frames/frame-19.png'),
  require('../../assets/animations/crypto-card-frames/frame-20.png'),
  require('../../assets/animations/crypto-card-frames/frame-21.png'),
  require('../../assets/animations/crypto-card-frames/frame-22.png'),
  require('../../assets/animations/crypto-card-frames/frame-23.png'),
  require('../../assets/animations/crypto-card-frames/frame-24.png'),
  require('../../assets/animations/crypto-card-frames/frame-25.png'),
  require('../../assets/animations/crypto-card-frames/frame-26.png'),
  require('../../assets/animations/crypto-card-frames/frame-27.png'),
  require('../../assets/animations/crypto-card-frames/frame-28.png'),
  require('../../assets/animations/crypto-card-frames/frame-29.png'),
  require('../../assets/animations/crypto-card-frames/frame-30.png'),
  require('../../assets/animations/crypto-card-frames/frame-31.png'),
  require('../../assets/animations/crypto-card-frames/frame-32.png'),
  require('../../assets/animations/crypto-card-frames/frame-33.png'),
  require('../../assets/animations/crypto-card-frames/frame-34.png'),
  require('../../assets/animations/crypto-card-frames/frame-35.png'),
  require('../../assets/animations/crypto-card-frames/frame-36.png'),
  require('../../assets/animations/crypto-card-frames/frame-37.png'),
  require('../../assets/animations/crypto-card-frames/frame-38.png'),
  require('../../assets/animations/crypto-card-frames/frame-39.png'),
  require('../../assets/animations/crypto-card-frames/frame-40.png'),
  require('../../assets/animations/crypto-card-frames/frame-41.png'),
  require('../../assets/animations/crypto-card-frames/frame-42.png'),
  require('../../assets/animations/crypto-card-frames/frame-43.png'),
  require('../../assets/animations/crypto-card-frames/frame-44.png'),
  require('../../assets/animations/crypto-card-frames/frame-45.png'),
  require('../../assets/animations/crypto-card-frames/frame-46.png'),
  require('../../assets/animations/crypto-card-frames/frame-47.png'),
  require('../../assets/animations/crypto-card-frames/frame-48.png'),
  require('../../assets/animations/crypto-card-frames/frame-49.png'),
  require('../../assets/animations/crypto-card-frames/frame-50.png'),
  require('../../assets/animations/crypto-card-frames/frame-51.png'),
  require('../../assets/animations/crypto-card-frames/frame-52.png'),
] as const;
const firstScreenFrames = [
  require('../../assets/animations/first-screen-frames/frame-00.png'),
  require('../../assets/animations/first-screen-frames/frame-01.png'),
  require('../../assets/animations/first-screen-frames/frame-02.png'),
  require('../../assets/animations/first-screen-frames/frame-03.png'),
  require('../../assets/animations/first-screen-frames/frame-04.png'),
  require('../../assets/animations/first-screen-frames/frame-05.png'),
  require('../../assets/animations/first-screen-frames/frame-06.png'),
  require('../../assets/animations/first-screen-frames/frame-07.png'),
  require('../../assets/animations/first-screen-frames/frame-08.png'),
  require('../../assets/animations/first-screen-frames/frame-09.png'),
  require('../../assets/animations/first-screen-frames/frame-10.png'),
  require('../../assets/animations/first-screen-frames/frame-11.png'),
  require('../../assets/animations/first-screen-frames/frame-12.png'),
  require('../../assets/animations/first-screen-frames/frame-13.png'),
  require('../../assets/animations/first-screen-frames/frame-14.png'),
  require('../../assets/animations/first-screen-frames/frame-15.png'),
  require('../../assets/animations/first-screen-frames/frame-16.png'),
  require('../../assets/animations/first-screen-frames/frame-17.png'),
  require('../../assets/animations/first-screen-frames/frame-18.png'),
  require('../../assets/animations/first-screen-frames/frame-19.png'),
  require('../../assets/animations/first-screen-frames/frame-20.png'),
  require('../../assets/animations/first-screen-frames/frame-21.png'),
  require('../../assets/animations/first-screen-frames/frame-22.png'),
  require('../../assets/animations/first-screen-frames/frame-23.png'),
  require('../../assets/animations/first-screen-frames/frame-24.png'),
  require('../../assets/animations/first-screen-frames/frame-25.png'),
  require('../../assets/animations/first-screen-frames/frame-26.png'),
  require('../../assets/animations/first-screen-frames/frame-27.png'),
  require('../../assets/animations/first-screen-frames/frame-28.png'),
  require('../../assets/animations/first-screen-frames/frame-29.png'),
  require('../../assets/animations/first-screen-frames/frame-30.png'),
  require('../../assets/animations/first-screen-frames/frame-31.png'),
  require('../../assets/animations/first-screen-frames/frame-32.png'),
  require('../../assets/animations/first-screen-frames/frame-33.png'),
  require('../../assets/animations/first-screen-frames/frame-34.png'),
  require('../../assets/animations/first-screen-frames/frame-35.png'),
  require('../../assets/animations/first-screen-frames/frame-36.png'),
  require('../../assets/animations/first-screen-frames/frame-37.png'),
  require('../../assets/animations/first-screen-frames/frame-38.png'),
  require('../../assets/animations/first-screen-frames/frame-39.png'),
  require('../../assets/animations/first-screen-frames/frame-40.png'),
  require('../../assets/animations/first-screen-frames/frame-41.png'),
  require('../../assets/animations/first-screen-frames/frame-42.png'),
  require('../../assets/animations/first-screen-frames/frame-43.png'),
  require('../../assets/animations/first-screen-frames/frame-44.png'),
  require('../../assets/animations/first-screen-frames/frame-45.png'),
  require('../../assets/animations/first-screen-frames/frame-46.png'),
  require('../../assets/animations/first-screen-frames/frame-47.png'),
  require('../../assets/animations/first-screen-frames/frame-48.png'),
  require('../../assets/animations/first-screen-frames/frame-49.png'),
  require('../../assets/animations/first-screen-frames/frame-50.png'),
  require('../../assets/animations/first-screen-frames/frame-51.png'),
  require('../../assets/animations/first-screen-frames/frame-52.png'),
  require('../../assets/animations/first-screen-frames/frame-53.png'),
  require('../../assets/animations/first-screen-frames/frame-54.png'),
  require('../../assets/animations/first-screen-frames/frame-55.png'),
  require('../../assets/animations/first-screen-frames/frame-56.png'),
  require('../../assets/animations/first-screen-frames/frame-57.png'),
  require('../../assets/animations/first-screen-frames/frame-58.png'),
  require('../../assets/animations/first-screen-frames/frame-59.png'),
  require('../../assets/animations/first-screen-frames/frame-60.png'),
  require('../../assets/animations/first-screen-frames/frame-61.png'),
  require('../../assets/animations/first-screen-frames/frame-62.png'),
  require('../../assets/animations/first-screen-frames/frame-63.png'),
  require('../../assets/animations/first-screen-frames/frame-64.png'),
  require('../../assets/animations/first-screen-frames/frame-65.png'),
  require('../../assets/animations/first-screen-frames/frame-66.png'),
  require('../../assets/animations/first-screen-frames/frame-67.png'),
  require('../../assets/animations/first-screen-frames/frame-68.png'),
  require('../../assets/animations/first-screen-frames/frame-69.png'),
  require('../../assets/animations/first-screen-frames/frame-70.png'),
  require('../../assets/animations/first-screen-frames/frame-71.png'),
  require('../../assets/animations/first-screen-frames/frame-72.png'),
  require('../../assets/animations/first-screen-frames/frame-73.png'),
  require('../../assets/animations/first-screen-frames/frame-74.png'),
  require('../../assets/animations/first-screen-frames/frame-75.png'),
  require('../../assets/animations/first-screen-frames/frame-76.png'),
] as const;
const coinsFrames = [
  require('../../assets/animations/coins-frames/frame-00.png'),
  require('../../assets/animations/coins-frames/frame-01.png'),
  require('../../assets/animations/coins-frames/frame-02.png'),
  require('../../assets/animations/coins-frames/frame-03.png'),
  require('../../assets/animations/coins-frames/frame-04.png'),
  require('../../assets/animations/coins-frames/frame-05.png'),
  require('../../assets/animations/coins-frames/frame-06.png'),
  require('../../assets/animations/coins-frames/frame-07.png'),
  require('../../assets/animations/coins-frames/frame-08.png'),
  require('../../assets/animations/coins-frames/frame-09.png'),
  require('../../assets/animations/coins-frames/frame-10.png'),
  require('../../assets/animations/coins-frames/frame-11.png'),
  require('../../assets/animations/coins-frames/frame-12.png'),
  require('../../assets/animations/coins-frames/frame-13.png'),
  require('../../assets/animations/coins-frames/frame-14.png'),
  require('../../assets/animations/coins-frames/frame-15.png'),
  require('../../assets/animations/coins-frames/frame-16.png'),
  require('../../assets/animations/coins-frames/frame-17.png'),
  require('../../assets/animations/coins-frames/frame-18.png'),
  require('../../assets/animations/coins-frames/frame-19.png'),
  require('../../assets/animations/coins-frames/frame-20.png'),
  require('../../assets/animations/coins-frames/frame-21.png'),
  require('../../assets/animations/coins-frames/frame-22.png'),
  require('../../assets/animations/coins-frames/frame-23.png'),
  require('../../assets/animations/coins-frames/frame-24.png'),
  require('../../assets/animations/coins-frames/frame-25.png'),
  require('../../assets/animations/coins-frames/frame-26.png'),
  require('../../assets/animations/coins-frames/frame-27.png'),
  require('../../assets/animations/coins-frames/frame-28.png'),
  require('../../assets/animations/coins-frames/frame-29.png'),
  require('../../assets/animations/coins-frames/frame-30.png'),
  require('../../assets/animations/coins-frames/frame-31.png'),
  require('../../assets/animations/coins-frames/frame-32.png'),
  require('../../assets/animations/coins-frames/frame-33.png'),
  require('../../assets/animations/coins-frames/frame-34.png'),
  require('../../assets/animations/coins-frames/frame-35.png'),
  require('../../assets/animations/coins-frames/frame-36.png'),
  require('../../assets/animations/coins-frames/frame-37.png'),
  require('../../assets/animations/coins-frames/frame-38.png'),
  require('../../assets/animations/coins-frames/frame-39.png'),
  require('../../assets/animations/coins-frames/frame-40.png'),
  require('../../assets/animations/coins-frames/frame-41.png'),
  require('../../assets/animations/coins-frames/frame-42.png'),
  require('../../assets/animations/coins-frames/frame-43.png'),
  require('../../assets/animations/coins-frames/frame-44.png'),
  require('../../assets/animations/coins-frames/frame-45.png'),
  require('../../assets/animations/coins-frames/frame-46.png'),
  require('../../assets/animations/coins-frames/frame-47.png'),
  require('../../assets/animations/coins-frames/frame-48.png'),
  require('../../assets/animations/coins-frames/frame-49.png'),
  require('../../assets/animations/coins-frames/frame-50.png'),
  require('../../assets/animations/coins-frames/frame-51.png'),
  require('../../assets/animations/coins-frames/frame-52.png'),
  require('../../assets/animations/coins-frames/frame-53.png'),
  require('../../assets/animations/coins-frames/frame-54.png'),
  require('../../assets/animations/coins-frames/frame-55.png'),
  require('../../assets/animations/coins-frames/frame-56.png'),
  require('../../assets/animations/coins-frames/frame-57.png'),
] as const;
const growFrames = [
  require('../../assets/animations/grow-frames/frame-00.jpg'),
  require('../../assets/animations/grow-frames/frame-01.jpg'),
  require('../../assets/animations/grow-frames/frame-02.jpg'),
  require('../../assets/animations/grow-frames/frame-03.jpg'),
  require('../../assets/animations/grow-frames/frame-04.jpg'),
  require('../../assets/animations/grow-frames/frame-05.jpg'),
  require('../../assets/animations/grow-frames/frame-06.jpg'),
  require('../../assets/animations/grow-frames/frame-07.jpg'),
  require('../../assets/animations/grow-frames/frame-08.jpg'),
  require('../../assets/animations/grow-frames/frame-09.jpg'),
  require('../../assets/animations/grow-frames/frame-10.jpg'),
  require('../../assets/animations/grow-frames/frame-11.jpg'),
  require('../../assets/animations/grow-frames/frame-12.jpg'),
  require('../../assets/animations/grow-frames/frame-13.jpg'),
  require('../../assets/animations/grow-frames/frame-14.jpg'),
  require('../../assets/animations/grow-frames/frame-15.jpg'),
  require('../../assets/animations/grow-frames/frame-16.jpg'),
  require('../../assets/animations/grow-frames/frame-17.jpg'),
  require('../../assets/animations/grow-frames/frame-18.jpg'),
  require('../../assets/animations/grow-frames/frame-19.jpg'),
  require('../../assets/animations/grow-frames/frame-20.jpg'),
  require('../../assets/animations/grow-frames/frame-21.jpg'),
  require('../../assets/animations/grow-frames/frame-22.jpg'),
  require('../../assets/animations/grow-frames/frame-23.jpg'),
  require('../../assets/animations/grow-frames/frame-24.jpg'),
  require('../../assets/animations/grow-frames/frame-25.jpg'),
  require('../../assets/animations/grow-frames/frame-26.jpg'),
  require('../../assets/animations/grow-frames/frame-27.jpg'),
  require('../../assets/animations/grow-frames/frame-28.jpg'),
  require('../../assets/animations/grow-frames/frame-29.jpg'),
  require('../../assets/animations/grow-frames/frame-30.jpg'),
  require('../../assets/animations/grow-frames/frame-31.jpg'),
  require('../../assets/animations/grow-frames/frame-32.jpg'),
  require('../../assets/animations/grow-frames/frame-33.jpg'),
  require('../../assets/animations/grow-frames/frame-34.jpg'),
  require('../../assets/animations/grow-frames/frame-35.jpg'),
  require('../../assets/animations/grow-frames/frame-36.jpg'),
  require('../../assets/animations/grow-frames/frame-37.jpg'),
  require('../../assets/animations/grow-frames/frame-38.jpg'),
  require('../../assets/animations/grow-frames/frame-39.jpg'),
  require('../../assets/animations/grow-frames/frame-40.jpg'),
  require('../../assets/animations/grow-frames/frame-41.jpg'),
  require('../../assets/animations/grow-frames/frame-42.jpg'),
  require('../../assets/animations/grow-frames/frame-43.jpg'),
  require('../../assets/animations/grow-frames/frame-44.jpg'),
  require('../../assets/animations/grow-frames/frame-45.jpg'),
  require('../../assets/animations/grow-frames/frame-46.jpg'),
  require('../../assets/animations/grow-frames/frame-47.jpg'),
  require('../../assets/animations/grow-frames/frame-48.jpg'),
  require('../../assets/animations/grow-frames/frame-49.jpg'),
  require('../../assets/animations/grow-frames/frame-50.jpg'),
  require('../../assets/animations/grow-frames/frame-51.jpg'),
  require('../../assets/animations/grow-frames/frame-52.jpg'),
  require('../../assets/animations/grow-frames/frame-53.jpg'),
  require('../../assets/animations/grow-frames/frame-54.jpg'),
  require('../../assets/animations/grow-frames/frame-55.jpg'),
  require('../../assets/animations/grow-frames/frame-56.jpg'),
  require('../../assets/animations/grow-frames/frame-57.jpg'),
  require('../../assets/animations/grow-frames/frame-58.jpg'),
  require('../../assets/animations/grow-frames/frame-59.jpg'),
  require('../../assets/animations/grow-frames/frame-60.jpg'),
  require('../../assets/animations/grow-frames/frame-61.jpg'),
] as const;
const waitFrames = [
  require('../../assets/animations/wait-frames/frame-00.jpg'),
  require('../../assets/animations/wait-frames/frame-01.jpg'),
  require('../../assets/animations/wait-frames/frame-02.jpg'),
  require('../../assets/animations/wait-frames/frame-03.jpg'),
  require('../../assets/animations/wait-frames/frame-04.jpg'),
  require('../../assets/animations/wait-frames/frame-05.jpg'),
  require('../../assets/animations/wait-frames/frame-06.jpg'),
  require('../../assets/animations/wait-frames/frame-07.jpg'),
  require('../../assets/animations/wait-frames/frame-08.jpg'),
  require('../../assets/animations/wait-frames/frame-09.jpg'),
  require('../../assets/animations/wait-frames/frame-10.jpg'),
  require('../../assets/animations/wait-frames/frame-11.jpg'),
  require('../../assets/animations/wait-frames/frame-12.jpg'),
  require('../../assets/animations/wait-frames/frame-13.jpg'),
  require('../../assets/animations/wait-frames/frame-14.jpg'),
  require('../../assets/animations/wait-frames/frame-15.jpg'),
  require('../../assets/animations/wait-frames/frame-16.jpg'),
  require('../../assets/animations/wait-frames/frame-17.jpg'),
  require('../../assets/animations/wait-frames/frame-18.jpg'),
  require('../../assets/animations/wait-frames/frame-19.jpg'),
  require('../../assets/animations/wait-frames/frame-20.jpg'),
  require('../../assets/animations/wait-frames/frame-21.jpg'),
  require('../../assets/animations/wait-frames/frame-22.jpg'),
  require('../../assets/animations/wait-frames/frame-23.jpg'),
  require('../../assets/animations/wait-frames/frame-24.jpg'),
  require('../../assets/animations/wait-frames/frame-25.jpg'),
  require('../../assets/animations/wait-frames/frame-26.jpg'),
  require('../../assets/animations/wait-frames/frame-27.jpg'),
  require('../../assets/animations/wait-frames/frame-28.jpg'),
  require('../../assets/animations/wait-frames/frame-29.jpg'),
  require('../../assets/animations/wait-frames/frame-30.jpg'),
  require('../../assets/animations/wait-frames/frame-31.jpg'),
  require('../../assets/animations/wait-frames/frame-32.jpg'),
  require('../../assets/animations/wait-frames/frame-33.jpg'),
  require('../../assets/animations/wait-frames/frame-34.jpg'),
  require('../../assets/animations/wait-frames/frame-35.jpg'),
  require('../../assets/animations/wait-frames/frame-36.jpg'),
  require('../../assets/animations/wait-frames/frame-37.jpg'),
  require('../../assets/animations/wait-frames/frame-38.jpg'),
  require('../../assets/animations/wait-frames/frame-39.jpg'),
  require('../../assets/animations/wait-frames/frame-40.jpg'),
  require('../../assets/animations/wait-frames/frame-41.jpg'),
  require('../../assets/animations/wait-frames/frame-42.jpg'),
  require('../../assets/animations/wait-frames/frame-43.jpg'),
  require('../../assets/animations/wait-frames/frame-44.jpg'),
  require('../../assets/animations/wait-frames/frame-45.jpg'),
  require('../../assets/animations/wait-frames/frame-46.jpg'),
  require('../../assets/animations/wait-frames/frame-47.jpg'),
  require('../../assets/animations/wait-frames/frame-48.jpg'),
  require('../../assets/animations/wait-frames/frame-49.jpg'),
  require('../../assets/animations/wait-frames/frame-50.jpg'),
  require('../../assets/animations/wait-frames/frame-51.jpg'),
  require('../../assets/animations/wait-frames/frame-52.jpg'),
  require('../../assets/animations/wait-frames/frame-53.jpg'),
  require('../../assets/animations/wait-frames/frame-54.jpg'),
  require('../../assets/animations/wait-frames/frame-55.jpg'),
  require('../../assets/animations/wait-frames/frame-56.jpg'),
  require('../../assets/animations/wait-frames/frame-57.jpg'),
  require('../../assets/animations/wait-frames/frame-58.jpg'),
  require('../../assets/animations/wait-frames/frame-59.jpg'),
  require('../../assets/animations/wait-frames/frame-60.jpg'),
  require('../../assets/animations/wait-frames/frame-61.jpg'),
] as const;
/* eslint-enable @typescript-eslint/no-require-imports */

// Skip the first 0.4 seconds, rounded to the source animation's frame boundary.
const trimmedWaitFrames = waitFrames.slice(Math.round((waitFrames.length * 400) / 5160));
const trimmedFirstScreenFrames = firstScreenFrames.slice(
  Math.round((firstScreenFrames.length * 200) / 10133),
);
const trimmedStocksFrames = stocksFrames.slice(Math.round((stocksFrames.length * 400) / 9360));

export type AnimationName =
  | keyof typeof animations
  | 'sliders'
  | 'crypto-cards'
  | 'first-screen'
  | 'coins'
  | 'grow'
  | 'wait'
  | 'stocks';

type EmbeddedAnimation = {
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  layers: { ip: number; refId?: string }[];
  assets: { id: string; p?: string }[];
};

function embeddedFrames(source: EmbeddedAnimation) {
  const assets = new Map(source.assets.map((asset) => [asset.id, asset.p]));
  return source.layers
    .filter((layer) => layer.refId && assets.get(layer.refId))
    .sort((a, b) => a.ip - b.ip)
    .map((layer) => assets.get(layer.refId!)!);
}

function ThemedRasterFrame({
  source,
  width,
  height,
  scale = 1,
  bottomAligned = false,
  backgroundColor,
  foregroundColor,
  monochrome = true,
}: {
  source: number | string;
  width: number;
  height: number;
  scale?: number;
  bottomAligned?: boolean;
  backgroundColor?: string;
  foregroundColor: string;
  monochrome?: boolean;
}) {
  const image = useImage(source);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const fallbackSource = typeof source === 'number' ? source : { uri: source };
  const picture = image ? (
    <SkiaImage
      image={image}
      x={(width - drawWidth) / 2}
      y={bottomAligned ? height - drawHeight : (height - drawHeight) / 2}
      width={drawWidth}
      height={drawHeight}
      fit="contain"
    />
  ) : null;
  if (!image)
    return (
      <View
        style={{
          width,
          height,
          alignItems: 'center',
          justifyContent: bottomAligned ? 'flex-end' : 'center',
          backgroundColor,
          overflow: 'hidden',
        }}
      >
        <Image
          source={fallbackSource}
          resizeMode="contain"
          style={{ width: drawWidth, height: drawHeight }}
        />
      </View>
    );
  const matrix = themedMonochromeMatrix(backgroundColor ?? '#000000', foregroundColor);
  return (
    <Canvas style={{ width, height }}>
      {monochrome && backgroundColor ? <Fill color={backgroundColor} /> : null}
      <Group
        layer={
          monochrome ? (
            <Paint>
              <ColorMatrix matrix={matrix} />
            </Paint>
          ) : undefined
        }
      >
        {picture}
      </Group>
    </Canvas>
  );
}

function rgb(color: string) {
  const value = color.replace('#', '');
  const expanded = value.length === 3 ? [...value].map((part) => `${part}${part}`).join('') : value;
  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16) / 255);
}

function themedMonochromeMatrix(background: string, foreground: string) {
  const [br, bg, bb] = rgb(background);
  const [fr, fg, fb] = rgb(foreground);
  return [fr! - br!, 0, 0, 0, br!, 0, fg! - bg!, 0, 0, bg!, 0, 0, fb! - bb!, 0, bb!, 0, 0, 0, 1, 0];
}

function SliderAnimation({
  height,
  progress,
  backgroundColor,
  foregroundColor,
}: {
  height: number;
  progress: number;
  backgroundColor: string;
  foregroundColor: string;
}) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const frame = Math.round(boundedProgress * (sliderFrames.length - 1));
  const scale = 0.76 + boundedProgress * 0.32;

  return (
    <View style={{ width: '100%', height, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedRasterFrame
        source={sliderFrames[frame]}
        width={height * (1248 / 1080)}
        height={height}
        scale={scale}
        bottomAligned
        backgroundColor={backgroundColor}
        foregroundColor={foregroundColor}
      />
    </View>
  );
}

function RasterFrameAnimation({
  height,
  frames,
  duration,
  loop,
  reduced,
  onAnimationFinish,
  backgroundColor,
  foregroundColor,
  progress,
  widthRatio = 312 / 270,
  scale = 1,
  monochrome = true,
}: {
  height: number;
  frames: readonly (number | string)[];
  duration: number;
  loop: boolean;
  reduced: boolean;
  onAnimationFinish?: () => void;
  backgroundColor?: string;
  foregroundColor: string;
  progress?: number;
  widthRatio?: number;
  scale?: number;
  monochrome?: boolean;
}) {
  const frameWidth = height * widthRatio;
  const [frame, setFrame] = useState(reduced ? Math.floor(frames.length / 2) : 0);

  useEffect(() => {
    if (progress !== undefined || reduced) {
      setFrame(Math.floor(frames.length / 2));
      return;
    }
    const startedAt = Date.now();
    setFrame(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = loop ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);
      const nextFrame = Math.min(frames.length - 1, Math.floor(progress * frames.length));
      setFrame((current) => (current === nextFrame ? current : nextFrame));
      if (!loop && elapsed >= duration) {
        clearInterval(timer);
        onAnimationFinish?.();
      }
    }, duration / frames.length);
    return () => clearInterval(timer);
  }, [duration, frames, loop, onAnimationFinish, progress, reduced]);

  const displayFrame =
    progress === undefined
      ? frame
      : Math.round(Math.max(0, Math.min(1, progress)) * (frames.length - 1));

  return (
    <ThemedRasterFrame
      source={frames[displayFrame]!}
      width={frameWidth}
      height={height}
      scale={scale}
      backgroundColor={backgroundColor}
      foregroundColor={foregroundColor}
      monochrome={monochrome}
    />
  );
}

export function OnboardingAnimation({
  name,
  height = 300,
  onAnimationFinish,
  progress,
  loop,
  backgroundColor,
  foregroundColor,
  transparent = false,
}: {
  name: AnimationName;
  height?: number;
  onAnimationFinish?: () => void;
  progress?: number;
  loop?: boolean;
  backgroundColor?: string;
  /** Overrides the theme ink the themed raster animations are recolored to. */
  foregroundColor?: string;
  /** Paints no backdrop of its own; the artwork floats on the surface behind. */
  transparent?: boolean;
}) {
  const { isDark, colors } = useTheme();
  const resolvedBackground = backgroundColor ?? colors.background;
  const resolvedForeground = foregroundColor ?? colors.ink;
  const reduced = useReducedMotion();
  const oneShot =
    name === 'sad' ||
    name === 'access-granted' ||
    name === 'access-denied' ||
    (name in animations && themedRasterAnimations.has(name as keyof typeof animations));
  const embedded =
    name in animations ? (animations[name as keyof typeof animations] as EmbeddedAnimation) : null;
  const forceThemedRaster =
    name in animations && themedRasterAnimations.has(name as keyof typeof animations);
  const fullColorRaster =
    name in animations && fullColorRasterAnimations.has(name as keyof typeof animations);

  useEffect(() => {
    if (!reduced || !onAnimationFinish) return;
    const timer = setTimeout(onAnimationFinish, 300);
    return () => clearTimeout(timer);
  }, [onAnimationFinish, reduced]);

  return (
    <View
      accessible={false}
      style={{
        width: '100%',
        height,
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: transparent ? undefined : resolvedBackground,
      }}
    >
      {name === 'sliders' && progress !== undefined ? (
        <SliderAnimation
          height={height}
          progress={progress}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
        />
      ) : name === 'crypto-cards' ? (
        // Photographic brand artwork: shown in full color with no backdrop,
        // like the full-color raster set, instead of theme-mapped monochrome.
        <RasterFrameAnimation
          height={height}
          frames={cryptoCardFrames}
          duration={7067}
          loop={false}
          reduced={reduced}
          onAnimationFinish={onAnimationFinish}
          backgroundColor={transparent ? undefined : resolvedBackground}
          foregroundColor={resolvedForeground}
          monochrome={false}
        />
      ) : name === 'first-screen' ? (
        <RasterFrameAnimation
          height={height}
          frames={trimmedFirstScreenFrames}
          duration={9870}
          loop
          reduced={reduced}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
        />
      ) : name === 'coins' ? (
        <RasterFrameAnimation
          height={height}
          frames={coinsFrames}
          duration={7600}
          loop={false}
          reduced={reduced}
          onAnimationFinish={onAnimationFinish}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
        />
      ) : name === 'grow' ? (
        <RasterFrameAnimation
          key={name}
          height={height}
          frames={growFrames}
          duration={5160}
          loop={loop ?? true}
          reduced={reduced}
          onAnimationFinish={onAnimationFinish}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
          widthRatio={1}
        />
      ) : name === 'stocks' ? (
        <RasterFrameAnimation
          height={height}
          frames={trimmedStocksFrames}
          duration={8942}
          loop={loop ?? true}
          reduced={reduced}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
          widthRatio={1}
        />
      ) : name === 'wait' ? (
        <RasterFrameAnimation
          key={name}
          height={height}
          frames={trimmedWaitFrames}
          duration={4760}
          loop={loop ?? true}
          reduced={reduced}
          onAnimationFinish={onAnimationFinish}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
          widthRatio={84 / 52}
          scale={2}
        />
      ) : fullColorRaster ? (
        <RasterFrameAnimation
          key={name}
          height={height}
          frames={embeddedFrames(embedded!)}
          duration={((embedded!.op - embedded!.ip) / embedded!.fr) * 1000}
          loop={loop ?? (progress === undefined && !oneShot)}
          progress={progress}
          reduced={reduced}
          onAnimationFinish={onAnimationFinish}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
          widthRatio={embedded!.w / embedded!.h}
          monochrome={false}
        />
      ) : isDark && !forceThemedRaster && name !== 'privacy' && name !== 'spare' ? (
        <LottieView
          key={name}
          source={animations[name as keyof typeof animations]}
          autoPlay={progress === undefined && !reduced}
          loop={loop ?? (progress === undefined && !oneShot)}
          progress={progress ?? (reduced ? 0.5 : undefined)}
          onAnimationFinish={reduced ? undefined : onAnimationFinish}
          resizeMode="contain"
          renderMode="AUTOMATIC"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <RasterFrameAnimation
          key={name}
          height={height}
          frames={embeddedFrames(embedded!)}
          duration={((embedded!.op - embedded!.ip) / embedded!.fr) * 1000}
          loop={loop ?? (progress === undefined && !oneShot)}
          progress={progress}
          reduced={reduced}
          onAnimationFinish={onAnimationFinish}
          backgroundColor={resolvedBackground}
          foregroundColor={resolvedForeground}
          widthRatio={embedded!.w / embedded!.h}
        />
      )}
    </View>
  );
}
