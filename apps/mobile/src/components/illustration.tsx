import { View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { InteractiveArt } from './interactive-art';
import { useTheme } from '../theme';

/* eslint-disable @typescript-eslint/no-require-imports */
const artwork: Record<'orbit' | 'everyday' | 'choice', ImageSourcePropType> = {
  orbit: require('../../assets/illustrations/roundup-orbit.png'),
  everyday: require('../../assets/illustrations/everyday-change.png'),
  choice: require('../../assets/illustrations/your-choice.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Original artwork lives on a black gallery surface in both appearances. */
export function Illustration({
  name,
  height = 300,
}: {
  name: keyof typeof artwork;
  height?: number;
}) {
  const { isDark, colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View
      accessible={false}
      style={{
        height,
        width: '100%',
        backgroundColor: '#000000',
        borderRadius: isDark ? 0 : 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: isDark ? 0 : 1,
        borderColor: colors.line,
      }}
    >
      <Animated.View
        key={name}
        entering={reduced ? FadeIn.duration(120) : FadeInUp.duration(280)}
        style={{ flex: 1 }}
      >
        <InteractiveArt
          source={artwork[name]}
          name={
            { orbit: 'roundup orbit', everyday: 'everyday change', choice: 'your choice' }[name]
          }
          size={height}
        />
      </Animated.View>
    </View>
  );
}
