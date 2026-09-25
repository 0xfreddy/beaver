import {
  AccessibilityInfo,
  Alert,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, Type, rowStyle } from '../../components/ui';
import { useTheme } from '../../theme';
import { useAuth } from '../../providers/auth-provider';
import { MetaballProfileAvatar } from '../../components/reacticx/metaball-profile-avatar';
import { useProfile } from '../../providers/profile-provider';
import { useEffect, useState } from 'react';
import { isBiometricUnlockEnabled, subscribeBiometricPreference } from '../../lib/biometric-auth';
import { ThemeSwitch, ThemeTransitionProvider } from '../../components/reacticx/theme-switch';
import { useLive, type InvestmentPolicy } from '../../lib/live';
import { notificationPermissionState } from '../../lib/notification-permissions';
import { useMockData } from '../../providers/mock-data-provider';

const rows = [
  { id: 'banks', title: 'Connected banks', detail: 'Manage' },
  { id: 'crypto', title: 'Crypto cards', detail: 'Add address' },
  { id: 'wallet', title: 'Wallet', detail: 'Feed Beaver' },
  { id: 'withdraw', title: 'Withdraw', detail: 'USDC · Solana' },
  { id: 'investing', title: 'Automatic investing', detail: 'Off' },
  { id: 'rules', title: 'Roundup rules', detail: 'Choose your rule' },
  { id: 'fallback', title: 'Fallback stock', detail: 'Choose a stock' },
  { id: 'security', title: 'Face ID', detail: 'Off' },
  { id: 'notifications', title: 'Notifications', detail: 'Off' },
  { id: 'manual', title: 'Manual mode', detail: 'Receipts' },
] as const;
export default function Settings() {
  return (
    <ThemeTransitionProvider>
      <SettingsContent />
    </ThemeTransitionProvider>
  );
}

