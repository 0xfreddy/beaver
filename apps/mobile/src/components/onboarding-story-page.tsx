import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppSymbol } from './app-symbol';
import { Button, TextButton, Type } from './ui';

type StoryFact = {
  icon: ReactNode;
  body: ReactNode;
};

export function OnboardingStoryPage({
  children,
  title = 'Did you know...',
  subtitle,
  facts,
  buttonTitle = 'Continue',
  onContinue,
}: PropsWithChildren<{
  title?: string;
  subtitle: string;
  facts: StoryFact[];
  buttonTitle?: string;
  onContinue: () => void;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.frame,
          {
            paddingTop: Math.max(insets.top + 24, 56),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {children}
          <View style={styles.copy}>
            <Type accessibilityRole="header" style={styles.title}>
              {title}
            </Type>
            <Type style={styles.subtitle}>{subtitle}</Type>
          </View>
          <View style={styles.facts}>
            {facts.map((fact, index) => (
              <View key={index} style={styles.fact}>
                <View style={styles.factIcon}>{fact.icon}</View>
                <Type muted style={styles.factText}>
                  {fact.body}
                </Type>
              </View>
            ))}
          </View>
        </ScrollView>
        <View pointerEvents="none" style={styles.fade} />
        <View style={styles.footer}>
          <Button appearance="onboarding" title={buttonTitle} onPress={onContinue} />
          <TextButton
            title="Back"
            onPress={() => {
              if (router.canGoBack()) router.back();
            }}
          />
        </View>
      </View>
    </View>
  );
}

export function Highlight({ children }: PropsWithChildren) {
  return <Type style={styles.highlight}>{children}</Type>;
}

export function StoryIcon({ name }: { name: Parameters<typeof AppSymbol>[0]['name'] }) {
  return <AppSymbol name={name} color="rgba(255,255,255,0.9)" size={18} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141212', alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 520, paddingHorizontal: 28 },
  scroll: { flex: 1 },
  content: { paddingTop: 0, paddingBottom: 20, gap: 22 },
  copy: { gap: 10 },
  title: {
    color: '#F7F6F4',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '400',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#F7F6F4',
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  facts: { gap: 16 },
  fact: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  factIcon: { width: 24, minHeight: 30, alignItems: 'center', paddingTop: 4 },
  factText: {
    flex: 1,
    color: '#A8A8A8',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '300',
    letterSpacing: -0.2,
  },
  highlight: {
    color: '#7CC4FF',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 106,
    height: 48,
    backgroundColor: 'transparent',
  },
  footer: { gap: 8, paddingTop: 6 },
});
