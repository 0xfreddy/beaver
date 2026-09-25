import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useProfile } from '../providers/profile-provider';
import { ProfileAvatar } from './profile-avatar';
import { useTheme } from '../theme';

export function AppTabs() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 76,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {(
        [
          { name: 'index', label: 'Home', icon: '⌂' },
          { name: 'portfolio', label: 'Portfolio', icon: '▱' },
          { name: 'leaderboards', label: 'Leaderboard', icon: '≡' },
          { name: 'settings', label: 'Profile', icon: '' },
        ] as const
      ).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color }) =>
              tab.name === 'settings' ? (
                <ProfileAvatar id={profile.avatarId} size={26} />
              ) : (
                <Text style={{ color, fontSize: 25 }}>{tab.icon}</Text>
              ),
          }}
        />
      ))}
    </Tabs>
  );
}
