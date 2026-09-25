import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type } from './ui';
import { useTheme } from '../theme';
import { FadeText } from './reacticx/fade-text';

/** One-purpose setup pages retain native stack navigation and scroll at large text sizes. */
export function SetupPage({
  title,
  description,
  children,
  actions,
  artwork,
  keyboard = false,
  topPadding,
  contentStyle,
  titleStyle,
  titleDelay,
  includeTopSafeArea = true,
}: PropsWithChildren<{
  title: string;
  description?: ReactNode;
  actions: ReactNode;
  artwork?: ReactNode;
  keyboard?: boolean;
  topPadding?: number;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  /** Milliseconds before the title starts fading in; body copy is unaffected. */
  titleDelay?: number;
  /** Full-screen setup pages need the status-bar inset; native sheets already provide it. */
  includeTopSafeArea?: boolean;
}>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const actionsView = (
    <View
      style={{
        gap: 12,
        paddingHorizontal: fontScale > 1.3 ? 0 : 28,
        paddingTop: 16,
        paddingBottom: Math.max(insets.bottom, 20),
        maxWidth: 520,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      {actions}
    </View>
  );
  return (
    <KeyboardAvoidingView
      enabled={keyboard}
      behavior={keyboard && Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 28,
          paddingTop: (includeTopSafeArea ? insets.top : 0) + (topPadding ?? 24),
          paddingBottom: 24,
          maxWidth: 520,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {artwork ? <View style={{ marginBottom: 24 }}>{artwork}</View> : null}
        {title || description ? (
          <View style={{ gap: 20, marginBottom: 28 }}>
            <FadeText
              text={title}
              centered={!!artwork}
              startDelay={titleDelay}
              style={[
                artwork ? { fontSize: 28, lineHeight: 34, textAlign: 'center' } : undefined,
                titleStyle,
              ]}
            />
            {description ? (
              typeof description === 'string' ? (
                <Type
                  muted
                  style={{ fontSize: 17, lineHeight: 25, textAlign: artwork ? 'center' : 'left' }}
                >
                  {description}
                </Type>
              ) : (
                description
              )
            ) : null}
          </View>
        ) : null}
        <View style={[{ gap: 24 }, contentStyle]}>{children}</View>
        {fontScale > 1.3 ? actionsView : null}
      </ScrollView>
      {fontScale <= 1.3 ? actionsView : null}
    </KeyboardAvoidingView>
  );
}
