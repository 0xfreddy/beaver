import { Easing } from 'react-native-reanimated';

export const DEFAULT_SWEEP_COLORS = [
  '#C679C4',
  '#FA3D1D',
  '#FFB005',
  '#E1E1FE',
  '#0358F7',
] as const;
export const DEFAULT_BASE_COLOR = '#111111';
export const DEFAULT_DURATION = 1500;
export const DEFAULT_DELAY = 0;
export const DEFAULT_LOOP_DELAY = 500;
export const DEFAULT_BAND_RATIO = 0.34;
export const SWEEP_EASING = Easing.inOut(Easing.cubic);
export const SWAP_EASING = Easing.bezier(0.22, 1, 0.36, 1);
export const EXIT_DURATION = 260;
export const ENTER_DURATION = 380;
export const SWAP_SHIFT = 12;
