import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { scheduleOnRN } from 'react-native-worklets';
import { Type } from '../ui';
import { useTheme } from '../../theme';
import type { Institution } from '../../lib/institution-directory';
import { BankMark } from '../bank-mark';

const POPULAR_BANKS: Institution[] = [
  { id: 'popular-chase', name: 'Chase', avatar: null, avatarDark: null, logo: null },
  {
    id: 'popular-bank-of-america',
    name: 'Bank of America',
    avatar: null,
    avatarDark: null,
    logo: null,
  },
  {
    id: 'popular-wells-fargo',
    name: 'Wells Fargo',
    avatar: null,
    avatarDark: null,
    logo: null,
  },
  { id: 'popular-citi', name: 'Citi', avatar: null, avatarDark: null, logo: null },
  {
    id: 'popular-capital-one',
    name: 'Capital One',
    avatar: null,
    avatarDark: null,
    logo: null,
  },
  {
    id: 'popular-us-bank',
    name: 'U.S. Bank',
    avatar: null,
    avatarDark: null,
    logo: null,
  },
  { id: 'popular-pnc', name: 'PNC', avatar: null, avatarDark: null, logo: null },
  { id: 'popular-td-bank', name: 'TD Bank', avatar: null, avatarDark: null, logo: null },
  { id: 'popular-ally', name: 'Ally Bank', avatar: null, avatarDark: null, logo: null },
  {
    id: 'popular-discover',
    name: 'Discover',
    avatar: null,
    avatarDark: null,
    logo: null,
  },
];

function popularFirst(banks: Institution[]) {
  return POPULAR_BANKS.map(
    (popular) =>
      banks.find((bank) => bank.name.toLowerCase() === popular.name.toLowerCase()) ?? popular,
  ).slice(0, 10);
}

function BankItem({
  bank,
  index,
  width,
  offset,
}: {
  bank: Institution;
  index: number;
  width: number;
  offset: SharedValue<number>;
}) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    reveal.set(
      reducedMotion
        ? 1
        : withDelay(
            index * 70,
            withTiming(1, { duration: 360, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
          ),
    );
  }, [index, reducedMotion, reveal]);
  const style = useAnimatedStyle(() => {
    const distance = (offset.get() - index * width) / width;
    const itemScale = interpolate(
      Math.abs(distance),
      [0, 1, 2],
      [1.14, 0.9, 0.68],
      Extrapolation.CLAMP,
    );
    return {
      opacity:
        reveal.get() *
        interpolate(Math.abs(distance), [0, 1, 2], [1, 0.7, 0.35], Extrapolation.CLAMP),
      transform: [
        {
          translateY:
            interpolate(distance, [-2, 0, 2], [22, -8, 22], Extrapolation.CLAMP) +
            (1 - reveal.get()) * 18,
        },
        { scale: itemScale * (0.94 + reveal.get() * 0.06) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, { width }, style]}>
      <View
        accessible={false}
        style={[styles.logo, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <BankMark
          name={bank.name}
          uri={isDark ? (bank.avatarDark ?? bank.avatar ?? bank.logo) : (bank.avatar ?? bank.logo)}
          size={76}
        />
      </View>
    </Animated.View>
  );
}

/** Reacticx Circular List adapted for MoneyKit’s current institution catalogue. */
export const CircularBankList = memo(function CircularBankList({
  banks,
}: {
  banks: Institution[];
}) {
  const { width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const listRef = useRef<Animated.FlatList<Institution>>(null);
  const visibleBanks = useMemo(() => popularFirst(banks), [banks]);
  const itemWidth = Math.min(104, screenWidth / 3.5);
  const offset = useSharedValue(0);
  const selectedIndex = useSharedValue(0);
  const [selected, setSelected] = useState(0);
  const userScrolling = useRef(false);
  const updateSelected = useCallback((index: number) => {
    setSelected(index);
    if (userScrolling.current) void Haptics.selectionAsync().catch(() => {});
  }, []);
  const onScroll = useAnimatedScrollHandler((event) => {
    const next = Math.max(
      0,
      Math.min(visibleBanks.length - 1, Math.round(event.contentOffset.x / itemWidth)),
    );
    offset.set(event.contentOffset.x);
    if (next === selectedIndex.get()) return;
    selectedIndex.set(next);
    scheduleOnRN(updateSelected, next);
  });
  useEffect(() => {
    if (reducedMotion || visibleBanks.length < 2) return undefined;
    const timer = setInterval(() => {
      const next = (selectedIndex.get() + 1) % visibleBanks.length;
      selectedIndex.set(next);
      setSelected(next);
      listRef.current?.scrollToOffset({
        offset: next * itemWidth,
        animated: next !== 0,
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [itemWidth, reducedMotion, selectedIndex, visibleBanks.length]);

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        accessible
        accessibilityLabel={`Popular supported banks. ${visibleBanks[selected]?.name ?? 'Bank'} centered.`}
        horizontal
        data={visibleBanks}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: (screenWidth - itemWidth) / 2 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          userScrolling.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          const next = Math.max(
            0,
            Math.min(
              visibleBanks.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / itemWidth),
            ),
          );
          selectedIndex.set(next);
          setSelected(next);
          userScrolling.current = false;
        }}
        renderItem={({ item, index }) => (
          <BankItem bank={item} index={index} width={itemWidth} offset={offset} />
        )}
      />
      <Type variant="caption" muted style={styles.label}>
        {visibleBanks[selected]?.name}
      </Type>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { height: 146, marginHorizontal: -28 },
  item: { height: 108, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
  },
  logoImage: { width: '100%', height: '100%' },
  label: { textAlign: 'center', fontWeight: '600' },
});
