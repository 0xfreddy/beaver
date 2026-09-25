import { FallbackStock } from '../../components/fallback-stock';
import { ManualReceipts } from '../../components/manual-receipts';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearMockData } from '../../lib/mock-data';
import { AppState, Linking, Pressable, Switch, TextInput, View } from 'react-native';
import { HoldDeleteButton } from '../../components/hold-delete-button';
import * as WebBrowser from 'expo-web-browser';
import { LegalLinks } from '../../components/legal-links';
import { Button, Card, Screen, Type } from '../../components/ui';
import { BankControls } from '../../components/bank-controls';
import { LogoAttribution } from '../../components/logo-attribution';
import { AccountGate } from '../../components/account-gate';
import { CryptoCards } from '../../components/crypto-cards';
import { SpendingSetup } from '../../components/spending-setup';
import { useLive } from '../../lib/live';
import { RoundupRules } from '../../components/roundup-rules';
import { InvestingControls } from '../../components/investing-controls';
import type { NotificationPreferences } from '@roundups/types';
import { useTheme } from '../../theme';
import { useMockData } from '../../providers/mock-data-provider';
import { useAuth } from '../../providers/auth-provider';
import { ApiError, apiRequest } from '../../lib/api';
import { posthog } from '../../lib/telemetry';
import {
  notificationPermissionState,
  openNotificationSettings,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../../lib/notification-permissions';
import {
  biometricAvailability,
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricUnlockEnabled,
  type BiometricAvailability,
} from '../../lib/biometric-auth';

const content: Record<string, { title: string; headline: string; body: string }> = {
  banks: {
    title: 'Connected banks',
    headline: 'Your bank, read-only.',
    body: 'Manage your bank connections and choose which accounts can create roundups.',
  },
  rules: {
    title: 'Roundup rules',
    headline: 'A few simple rules.',
    body: 'Only posted, eligible purchases count. Choose whole-dollar roundups, a fixed percentage, or match the purchase amount. Scanned receipts invest on any date; synced bank history from before activation stays preview. Transfers, refunds, rent, fees and other excluded payments do not create roundups. Live investments buy spot xStocks without leverage, subject to each market’s minimum and your daily purchase limit.',
  },
  about: {
    title: 'About Beaver',
    headline: 'Beaver',
    body: 'Turn everyday purchases into small investments. Connect your bank, choose your limits and use your Solana wallet to invest in tokenized stocks.',
  },
};

export default function SettingsDetail() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const mockData = useMockData();
  if (section === 'banks')
    return (
      <AccountGate>
        <SpendingSettings kind="banks" />
      </AccountGate>
    );
  if (section === 'fallback')
    return (
      <AccountGate>
        <FallbackStock />
      </AccountGate>
    );
  if (section === 'manual')
    return (
      <AccountGate>
        <ManualReceipts />
      </AccountGate>
    );
  if (section === 'wallet') return <Redirect href="/funding" />;
  if (section === 'security') return <SecuritySettings />;
  if (section === 'rules') return <RoundupRules />;
  if (section === 'investing')
    return (
      <AccountGate>
        <InvestingControls />
      </AccountGate>
    );
  if (section === 'delete-account' || section === 'danger-zone') return <DeleteAccount />;
  if (section === 'legal') return <LegalSettings />;
  if (section === 'crypto')
    return (
      <AccountGate>
        <SpendingSettings kind="crypto" />
      </AccountGate>
    );
  if (section === 'notifications') return <NotificationPreferences sample={mockData.active} />;
  const item = content[section];
  if (!item) return <Screen title="Setting not found" />;
  return (
    <Screen title={item.title}>
      <Card>
        <Type variant="headline">{item.headline}</Type>
        <Type muted>{item.body}</Type>
        {section === 'banks' && (
          <Button title="Explore bank setup" onPress={() => router.push('/onboarding/bank')} />
        )}
      </Card>
    </Screen>
  );
}

function SpendingSettings({ kind }: { kind: 'banks' | 'crypto' }) {
  const connections = useLive<{ items: { id: string }[] }>(
    kind === 'banks' ? '/v1/bank/connections' : '/v1/bank/crypto-cards',
  );
  if (
    connections.data?.items.length === 0 ||
    (kind === 'banks' &&
      connections.error instanceof ApiError &&
      connections.error.code === 'BANK_NOT_CONFIGURED')
  )
    return <SpendingSetup initialStage={kind === 'banks' ? 'bank' : 'address'} />;
  return (
    <Screen title={kind === 'banks' ? 'Connected banks' : 'Crypto cards'} fillContent>
      {connections.isPending ? (
        <Type muted>Loading connections…</Type>
      ) : connections.error ? (
        <>
          <Type accessibilityRole="alert">{connections.error.message}</Type>
          <Button title="Try again" onPress={() => void connections.refetch()} />
        </>
      ) : kind === 'banks' ? (
        <View style={{ flex: 1 }}>
          <BankControls />
          <LogoAttribution />
        </View>
      ) : (
        <CryptoCards />
      )}
    </Screen>
  );
}

