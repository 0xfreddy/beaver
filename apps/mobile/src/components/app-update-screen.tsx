import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppUpdatePolicy } from '@roundups/types';
import { useTheme } from '../theme';
import { OnboardingAnimation } from './onboarding-animation';
import { Button, TextButton, Type } from './ui';

function UpdateArtwork() {
  return (
    <View
      style={styles.artwork}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <OnboardingAnimation name="update" height={192} loop />
    </View>
  );
}

export type AppUpdateScreenProps = {
  policy: Extract<AppUpdatePolicy, { enabled: true }>;
  mode: 'required' | 'recommended';
  installedBuild: string | null;
  checking: boolean;
  checkFailed: boolean;
  onCheck: () => void;
  onDismiss: () => void;
};
export function AppUpdateScreen({ policy, mode, checkFailed, onDismiss }: AppUpdateScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const largeText = useWindowDimensions().fontScale > 1.5;
  const [linkError, setLinkError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const required = mode === 'required';
  async function openLink(url: string) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(
        'Couldn’t open TestFlight. Open the TestFlight app and select Beaver to update.',
      );
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
      onAccessibilityEscape={required ? undefined : onDismiss}
    >
      <Type variant="headline">Beaver</Type>
      <View style={styles.hero}>
        {!largeText ? <UpdateArtwork /> : null}
        <View style={{ gap: 16 }}>
          <Type variant={largeText ? 'headline' : 'title'} accessibilityRole="header">
            Beaver has a new version
          </Type>
          <Type muted style={{ maxWidth: 340 }}>
            {required
              ? 'Install the latest version from TestFlight, then come back here.'
              : 'Get the latest improvements in TestFlight. You can also keep using this version for now.'}
          </Type>
        </View>
      </View>
      <View style={styles.actions}>
        {linkError ? <Type accessibilityRole="alert">{linkError}</Type> : null}
        {checkFailed ? (
          <Type accessibilityRole="alert" muted>
            We couldn’t check for updates. We’ll check again when you return to Beaver.
          </Type>
        ) : null}
        <Button
          title="Update in TestFlight"
          appearance="raised"
          loading={opening}
          onPress={() => void openLink(policy.updateUrl)}
        />
        {!required ? <TextButton title="Not now" onPress={onDismiss} /> : null}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 24 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24, gap: 24 },
  artwork: { height: 192, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 4 },
});
