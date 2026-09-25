import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { Screen, Type } from '../../components/ui';
import {
  cryptoCardGuideProviders,
  cryptoCardGuideVideos,
  parseCryptoCardGuideProvider,
  type CryptoCardGuideProvider,
} from '../../lib/crypto-card-guides';
import { useTheme } from '../../theme';
import { cryptoCardBrandLogos } from '../../lib/onboarding-brand-assets';
import { AppSymbol } from '../../components/app-symbol';
import * as Haptics from 'expo-haptics';

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
      style={[styles.videoFrame, { backgroundColor: colors.surface, borderColor: colors.line }]}
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

export default function CryptoCardHelp() {
  const params = useLocalSearchParams<{ provider?: string | string[] }>();
  const initialProvider = parseCryptoCardGuideProvider(params.provider);
  const [provider, setProvider] = useState<CryptoCardGuideProvider | null>(null);

  const selectProvider = (next: CryptoCardGuideProvider) => {
    setProvider((current) => (current === next ? null : next));
    void Haptics.selectionAsync().catch(() => {});
  };

  return (
    <>
      <Stack.Screen
        options={{
          sheetAllowedDetents: provider ? [1] : [0.48, 1],
          sheetInitialDetentIndex: provider ? 0 : 0,
        }}
      />
      <Screen compact title="How do I get it?">
        <View style={styles.accordion}>
          {cryptoCardGuideProviders.map((item, index) => {
            const expanded = provider === item;
            const source = cryptoCardGuideVideos[item];
            return (
              <View key={item}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityHint={source ? 'Shows the setup video' : 'Shows guide availability'}
                  onPress={() => selectProvider(item)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.divider,
                    (item === initialProvider || expanded) && styles.preferredRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Image source={cryptoCardBrandLogos[item]} style={styles.logo} />
                  <Type style={styles.providerName}>{item}</Type>
                  <AppSymbol name={expanded ? 'chevronDown' : 'next'} color="#8E8E93" size={17} />
                </Pressable>
                {expanded ? (
                  <View style={styles.expandedContent}>
                    {source ? (
                      <GuideVideo provider={item} source={source} />
                    ) : (
                      <View style={styles.unavailable}>
                        <Type variant="headline">Video guide coming soon</Type>
                        <Type muted>
                          A matching {item} recording has not been added to this build yet.
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
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  accordion: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A3A3C',
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
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A3A3C' },
  preferredRow: { backgroundColor: 'rgba(128,128,128,0.08)' },
  pressed: { backgroundColor: 'rgba(128,128,128,0.14)' },
  logo: { width: 34, height: 34, borderRadius: 17 },
  providerName: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  expandedContent: { padding: 0 },
  unavailable: { minHeight: 150, justifyContent: 'center', gap: 8, padding: 18 },
  videoFrame: {
    width: '100%',
    aspectRatio: 9 / 16,
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: 0,
  },
  footnote: { gap: 8, paddingTop: 20 },
  video: {
    width: '100%',
    height: '100%',
  },
});
