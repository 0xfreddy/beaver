import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from './app-symbol';
import { OnboardingAnimation, type AnimationName } from './onboarding-animation';
import { Type } from './ui';
import { useLive, type InvestmentPolicy } from '../lib/live';
import { nextRoundupMilestoneCents } from '../lib/roundup-milestone';
import { radius, useTheme } from '../theme';

/* eslint-disable @typescript-eslint/no-require-imports -- Static bundled artwork. */
const chooseWhen: ImageSourcePropType = require('../../assets/illustrations/everyday-change-transparent.png');
const chooseWhat: ImageSourcePropType = require('../../assets/illustrations/wallet-token.png');
const startRoundups: ImageSourcePropType = require('../../assets/illustrations/activity-receipt.png');
/* eslint-enable @typescript-eslint/no-require-imports */

type Banner = {
  id: string;
  title: string;
  body: string;
  art?: ImageSourcePropType;
  animation?: AnimationName;
  href: Href;
};

const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function HomeBanners({ totalRoundupCents }: { totalRoundupCents: number }) {
  const { colors, isDark } = useTheme();
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  if (policy.isPending || policy.error || !policy.data) return null;

  const setupComplete =
    policy.data.roundupRuleConfigured === true && policy.data.fallbackConfigured === true;
  const milestone = wholeDollars.format(nextRoundupMilestoneCents(totalRoundupCents) / 100);
  const banners: Banner[] = setupComplete
    ? [
        {
          id: 'invite',
          title: 'Invite your friends',
          body: 'Beaver is better with friends.',
          // The same greeting animation that welcomes you on the invite screen.
          animation: 'access-granted',
          href: '/invite-friends',
        },
        {
          id: 'start-roundups',
          title: 'Start your Roundups',
          body: `Keep it up to reach ${milestone} of roundups.`,
          art: startRoundups,
          href: '/activity',
        },
      ]
    : [
        {
          id: 'choose-when',
          title: 'Choose when',
          body: 'Start your Roundup',
          art: chooseWhen,
          href: '/settings/rules',
        },
        {
          id: 'choose-what',
          title: 'Choose what',
          body: 'Pick your stock',
          art: chooseWhat,
          href: '/settings/fallback',
        },
      ];

  return (
    <ScrollView
      horizontal
      style={styles.bleed}
      contentContainerStyle={styles.track}
      snapToInterval={260}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={setupComplete ? 'Roundup actions' : 'Finish setting up your roundups'}
    >
      {banners.map((banner) => (
        <Pressable
          key={banner.id}
          accessibilityRole="button"
          accessibilityLabel={`${banner.title}. ${banner.body}`}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            router.push(banner.href);
          }}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              opacity: pressed ? 0.72 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          {banner.animation ? (
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.art, styles.artAnimation, { opacity: isDark ? 0.3 : 0.22 }]}
            >
              <OnboardingAnimation
                name={banner.animation}
                height={144}
                loop
                backgroundColor={colors.surface}
              />
            </View>
          ) : (
            <Image
              source={banner.art}
              resizeMode="contain"
              accessible={false}
              style={[styles.art, { opacity: isDark ? 0.22 : 0.14 }]}
            />
          )}
          <View style={styles.copy}>
            <Type style={styles.title}>{banner.title}</Type>
            <Type muted style={styles.body}>
              {banner.body}
            </Type>
          </View>
          <View style={[styles.arrow, { backgroundColor: colors.soft }]}>
            <AppSymbol name="next" size={16} color={colors.ink} />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -24 },
  track: { gap: 12, paddingHorizontal: 24 },
  card: {
    width: 248,
    minHeight: 148,
    padding: 18,
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  art: { position: 'absolute', width: 144, height: 144, right: -30, bottom: -34 },
  // The greeting animation fills its whole frame, so clip it to the same watermark slot.
  artAnimation: { overflow: 'hidden' },
  copy: { maxWidth: 184, gap: 5 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '600', letterSpacing: -0.45 },
  body: { fontSize: 14, lineHeight: 19, maxWidth: 166 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
