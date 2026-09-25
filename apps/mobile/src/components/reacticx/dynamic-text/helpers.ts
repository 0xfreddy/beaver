import {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import type {
  AnimationConfig,
  AnimationDirection,
  AnimationPreset,
  DynamicTextItem,
} from './types';

export function getAnimationPreset(
  preset: AnimationPreset,
  direction: AnimationDirection,
  duration: number,
): AnimationConfig {
  const presets: Record<AnimationPreset, Record<AnimationDirection, AnimationConfig>> = {
    fade: {
      up: {
        entering: FadeInDown.duration(duration).springify().damping(25),
        exiting: FadeOutUp.duration(duration),
      },
      down: {
        entering: FadeInUp.duration(duration).springify().damping(25),
        exiting: FadeOutDown.duration(duration),
      },
    },
    zoom: {
      up: {
        entering: ZoomIn.duration(duration).springify().damping(20),
        exiting: ZoomOut.duration(duration),
      },
      down: {
        entering: ZoomIn.duration(duration).springify().damping(20),
        exiting: ZoomOut.duration(duration),
      },
    },
    custom: {
      up: {
        entering: FadeInDown.duration(duration),
        exiting: FadeOutUp.duration(duration),
      },
      down: {
        entering: FadeInUp.duration(duration),
        exiting: FadeOutDown.duration(duration),
      },
    },
  };

  return presets[preset][direction];
}

export function normalizeItems(
  items: readonly DynamicTextItem[] | readonly string[],
): DynamicTextItem[] {
  return items.map((item, index) =>
    typeof item === 'string'
      ? { text: item, id: `item-${index}` }
      : { ...item, id: item.id ?? `item-${index}` },
  );
}
