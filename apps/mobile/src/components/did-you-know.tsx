import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import { radius, useTheme } from '../theme';

const STORAGE_KEY = 'roundups.did-you-know.dismissed:v1';

/* eslint-disable @typescript-eslint/no-require-imports -- Static bundled artwork. */
const facts = [
  {
    id: 'dollar-a-day',
    art: require('../../assets/illustrations/everyday-change.png'),
    title: '$1 a day adds up',
    body: 'Set aside $1 a day for 365 days and you’ll save $365, before any investment gains or losses.',
  },
  {
    id: 'thirty-monthly',
    art: require('../../assets/illustrations/roundup-orbit.png'),
    title: '$30 becomes $1,800',
    body: 'Example: $30 a month for five years adds up to $1,800 in contributions. Investment returns vary.',
  },
  {
    id: 'small-roundups',
    art: require('../../assets/illustrations/wallet-token.png'),
    title: 'Small change, real progress',
    body: 'Example: twenty 50¢ roundups set aside $10. Your total depends on your purchases and rule.',
  },
] as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export function DidYouKnowCards() {
  const { colors, isDark } = useTheme();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const ids = JSON.parse(raw);
        if (Array.isArray(ids))
          setDismissed(new Set(ids.filter((id): id is string => typeof id === 'string')));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function dismiss(id: string) {
    void Haptics.selectionAsync().catch(() => {});
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {
      // Tips reappear next launch if the preference cannot be stored.
    });
  }

  const visible = facts.filter((fact) => !dismissed.has(fact.id));
  if (!loaded || visible.length === 0) return null;
  return (
    <ScrollView
      horizontal
      style={{ marginHorizontal: -24 }}
      snapToInterval={244}
      decelerationRate="fast"
      accessibilityLabel="Did you know"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
    >
      {visible.map((fact) => (
        <View
          key={fact.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          <Image
            source={fact.art}
            accessible={false}
            resizeMode="contain"
            style={{
              position: 'absolute',
              width: 150,
              height: 150,
              right: -35,
              bottom: -35,
              opacity: isDark ? 0.16 : 0.1,
            }}
          />
          <View style={styles.heading}>
            <Type style={styles.title}>{fact.title}</Type>
            <Pressable
              accessibilityLabel={`Remove tip: ${fact.title}`}
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => dismiss(fact.id)}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <AppSymbol name="close" size={13} color={colors.muted} />
            </Pressable>
          </View>
          <Type variant="caption" muted style={styles.body}>
            {fact.body}
          </Type>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { gap: 12, paddingHorizontal: 24 },
  card: {
    width: 232,
    gap: 2,
    padding: 14,
    paddingTop: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  close: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  closePressed: { opacity: 0.5 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.3, flex: 1 },
  body: { lineHeight: 18 },
});
