import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Type } from './ui';
import { DiaText } from './reacticx/dia-text';
import { RadiantButton } from './reacticx/radiant-button';
import { OnboardingAnimation } from './onboarding-animation';
import { useTheme } from '../theme';

/* eslint-disable @typescript-eslint/no-require-imports */
const wallet: ImageSourcePropType = require('../../assets/illustrations/wallet-token.png');
const receipt: ImageSourcePropType = require('../../assets/illustrations/activity-receipt.png');
/* eslint-enable @typescript-eslint/no-require-imports */

const RADIANT_THEME = {
  background: '#FFFFFF',
  backgroundSubtle: '#F2F2F2',
  foreground: '#111111',
  highlight: '#E37E19',
} as const;

function CardArt({ source, size = 64 }: { source: ImageSourcePropType; size?: number }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      style={{ width: size, height: size }}
    />
  );
}
function BalanceCardContent({
  availableUsdc,
  isDark,
  celebrating,
  onCelebrationEnd,
  surface,
}: {
  availableUsdc: string | null;
  isDark: boolean;
  celebrating: boolean;
  onCelebrationEnd: () => void;
  surface: string;
}) {
  return (
    <>
      {celebrating ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.celebrationArt}
        >
          <OnboardingAnimation
            name="funding-thumbs-up"
            height={124}
            loop={false}
            backgroundColor={surface}
            onAnimationFinish={onCelebrationEnd}
          />
        </View>
      ) : (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.backgroundArt, { opacity: isDark ? 0.3 : 0.2 }]}
        >
          <CardArt source={wallet} size={152} />
        </View>
      )}
      <View style={styles.balanceCopy}>
        <Type variant="caption" muted>
          USDC balance
        </Type>
        <Type variant="title" style={styles.balanceValue}>
          {availableUsdc ?? '—'}
        </Type>
      </View>
    </>
  );
}

export function OverviewCards({
  purchaseCount,
  live,
}: {
  purchaseCount?: number;
  live: { availableUsdc: string | null; isZeroBalance: boolean };
}) {
  const { colors, isDark } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 370 || fontScale > 1.2;
  const columnWidth = (Math.min(width, 600) - 60) / 2;
  const face = { backgroundColor: colors.surface, borderColor: colors.line };
  const hasActivity = purchaseCount == null || purchaseCount > 0;
  const disabledActivityFace = {
    backgroundColor: isDark ? '#0D0D0D' : '#E3E3E3',
    borderColor: isDark ? '#202020' : '#D3D3D3',
  };
  const balanceWidth = stacked ? '100%' : columnWidth;
  const balanceAccessibilityLabel = `Available USDC, ${live.availableUsdc ?? 'unavailable'}. View funding.`;
  // Funding moves the card from the zero-balance state to a real balance; celebrate
  // that transition once, then fall back to the wallet artwork.
  const wasZeroBalance = useRef(live.isZeroBalance);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (wasZeroBalance.current && !live.isZeroBalance) setCelebrating(true);
    wasZeroBalance.current = live.isZeroBalance;
  }, [live.isZeroBalance]);
  // Stable across re-renders so a mid-animation data refresh cannot restart the frames.
  const endCelebration = useCallback(() => setCelebrating(false), []);
  return (
    <View>
      <View
        key={stacked ? 'stacked' : 'columns'}
        style={{ flexDirection: stacked ? 'column' : 'row', gap: 12 }}
      >
        {live.isZeroBalance ? (
          <RadiantButton
            accessibilityLabel={balanceAccessibilityLabel}
            onPress={() => router.push('/funding')}
            style={[styles.radiantBalanceCard, { width: balanceWidth }]}
            contentStyle={styles.radiantBalanceContent}
            borderRadius={24}
            paddingHorizontal={20}
            paddingVertical={0}
            theme={{
              ...RADIANT_THEME,
              background: colors.surface,
              backgroundSubtle: colors.surface,
            }}
            showDots={false}
            showShimmer={false}
            showGlow={false}
            breathingEnabled={false}
          >
            <BalanceCardContent
              availableUsdc={live.availableUsdc}
              isDark={isDark}
              celebrating={celebrating}
              onCelebrationEnd={endCelebration}
              surface={colors.surface}
            />
          </RadiantButton>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={balanceAccessibilityLabel}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              router.push('/funding');
            }}
            style={({ pressed }) => [
              styles.card,
              styles.balanceCard,
              face,
              { width: balanceWidth, minWidth: 0, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <BalanceCardContent
              availableUsdc={live.availableUsdc}
              isDark={isDark}
              celebrating={celebrating}
              onCelebrationEnd={endCelebration}
              surface={colors.surface}
            />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasActivity ? 'View activity' : 'First transaction reward: $5 automatic deposit.'
          }
          disabled={!hasActivity}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            router.push('/activity');
          }}
          style={({ pressed }) => [
            styles.card,
            styles.balanceCard,
            hasActivity ? face : disabledActivityFace,
            {
              width: stacked ? '100%' : columnWidth,
              paddingHorizontal: 20,
              minWidth: 0,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.backgroundArt, { opacity: isDark ? 0.3 : 0.2 }]}
          >
            <CardArt source={receipt} size={152} />
          </View>
          <View style={styles.balanceCopy}>
            <Type
              variant="caption"
              muted
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {hasActivity ? 'Purchases' : 'With your first transaction'}
            </Type>
            {hasActivity ? (
              <Type variant="title" style={{ fontSize: 30, lineHeight: 36 }}>
                Activity
              </Type>
            ) : (
              <DiaText
                text="$5"
                baseColor={colors.ink}
                loop
                loopDelay={2400}
                style={styles.rewardValue}
                textStyle={styles.balanceValue}
              />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    gap: 20,
    minHeight: 208,
  },
  balanceCard: {
    minHeight: 156,
    paddingTop: 72,
    paddingBottom: 12,
    justifyContent: 'flex-end',
  },
  radiantBalanceCard: {
    minHeight: 156,
    minWidth: 0,
    overflow: 'hidden',
  },
  radiantBalanceContent: {
    position: 'relative',
    flex: 1,
    width: '100%',
    // The base RadiantButton content is a row; a column keeps the copy anchored to
    // the card bottom like the plain Pressable balance card.
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    paddingTop: 72,
    paddingBottom: 12,
  },
  balanceCopy: { gap: 4 },
  balanceValue: { fontSize: 30, lineHeight: 36, fontWeight: '500' },
  rewardValue: { alignItems: 'flex-end' },
  backgroundArt: {
    position: 'absolute',
    right: -32,
    top: -12,
  },
  celebrationArt: {
    position: 'absolute',
    top: -14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
