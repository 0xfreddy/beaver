import type { DotConfig, TextConfig, TimingConfig } from './types';

export const DEFAULT_TIMING: TimingConfig = {
  interval: 300,
  animationDuration: 200,
} as const;

export const DEFAULT_DOT: DotConfig = {
  visible: true,
  size: 8,
  color: '#FFFFFFFF',
} as const;

export const DEFAULT_TEXT: TextConfig = {
  fontSize: 24,
  fontWeight: '500',
  color: '#FFFFFFFF',
} as const;
