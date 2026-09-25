import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';
import type Animated from 'react-native-reanimated';

type AnimatedViewProps = React.ComponentProps<typeof Animated.View>;
export type EnteringAnimation = AnimatedViewProps['entering'];
export type ExitingAnimation = AnimatedViewProps['exiting'];
export type AnimationDirection = 'up' | 'down';
export type AnimationPreset = 'custom' | 'fade' | 'zoom';

export interface AnimationConfig {
  entering: EnteringAnimation;
  exiting: ExitingAnimation;
}

export interface DotConfig {
  visible: boolean;
  size: number;
  color: ColorValue;
  style?: ViewStyle;
}

export interface TextConfig {
  readonly style?: TextStyle;
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  color: ColorValue;
}

export interface TimingConfig {
  interval: number;
  animationDuration: number;
}

export interface DynamicTextItem {
  text: string;
  readonly id?: string;
}

export interface DynamicTextProps {
  items: readonly DynamicTextItem[] | readonly string[];
  readonly loop?: boolean;
  readonly loopCount?: number;
  readonly animationPreset?: AnimationPreset;
  readonly animationDirection?: AnimationDirection;
  readonly customEntering?: EnteringAnimation;
  readonly customExiting?: ExitingAnimation;
  readonly timing?: Partial<TimingConfig>;
  readonly text?: Partial<TextConfig>;
  readonly dot?: Partial<DotConfig>;
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly onAnimationComplete?: () => void;
  readonly onIndexChange?: (index: number, item: DynamicTextItem) => void;
  readonly paused?: boolean;
  readonly initialIndex?: number;
  readonly accessibilityLabel?: string;
}
