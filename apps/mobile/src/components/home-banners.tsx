import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import { useLive, type InvestmentPolicy } from '../lib/live';
import { homeSetupCards, monthlyRange, type MonthlyRoundups } from '../lib/home-setup-cards';
import { radius, useTheme } from '../theme';

/* eslint-disable @typescript-eslint/no-require-imports -- Static bundled artwork. */
const chooseWhen: ImageSourcePropType = require('../../assets/illustrations/everyday-change-transparent.png');
const chooseWhat: ImageSourcePropType = require('../../assets/illustrations/wallet-token.png');
const favouriteStock: ImageSourcePropType = require('../../assets/illustrations/favourite-stock.png');
const monthlyRoundups: ImageSourcePropType = require('../../assets/illustrations/monthly-roundups.png');
/* eslint-enable @typescript-eslint/no-require-imports */

export function HomeBanners(_props: { totalRoundupCents: number }) {
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const range = monthlyRange();
  const stats = useLive<MonthlyRoundups>(
    `/v1/roundups/monthly?${new URLSearchParams(range)}`,
    !!policy.data,
  );
  if (policy.isPending || policy.error || !policy.data) return null;
  return <HomeSetupCards policy={policy.data} stats={stats.data} failed={!!stats.error} />;
}

export function HomeSetupCards({
  policy,
  stats,
  failed,
}: {
  policy: InvestmentPolicy;
  stats?: MonthlyRoundups;
  failed?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const banners = homeSetupCards(policy, stats, failed);
  return (
    <ScrollView
      horizontal
      style={styles.bleed}
      contentContainerStyle={styles.track}
      snapToInterval={260}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Your roundup progress"
    >
      {banners.map((banner) => (
        <Pressable
          key={banner.id}
          accessibilityRole="button"
          accessibilityLabel={`${banner.title}. ${banner.body}`}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            router.push(banner.href as Href);
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
          <Image
            source={
              banner.id === 'rule'
                ? policy.roundupRuleConfigured
                  ? monthlyRoundups
                  : chooseWhen
                : banner.id === 'favourite'
                  ? favouriteStock
                  : chooseWhat
            }
            resizeMode="contain"
            accessible={false}
            style={[styles.art, { opacity: isDark ? 0.22 : 0.14 }]}
          />
          <View style={styles.copy}>
            <Type style={styles.title}>{banner.title}</Type>
            <Type muted style={styles.body}>
              {banner.body}
            </Type>
          </View>
          <View style={[styles.arrow, { backgroundColor: colors.soft }]}>
            <Type variant="caption">{banner.action}</Type>
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
  copy: { maxWidth: 184, gap: 5 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '600', letterSpacing: -0.45 },
  body: { fontSize: 14, lineHeight: 19, maxWidth: 166 },
  arrow: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
