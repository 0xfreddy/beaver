import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type DiaTextProps = {
  readonly text: string | readonly string[];
  readonly sweepColors?: readonly string[];
  readonly baseColor?: string;
  readonly duration?: number;
  readonly delay?: number;
  readonly loop?: boolean;
  readonly loopDelay?: number;
  readonly bandRatio?: number;
  readonly autoPlay?: boolean;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
  readonly onSweepEnd?: (index: number) => void;
};

export type DiaGradient = {
  readonly colors: string[];
  readonly locations: number[];
};
