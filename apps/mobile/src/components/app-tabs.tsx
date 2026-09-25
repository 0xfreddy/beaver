import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useProfile } from '../providers/profile-provider';
import { avatarFor } from '../lib/avatars';
import { useTheme } from '../theme';

/** Isolate the evolving native tabs API here; screens have no dependency on it. */
export function AppTabs() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  return (
    <NativeTabs
      minimizeBehavior="never"
      tintColor={colors.green}
      labelStyle={{ color: colors.muted }}
      backgroundColor={colors.background}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portfolio">
        <NativeTabs.Trigger.Icon sf="square.stack.3d.up.fill" md="layers" />
        <NativeTabs.Trigger.Label>Portfolio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leaderboards">
        <NativeTabs.Trigger.Icon sf="trophy.fill" md="leaderboard" />
        <NativeTabs.Trigger.Label>Leaderboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon src={avatarFor(profile.avatarId).tab} renderingMode="original" />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
