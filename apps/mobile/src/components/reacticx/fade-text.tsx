import { useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useAnimatedProps,
  interpolate,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Type } from '../ui';
import { DiaText } from './dia-text';
import { useTheme } from '../../theme';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type FadeTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  centered?: boolean;
  highlights?: readonly string[];
  heading?: boolean;
  blur?: boolean;
  /** Milliseconds to wait before the first word appears. */
  startDelay?: number;
};

function FadeWord({
  word,
  index,
  style,
  highlight = false,
  blur = false,
  startDelay = 0,
}: {
  word: string;
  highlight?: boolean;
  blur?: boolean;
  index: number;
  startDelay?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        startDelay + Math.min(index, 8) * (blur ? 180 : 55),
        withTiming(1, { duration: blur ? 800 : 260, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
      ),
    );
  }, [blur, index, progress, startDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 7 }, { scale: 0.98 + progress.get() * 0.02 }],
  }));

  const blurProps = useAnimatedProps(() => ({
    intensity: interpolate(progress.get(), [0, 0.3, 1], [30, 20, 0]),
  }));
  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.3, 1], [1, 1, 0]),
  }));
  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={animatedStyle}
    >
      {highlight ? (
        <DiaText
          baseColor={colors.muted}
          text={word + ' '}
          textStyle={style}
          delay={startDelay + index * (blur ? 180 : 55) + (blur ? 800 : 260)}
        />
      ) : (
        <Type variant="story" style={style}>
          {word}{' '}
        </Type>
      )}
      {blur && Platform.OS === 'ios' ? (
        <AnimatedBlurView
          pointerEvents="none"
          tint="default"
          animatedProps={blurProps}
          style={[StyleSheet.absoluteFill, blurStyle]}
        />
      ) : null}
    </Animated.View>
  );
}

/** Reacticx FadeText adapted to retain one semantic VoiceOver heading. */
export function FadeText({
  text,
  style,
  containerStyle,
  centered = false,
  highlights = [],
  heading = true,
  blur = false,
  startDelay = 0,
}: FadeTextProps) {
  const reducedMotion = useReducedMotion();

  const { fontScale } = useWindowDimensions();
  if (reducedMotion || fontScale > 1.3) {
    return (
      <Type
        variant="story"
        accessibilityRole={heading ? 'header' : undefined}
        style={[centered && styles.centeredText, style]}
      >
        {text}
      </Type>
    );
  }

  const lines = text.split('\n');
  let wordIndex = -1;
  return (
    <View
      accessible
      accessibilityRole={heading ? 'header' : undefined}
      accessibilityLabel={text}
      style={[styles.column, centered && styles.centered, containerStyle]}
    >
      {lines.map((line, lineIndex) => (
        <View key={`line-${lineIndex}`} style={[styles.row, centered && styles.centeredRow]}>
          {line
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => {
              wordIndex += 1;
              return (
                <FadeWord
                  key={`${lineIndex}-${word}-${wordIndex}`}
                  word={word}
                  index={wordIndex}
                  blur={blur}
                  startDelay={startDelay}
                  style={style}
                  highlight={highlights.includes(word.replace(/[.,!?]/g, ''))}
                />
              );
            })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {},
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  centered: { width: '100%', alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' },
  centeredRow: { width: '100%', justifyContent: 'center' },
  centeredText: { textAlign: 'center' },
});