function SecuritySettings() {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const current = await biometricAvailability();
    setAvailability(current);
    setEnabled(userId ? await isBiometricUnlockEnabled(userId) : false);
  }, [userId]);
  useEffect(() => {
    void refresh().catch(() => {});
    // Re-check after the user returns from device settings, where they may
    // have enrolled Face ID or set a passcode.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh().catch(() => {});
    });
    return () => subscription.remove();
  }, [refresh]);
  async function enable() {
    if (!userId) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await enableBiometricUnlock(userId);
      setAvailability(result);
      setEnabled(true);
      setMessage(`${result.label} is enabled for this account.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not enable biometric unlock.');
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    if (!userId) return;
    setBusy(true);
    setMessage(null);
    try {
      await disableBiometricUnlock(userId);
      setEnabled(false);
      setMessage('Biometric unlock is off for this account.');
    } catch {
      setMessage('Could not update biometric unlock.');
    } finally {
      setBusy(false);
    }
  }
  const label = availability?.label ?? 'Face ID';
  return (
    <Screen title={label}>
      <AccountGate>
        <View style={{ gap: 18 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Type variant="headline">Use {label}</Type>
            <Switch
              accessibilityLabel={`Use ${label}`}
              value={enabled}
              disabled={busy || !userId || (!enabled && !availability?.available)}
              onValueChange={(value) => void (value ? enable() : disable())}
            />
          </View>
          <Type muted>
            {availability?.reason ??
              `${label} unlocks Beaver on this device and is required before withdrawals.`}
          </Type>
          {message ? <Type accessibilityRole="alert">{message}</Type> : null}
        </View>
      </AccountGate>
    </Screen>
  );
}

function LegalSettings() {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const rows = [
    { title: 'Privacy policy', url: 'https://trybeaver.app/privacy' },
    { title: 'Terms and Conditions', url: 'https://trybeaver.app/terms' },
    { title: 'Support', subtitle: 'hello@trybeaver.app', url: 'mailto:hello@trybeaver.app' },
  ];
  async function open(url: string) {
    setError(null);
    try {
      if (url.startsWith('mailto:')) await Linking.openURL(url);
      else await WebBrowser.openBrowserAsync(url);
    } catch {
      setError('Couldn’t open this link. Please try again.');
    }
  }
  return (
    <Screen title="Legal">
      <View>
        {rows.map((row) => (
          <Pressable
            key={row.title}
            accessibilityRole="link"
            onPress={() => void open(row.url)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 22,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Type>{row.title}</Type>
              {row.subtitle ? (
                <Type variant="caption" muted>
                  {row.subtitle}
                </Type>
              ) : null}
            </View>
            <Type muted accessible={false}>
              ›
            </Type>
          </Pressable>
        ))}
      </View>
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
    </Screen>
  );
}

function DeleteAccount() {
  const auth = useAuth();
  const cache = useQueryClient();
  const deleting = useRef(false);
  const { colors } = useTheme();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  async function deleteAccount() {
    if (deleting.current || confirmation !== 'Delete my Beaver Account') return;
    deleting.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await cache.cancelQueries();
      const result = await apiRequest<{ deleted: boolean }>(auth.getAccessToken, '/v1/account', {
        method: 'DELETE',
      });
      if (result.deleted !== true)
        throw new Error('Account deletion was not confirmed. Please try again.');
      posthog?.capture('account_deleted');
      setDeleted(true);
      if (auth.user) await clearMockData(auth.user.id);
      await auth.logout();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Couldn’t delete your account.');
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  }

  if (deleted)
    return (
      <Screen title="Delete account">
        <Card>
          <Type variant="headline">Your account is deleted</Type>
          <Type muted>
            Your account data has been removed from Beaver’s active database. Limited deletion audit
            records and backup copies may remain under applicable retention requirements.
          </Type>
          {message ? (
            <Type accessibilityRole="alert">
              Your account was deleted, but sign-out did not finish. Please try signing out again.
            </Type>
          ) : null}
          <Button
            title="Finish signing out"
            onPress={() => void auth.logout().catch(() => setMessage('Sign-out failed'))}
          />
        </Card>
      </Screen>
    );

  return (
    <Screen title="Danger zone" keyboard>
      <AccountGate>
        <View style={{ gap: 20 }}>
          <Type variant="headline">This permanently deletes your account</Type>
          <Type muted>
            Deleting your account removes your profile, saved bank and card information, receipts,
            activity, settings and social connections from Beaver’s active database. This cannot be
            undone.
          </Type>
          <Type muted>
            Limited security and deletion audit records may remain. Backup copies and data held by
            service providers follow their retention policies and applicable legal requirements.
            Public blockchain records cannot be erased.
          </Type>
          <Type muted>
            Deletion does not withdraw your crypto. Withdraw any remaining funds before deleting
            your account. For privacy or deletion help, contact hello@trybeaver.app.
          </Type>
          <LegalLinks privacyOnly />
          <Type muted>Type “Delete my Beaver Account” to confirm.</Type>
          <TextInput
            accessibilityLabel="Type Delete my Beaver Account to confirm"
            autoCapitalize="none"
            autoCorrect={false}
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Delete my Beaver Account"
            placeholderTextColor={colors.muted}
            style={{
              color: colors.ink,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 12,
            }}
          />
          <HoldDeleteButton
            disabled={confirmation !== 'Delete my Beaver Account'}
            busy={busy}
            onConfirm={() => void deleteAccount()}
          />
          {message ? <Type accessibilityRole="alert">{message}</Type> : null}
        </View>
      </AccountGate>
    </Screen>
  );
}

const notificationChannels = [
  ['roundupsSummary', 'Roundup summary'],
  ['readyToRedeem', 'Ready to redeem'],
  ['bankIssues', 'Bank issues'],
  ['deposits', 'Deposits'],
  ['trades', 'Trades'],
  ['riskAlerts', 'Risk alerts'],
] as const satisfies ReadonlyArray<readonly [keyof NotificationPreferences, string]>;

function NotificationPreferences({ sample }: { sample: boolean }) {
  const { colors } = useTheme();
  const auth = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    setPermission(await notificationPermissionState());
    try {
      setPrefs(
        await apiRequest<NotificationPreferences>(
          auth.getAccessToken,
          '/v1/notification-preferences',
        ),
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Couldn’t load your notification settings.',
      );
    }
  };
  useEffect(() => {
    void reload().catch(() => {});
    // Permission can change while the app is backgrounded (system settings).
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload().catch(() => {});
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  async function enablePermission() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await requestNotificationPermission();
      posthog?.capture('notification_permission_requested', { granted: next === 'granted' });
      setPermission(next);
    } finally {
      setBusy(false);
    }
  }

  async function setChannel(id: keyof NotificationPreferences, enabled: boolean) {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [id]: enabled });
    setMessage(null);
    try {
      const saved = await apiRequest<NotificationPreferences>(
        auth.getAccessToken,
        '/v1/notification-preferences',
        { method: 'PUT', body: JSON.stringify({ ...prefs, [id]: enabled }) },
      );
      setPrefs(saved);
    } catch (cause) {
      setPrefs(previous);
      setMessage(cause instanceof Error ? cause.message : 'Couldn’t save that preference.');
    }
  }

  return (
    <Screen title="Notifications">
      {permission === 'undetermined' ? (
        <Card>
          <Type variant="headline">Stay in the loop</Type>
          <Type muted>
            Beaver can notify you about roundups, deposits and bank connection issues. You choose
            which ones below.
          </Type>
          <Button
            title="Enable notifications"
            loading={busy}
            disabled={!prefs}
            onPress={() => void enablePermission()}
          />
        </Card>
      ) : permission === 'denied' ? (
        <Card>
          <Type variant="headline">Notifications are off</Type>
          <Type muted>
            Beaver is not allowed to send notifications on this device. Turn them on in system
            settings, then come back to choose which ones you get.
          </Type>
          <Button
            title="Open system settings"
            secondary
            onPress={() => void openNotificationSettings()}
          />
        </Card>
      ) : (
        <View>
          {notificationChannels.map(([id, label]) => (
            <View
              key={id}
              style={{
                minHeight: 58,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Type style={{ flex: 1 }}>{label}</Type>
              <Switch
                accessibilityLabel={label}
                value={prefs?.[id] ?? false}
                disabled={!prefs}
                onValueChange={(enabled) => void setChannel(id, enabled)}
              />
            </View>
          ))}
        </View>
      )}
      {message ? <Type accessibilityRole="alert">{message}</Type> : null}
      <Type variant="caption" muted>
        {sample
          ? 'Sample preferences only. Changes stay on this device.'
          : 'Preferences are saved to your account and apply to future notifications.'}
      </Type>
    </Screen>
  );
}
