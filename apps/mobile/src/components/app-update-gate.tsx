import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAppUpdate } from '../lib/use-app-update';
import { BrandedWaitSurface } from './branded-wait-surface';
import { AppUpdateScreen } from './app-update-screen';

/** Sits above auth/navigation so sheets and deep links cannot bypass a requirement. */
export function AppUpdateGate({ children }: PropsWithChildren) {
  const update = useAppUpdate();
  if (!update.hydrated) return <BrandedWaitSurface still accessibilityLabel="Loading Beaver" />;
  if (!update.visible || !update.policy?.enabled) return children;
  return (
    <View
      style={{ flex: 1 }}
      onLayout={() => {
        void SplashScreen.hideAsync().catch(() => {});
      }}
    >
      <AppUpdateScreen
        policy={update.policy}
        mode={update.mode}
        installedBuild={update.installedBuild}
        checking={update.checking}
        checkFailed={update.checkFailed}
        onCheck={() => void update.refresh()}
        onDismiss={update.dismiss}
      />
    </View>
  );
}