function SettingsContent() {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const auth = useAuth();
  const mockData = useMockData();
  const { profile, ready, error: profileError } = useProfile();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);
  useEffect(() => {
    void notificationPermissionState()
      .then((state) => setNotificationsOn(state === 'granted'))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const read = () => {
      const id = auth.user?.id;
      if (!id) {
        setBiometricOn(false);
        return;
      }
      void isBiometricUnlockEnabled(id)
        .then((enabled) => setBiometricOn(enabled))
        .catch(() => {});
    };
    read();
    return subscribeBiometricPreference(read);
  }, [auth.user?.id]);
  const banks = useLive<{
    items: { institutionName: string | null; status: string; disconnectRequested: boolean }[];
  }>('/v1/bank/connections');
  const cryptoCards = useLive<{ items: unknown[] }>('/v1/bank/crypto-cards', true, false);
  const cryptoDetail = (() => {
    const count = cryptoCards.data?.items.length ?? 0;
    if (!count) return 'Add address';
    return count === 1 ? '1 address' : `${count} addresses`;
  })();
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  // Automatic investing is always on; the row advertises the current limit.
  const investingDetail = policy.data?.dailyLimitCents
    ? `$${(policy.data.dailyLimitCents / 100).toFixed(0)}/day`
    : 'Always on';
  const settingsRows = mockData.active
    ? [
        { id: 'banks', title: 'Connected banks', detail: 'Chase' },
        { id: 'crypto', title: 'Crypto cards', detail: cryptoDetail },
        { id: 'wallet', title: 'Wallet', detail: '$227.50 available' },
        { id: 'withdraw', title: 'Withdraw', detail: 'USDC · Solana' },
        {
          id: 'investing',
          title: 'Automatic investing',
          detail: investingDetail,
        },
        { id: 'rules', title: 'Roundup rules', detail: 'Choose your rule' },
        { id: 'fallback', title: 'Fallback stock', detail: 'Choose a stock' },
        { id: 'security', title: 'Face ID', detail: 'Device lock' },
        { id: 'notifications', title: 'Notifications', detail: 'Configured' },
        { id: 'manual', title: 'Manual mode', detail: 'Receipts' },
      ]
    : rows.map((row) =>
        row.id === 'banks'
          ? {
              ...row,
              detail:
                banks.data?.items
                  .filter((b) => b.status !== 'disconnected' && !b.disconnectRequested)
                  .map((b) => b.institutionName || 'Bank')
                  .join(', ') || 'Manage',
            }
          : row.id === 'crypto'
            ? { ...row, detail: cryptoDetail }
            : row.id === 'investing'
              ? { ...row, detail: investingDetail }
              : row.id === 'fallback'
                ? { ...row, detail: policy.data?.fallbackSymbol ?? 'Choose a stock' }
                : row.id === 'security'
                  ? { ...row, detail: biometricOn ? 'On' : 'Off' }
                  : row.id === 'notifications'
                    ? { ...row, detail: notificationsOn ? 'On' : 'Off' }
                    : row,
      );
  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      await auth.logout();
    } catch {
      setError('We couldn’t sign you out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <Screen fadeTop title="Profile">
      <View style={styles.profileIdentity}>
        <MetaballProfileAvatar
          id={profile.avatarId}
          onPress={() => router.push('/profile/avatar')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile name"
          disabled={!ready}
          onPress={() => router.push('/profile/alias')}
          style={styles.profileName}
        >
          <Type variant="headline" style={{ textAlign: 'center' }}>
            {profile.alias || 'Make it yours'}
          </Type>
          <Type muted style={{ textAlign: 'center' }}>
            Edit profile
          </Type>
        </Pressable>
      </View>
      <Button
        title="Invite friends"
        appearance="onboarding"
        onPress={() => router.push('/invite-friends')}
      />
      {profileError ? <Type accessibilityRole="alert">{profileError}</Type> : null}
      {!auth.session ? (
        <Button
          title={auth.user ? 'Finish account setup' : 'Sign in to Beaver'}
          onPress={() => router.push('/onboarding/account')}
        />
      ) : null}
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
      <View>
        {[
          ...settingsRows,
          { id: 'legal', title: 'Legal', detail: 'Terms, privacy & support' },
          ...(auth.session
            ? [{ id: 'danger-zone', title: 'Danger zone', detail: 'Delete account' }]
            : []),
        ].map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={() =>
              row.id === 'wallet'
                ? router.push('/funding')
                : row.id === 'withdraw'
                  ? router.push('/withdraw')
                  : row.id === 'manual'
                    // Manual mode opens the receipt camera directly.
                    ? router.push('/receipt-scan')
                    : router.push(`/settings/${row.id}`)
            }
            style={[
              rowStyle,
              {
                paddingVertical: 23,
                flexWrap: 'wrap',
                gap: 8,
                borderBottomWidth: 1,
                borderColor: colors.line,
              },
            ]}
          >
            <Type style={{ fontWeight: '500' }}>{row.title}</Type>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Type variant="caption" muted>
                {row.detail}
              </Type>
              <Type muted>›</Type>
            </View>
          </Pressable>
        ))}
      </View>
      <Type variant="headline">Appearance</Type>
      <ThemeSwitch />
      <Button
        title="Read the introduction"
        secondary
        onPress={() => router.push('/onboarding/welcome?readOnly=true')}
      />
      {auth.session ? (
        <Button title="Sign out" secondary loading={signingOut} onPress={() => void signOut()} />
      ) : null}
      {mockData.available && auth.session ? (
        <View style={styles.testDataSection}>
          <Type variant="headline">Test data</Type>
          {mockData.active ? (
            <>
              <View style={styles.mockStatus}>
                <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
                <Type>Mock data active</Type>
              </View>
              <Type variant="caption" muted>
                Sample activity is stored only on this device.
              </Type>
              <View style={[styles.mockActions, fontScale > 1.3 && styles.mockActionsStacked]}>
                <View style={styles.mockAction}>
                  <Button
                    title="Reload mock data"
                    secondary
                    loading={mockData.busy}
                    onPress={() =>
                      void mockData
                        .reload()
                        .then(() =>
                          AccessibilityInfo.announceForAccessibility('Sample account reloaded'),
                        )
                        .catch(() => {})
                    }
                  />
                </View>
                <View style={styles.mockAction}>
                  <Button
                    title="Clear mock data"
                    secondary
                    disabled={mockData.busy}
                    onPress={() =>
                      Alert.alert(
                        'Clear sample account?',
                        'Your live account will appear again. No live data will be changed.',
                        [
                          { text: 'Keep sample data', style: 'cancel' },
                          {
                            text: 'Clear',
                            style: 'destructive',
                            onPress: () =>
                              void mockData
                                .clear()
                                .then(() =>
                                  AccessibilityInfo.announceForAccessibility(
                                    'Sample account cleared',
                                  ),
                                )
                                .catch(() => {}),
                          },
                        ],
                      )
                    }
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Type muted>Preview a complete Beaver account without changing live data.</Type>
              <Button title="Load mock data" secondary onPress={() => router.push('/mock-data')} />
            </>
          )}
          {mockData.error ? <Type accessibilityRole="alert">{mockData.error}</Type> : null}
        </View>
      ) : null}
      <Type variant="caption" muted style={{ textAlign: 'center' }}>
        Beaver · Version 0.1
      </Type>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileIdentity: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  profileName: { minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  socialActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  socialActionsExpanded: { flexDirection: 'column' },
  socialAction: { flex: 1, minWidth: 0, width: undefined },
  expandedQr: { width: '100%' },
  testDataSection: { gap: 12, paddingTop: 6 },
  mockStatus: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  mockActions: { flexDirection: 'row', gap: 10 },
  mockActionsStacked: { flexDirection: 'column' },
  mockAction: { flex: 1 },
});
