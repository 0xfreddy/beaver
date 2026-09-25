import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { Tray } from './reacticx/tray';
import { AppSymbol } from './app-symbol';
import { Type } from './ui';
import {
  cryptoCardGuideProviders,
  cryptoCardGuideVideos,
  type CryptoCardGuideProvider,
} from '../lib/crypto-card-guides';
import { cryptoCardBrandLogos } from '../lib/onboarding-brand-assets';
import { useTheme } from '../theme';

function GuideVideo({
  provider,
  source,
}: {
  provider: CryptoCardGuideProvider;
  source: VideoSource;
}) {
  const { colors } = useTheme();
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return (
    <View
      style={[styles.videoFrame, { backgroundColor: colors.background, borderColor: colors.line }]}
    >
      <VideoView
        accessibilityLabel={`${provider} card guide video`}
        player={player}
        nativeControls
        contentFit="cover"
        allowsVideoFrameAnalysis={false}
        style={styles.video}
      />
    </View>
  );
}

export function CryptoCardGuideTray({
  visible,
  initialProvider,
  onClose,
}: {
  visible: boolean;
  initialProvider: CryptoCardGuideProvider;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<CryptoCardGuideProvider | null>(null);

  useEffect(() => {
    if (!visible) setExpanded(null);
  }, [visible]);

  return (
    <Tray visible={visible} title="How do I get it?" onClose={onClose}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.accordion, { borderColor: colors.line }]}>
          {cryptoCardGuideProviders.map((provider, index) => {
            const open = expanded === provider;
            const source = cryptoCardGuideVideos[provider];
            return (
              <View key={provider}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => {
                    setExpanded(open ? null : provider);
                    void Haptics.selectionAsync().catch(() => {});
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.line,
                    },
                    (provider === initialProvider || open) && { backgroundColor: colors.soft },
                    pressed && { opacity: 0.62 },
                  ]}
                >
                  <Image source={cryptoCardBrandLogos[provider]} style={styles.logo} />
                  <Type style={styles.name}>{provider}</Type>
                  <AppSymbol name={open ? 'chevronDown' : 'next'} color={colors.muted} size={17} />
                </Pressable>
                {open ? (
                  <View style={styles.expanded}>
                    {source ? (
                      <GuideVideo provider={provider} source={source} />
                    ) : (
                      <View style={styles.unavailable}>
                        <Type variant="headline">Video guide coming soon</Type>
                        <Type muted>
                          A matching {provider} recording has not been added to this build yet.
                        </Type>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.footnote}>
          <Type variant="headline">Use the address you spend from</Type>
          <Type muted>
            Copy your address on the chain and in the asset (USDC or USDT) where you normally
            deposit. Beaver reads outgoing stablecoin purchases — an address that only receives
            deposits shows no purchases.
          </Type>
        </View>
      </ScrollView>
    </Tray>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 700 },
  accordion: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  logo: { width: 34, height: 34, borderRadius: 17 },
  name: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  expanded: { padding: 0 },
  footnote: { gap: 8, paddingTop: 20, paddingBottom: 8 },
  unavailable: { minHeight: 136, justifyContent: 'center', gap: 8, padding: 16 },
  videoFrame: {
    width: '100%',
    aspectRatio: 9 / 16,
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: 0,
  },
  video: { width: '100%', height: '100%' },
});
