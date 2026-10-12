import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DynamicNotificationCard } from '../components/dynamic-notification-card';
import { useTheme } from '../theme';
import type { InAppNotice } from '../lib/dynamic-notification-events';
const samples: InAppNotice[] = [
  {
    id: 'sync',
    kind: 'sync',
    title: 'Getting your transactions…',
    message: 'You can keep using Beaver while we finish.',
    route: '/activity',
    sourceIds: [],
  },
  {
    id: 'bank',
    kind: 'bank',
    title: 'Your transactions are ready',
    message: 'Your purchases are ready to view.',
    route: '/activity',
    sourceIds: [],
  },
  {
    id: 'first',
    kind: 'first',
    title: 'Your first roundup is in 🎉',
    message: '0.35 USD bought AAPL.',
    route: '/portfolio',
    sourceIds: [],
  },
  {
    id: 'roundup',
    kind: 'roundup',
    title: 'Your roundups are in',
    message: '1.00 USD bought AAPL, SBUX.',
    route: '/portfolio',
    sourceIds: [],
  },
  {
    id: 'deposit',
    kind: 'deposit',
    title: 'Your 20 USDC has arrived',
    message: 'Your money is now in your Beaver wallet.',
    route: '/funding',
    sourceIds: [],
  },
  {
    id: 'milestone',
    kind: 'milestone',
    title: 'You’ve rounded up 100.00 USD!',
    message: 'A little at a time adds up.',
    route: '/portfolio',
    sourceIds: [],
  },
  {
    id: 'friend',
    kind: 'friend',
    title: 'Alex joined Beaver',
    message: 'Find them in your friends list.',
    route: '/leaderboards',
    sourceIds: [],
  },
];
export default function NotificationPreview() {
  const [notice, setNotice] = useState<InAppNotice | null>(samples[0]!);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 180, gap: 16 }}>
        <Text style={{ color: colors.ink, fontSize: 24 }}>Notification previews</Text>
        <Text style={{ color: colors.muted }}>
          Sample data only. These previews do not send pushes or change balances.
        </Text>
        {samples.map((item) => (
          <Pressable key={item.id} onPress={() => setNotice(item)} style={{ paddingVertical: 14 }}>
            <Text style={{ color: colors.ink }}>{item.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {notice ? (
        <DynamicNotificationCard
          key={notice.id}
          notice={notice}
          onDismiss={() => setNotice(null)}
          onOpen={() => setNotice(null)}
        />
      ) : null}
    </View>
  );
}
