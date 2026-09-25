import { usePathname } from 'expo-router';
import { BankMark } from './bank-mark';
import { useInstitutionDirectory } from '../lib/institution-directory';
import { useLogoDirectory } from '../lib/logo-directory';
import { OnboardingAnimation } from './onboarding-animation';
import { roundupStateLabel } from '../lib/purchases';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Screen, TextButton, Type } from './ui';
import { useAuth } from '../providers/auth-provider';
import { useLive, type Capabilities } from '../lib/live';
import { apiRequest } from '../lib/api';
import { openBankLink, supportsBankLink } from '../lib/bank-link';
import { openSaltEdgeLink } from '../lib/bank-link-saltedge';
import { posthog } from '../lib/telemetry';
import { useTheme } from '../theme';
import { useMockData } from '../providers/mock-data-provider';

type Connection = {
  id: string;
  institutionName: string | null;
  institutionAvatar?: string | null;
  status: string;
  initialSyncComplete: boolean;
  disconnectRequested: boolean;
  lastSyncedAt: string | null;
};
type BankAccount = {
  id: string;
  connectionId: string;
  name: string;
  mask: string | null;
  currency: string;
  enabled: boolean;
};
type Completion = {
  userId: string;
  linkSessionId: string;
  mode: string;
  exchangeableToken: string;
};
type BankRegion = 'north_america' | 'united_kingdom' | 'europe' | 'asia_pacific' | 'other';
type MoneyKitCountry = 'US' | 'CA' | 'GB';
const REGIONS: {
  id: BankRegion;
  label: string;
  countries: readonly MoneyKitCountry[];
  available: boolean;
}[] = [
  { id: 'north_america', label: 'North America', countries: ['US', 'CA'], available: true },
  { id: 'united_kingdom', label: 'UK', countries: ['GB'], available: true },
  { id: 'europe', label: 'Europe', countries: [], available: false },
  { id: 'asia_pacific', label: 'Asia-Pacific', countries: [], available: false },
  { id: 'other', label: 'Other regions', countries: [], available: false },
];

export function BankControls({
  onboarding = false,
  onCancel,
  linkRequest = 0,
  onBusyChange,
}: {
  onboarding?: boolean;
  onCancel?: () => void;
  linkRequest?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const auth = useAuth();
  const returnTo = usePathname();
  const directory = useInstitutionDirectory();
  const logos = useLogoDirectory();
  const [samplePicker, setSamplePicker] = useState(false);
  const [regionPicker, setRegionPicker] = useState(false);
  const mockData = useMockData();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const capabilities = useLive<Capabilities>('/v1/capabilities');
  const connections = useLive<{ items: Connection[] }>(
    '/v1/bank/connections',
    !!capabilities.data?.bankConnectionEnabled,
  );
  const accounts = useLive<{ items: BankAccount[] }>(
    '/v1/bank/accounts',
    !!capabilities.data?.bankConnectionEnabled,
  );
  const [unlink, setUnlink] = useState<{
    connection: Connection;
    contributionSharePercent: number | null;
    items: {
      merchant: string;
      purchaseCents: number;
      roundupCents: number;
      currency: string;
      symbol: string;
      status: string;
      preview: boolean;
    }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Completion | null>(null);
  const owner = useRef(auth.user?.id);
  useEffect(() => {
    owner.current = auth.user?.id;
    return () => {
      owner.current = undefined;
    };
  }, [auth.user?.id]);
  const refresh = () => cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function complete(value: Completion) {
    if (owner.current !== value.userId)
      throw new Error('Sign in to the account that started this bank connection.');
    await apiRequest(
      auth.getAccessToken,
      value.mode === 'update' ? '/v1/bank/relink' : '/v1/bank/exchange',
      {
        method: 'POST',
        body: JSON.stringify(
          value.mode === 'update'
            ? { linkSessionId: value.linkSessionId }
            : { linkSessionId: value.linkSessionId, exchangeableToken: value.exchangeableToken },
        ),
      },
    );
    setPending(null);
    setMessage(null);
    posthog?.capture('bank_connection_completed', { connection_mode: value.mode });
    if (value.mode === 'crypto') posthog?.capture('crypto_card_linked');
  }
  async function link(connectionId?: string, countryOverride?: MoneyKitCountry) {
    if (mockData.active && !connectionId) {
      setSamplePicker(true);
      return;
    }
    if (mockData.active) {
      await apiRequest(auth.getAccessToken, '/v1/bank/relink', {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      });
      posthog?.capture('bank_connection_completed', { connection_mode: 'sample' });
      return;
    }
    const userId = auth.user!.id;
    const selectedCountry =
      countryOverride ??
      (capabilities.data?.bankCountries.includes(capabilities.data.country ?? '')
        ? capabilities.data.country!
        : capabilities.data?.bankCountries[0]);
    if (!selectedCountry) throw new Error('Bank connections aren’t available yet.');
    const session = await apiRequest<{
      id: string;
      token: string;
      mode: string;
      redirectUri?: string;
      returnUrl?: string;
      connectUrl?: string;
      provider: 'moneykit' | 'saltedge';
    }>(auth.getAccessToken, '/v1/bank/link', {
      method: 'POST',
      body: JSON.stringify(
        connectionId ? { country: selectedCountry, connectionId } : { country: selectedCountry },
      ),
    });
    let exchangeableToken: string;
    if (session.provider === 'saltedge') {
      if (!session.connectUrl || !session.returnUrl)
        throw new Error('This build requires Salt Edge banking.');
      const outcome = await openSaltEdgeLink(session.connectUrl, session.returnUrl, returnTo);
      if (outcome === null) {
        if (onboarding) onCancel?.();
        else setMessage('Bank connection cancelled.');
        return;
      }
      // The connect URL performs the token's role and is replayed at finalize.
      exchangeableToken = session.token;
      posthog?.capture('bank_connection_started', { bank_provider: 'saltedge' });
    } else {
      if (session.provider !== 'moneykit' || !session.redirectUri)
        throw new Error('This build requires MoneyKit banking.');
      const outcome = await openBankLink(session.token, session.redirectUri, session.mode);
      if (outcome === null) {
        if (onboarding) onCancel?.();
        else setMessage('Bank connection cancelled.');
        return;
      }
      exchangeableToken = outcome;
      posthog?.capture('bank_connection_started', { bank_provider: 'moneykit' });
    }
    const value = { userId, linkSessionId: session.id, mode: session.mode, exchangeableToken };
    setPending(value); // Ask the server to recover the same session; never log tokens.
    await complete(value);
  }
  const started = useRef(-1);
  const regionPickerAvailable = supportsBankLink;
  const regionCountry = (region: (typeof REGIONS)[number]) => {
    if (!region.available) return undefined;
    const userCountry = capabilities.data?.country as MoneyKitCountry | null | undefined;
    return userCountry && region.countries.includes(userCountry)
      ? userCountry
      : region.countries.find((country) => capabilities.data?.bankCountries.includes(country));
  };
  const regionDisabled = (region: (typeof REGIONS)[number]) =>
    !region.available || busy || !supportsBankLink || !regionCountry(region);
  const visibleConnections =
    connections.data?.items.filter((c) => c.status !== 'disconnected') ?? [];
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const startConnection = useEffectEvent(() =>
    regionPickerAvailable ? setRegionPicker(true) : void run(() => link()),
  );
  useEffect(() => {
    if (
      !onboarding ||
      started.current === linkRequest ||
      !mockData.ready ||
      !capabilities.data?.bankConnectionEnabled
    )
      return;
    started.current = linkRequest;
    startConnection();
  }, [onboarding, linkRequest, mockData.ready, capabilities.data?.bankConnectionEnabled]);
  if (unlink)
    return (
      <Card>
        <Type variant="headline">Unlink {unlink.connection.institutionName || 'this bank'}?</Type>
        <Type>
          {unlink.contributionSharePercent == null
            ? 'There is not enough live USD history to estimate this bank’s contribution.'
            : `This bank supplied ${unlink.contributionSharePercent}% of your USD bank roundups in the last 30 days. Unlinking removes this source of future stock purchases.`}
        </Type>
        <Type muted>
          Your existing stocks stay in your wallet. Future and unreserved roundups stop; already
          signed orders can still settle.
        </Type>
        <Type variant="headline">Recent purchases from this bank</Type>
        {unlink.items.length === 0 ? (
          <Type muted>No roundup history yet.</Type>
        ) : (
          unlink.items.map((item, i) => (
            <View key={i} style={{ gap: 4 }}>
              <Type>
                {item.merchant} · {item.currency} {(item.purchaseCents / 100).toFixed(2)}
              </Type>
              <Type variant="caption" muted>
                {item.currency} {(item.roundupCents / 100).toFixed(2)} → {item.symbol} ·{' '}
                {item.preview ? 'Preview' : roundupStateLabel(item.status)}
              </Type>
            </View>
          ))
        )}
        {message ? <Type accessibilityRole="alert">{message}</Type> : null}
        <Button
          secondary
          title="Keep bank connected"
          disabled={busy}
          onPress={() => setUnlink(null)}
        />
        <Button
          title="Yes, unlink bank"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              'Are you sure?',
              'This stops new roundups from this bank. Your existing stocks are kept.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Unlink bank',
                  style: 'destructive',
                  onPress: () =>
                    void run(async () => {
                      await apiRequest(
                        auth.getAccessToken,
                        `/v1/bank/connections/${unlink.connection.id}`,
                        { method: 'DELETE' },
                      );
                      setUnlink(null);
                    }),
                },
              ],
            )
          }
        />
      </Card>
    );
  return (
    <View style={onboarding ? styles.onboardingRoot : styles.root}>
      <Modal
        visible={samplePicker}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setSamplePicker(false)}
      >
        <Screen title="Sample bank connection">
          <Type muted>
            Try connecting another sample bank. No credentials or real accounts are used. Sign in
            with your own account to test MoneyKit.
          </Type>
          {(
            directory.data?.items ?? [
              { id: 'demo-bank', name: 'Sample bank', avatar: null, avatarDark: null, logo: null },
            ]
          ).map((bank) => (
            <Pressable
              key={bank.id}
              accessibilityRole="button"
              accessibilityLabel={`Connect sample ${bank.name}`}
              disabled={busy}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}
              onPress={() =>
                void run(async () => {
                  await apiRequest(auth.getAccessToken, '/v1/bank/sample-link', {
                    method: 'POST',
                    body: JSON.stringify({
                      institutionId: bank.id,
                      institutionName: bank.name,
                      institutionAvatar: bank.avatar ?? bank.logo,
                    }),
                  });
                  setSamplePicker(false);
                })
              }
            >
              <BankMark name={bank.name} uri={bank.avatar ?? bank.logo} />
              <Type>{bank.name}</Type>
            </Pressable>
          ))}
          {message ? <Type accessibilityRole="alert">{message}</Type> : null}
          <TextButton title="Cancel" onPress={() => setSamplePicker(false)} />
        </Screen>
      </Modal>
      <Modal
        visible={regionPicker}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setRegionPicker(false)}
      >
        <Screen title="Where is your bank?">
          <Type muted>Choose the region where your bank is based.</Type>
          <View style={styles.regionList}>
            {REGIONS.map((region) => {
              const disabled = regionDisabled(region);
              return (
                <Pressable
                  key={region.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    region.available
                      ? `Connect a bank in ${region.label}`
                      : `${region.label}, coming soon`
                  }
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.regionRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.line,
                      opacity: disabled ? 0.42 : pressed ? 0.64 : 1,
                    },
                  ]}
                  onPress={() => {
                    const country = regionCountry(region);
                    if (!country) return;
                    setRegionPicker(false);
                    void run(() => link(undefined, country));
                  }}
                >
                  <View style={styles.regionCopy}>
                    <Type style={styles.regionLabel}>{region.label}</Type>
                    {!region.available ? (
                      <Type variant="caption" muted>
                        Coming soon
                      </Type>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {message ? <Type accessibilityRole="alert">{message}</Type> : null}
          <TextButton title="Cancel" onPress={() => setRegionPicker(false)} />
        </Screen>
      </Modal>
      {capabilities.isPending ? <Type muted>Checking bank availability…</Type> : null}
      {capabilities.data && !capabilities.data.bankConnectionEnabled ? (
        <Card>
          <Type variant="headline">Bank connections aren’t available yet</Type>
        </Card>
      ) : null}
      {!onboarding && capabilities.data?.bankEnvironment === 'sandbox' ? (
        <Type muted>Sandbox · test transactions only. No investments are created.</Type>
      ) : null}
      {capabilities.data?.bankConnectionEnabled ? (
        <>
          {!supportsBankLink ? (
            <Type muted>Connect your bank in the iOS or Android app.</Type>
          ) : null}
        </>
      ) : null}
      {pending?.userId === auth.user?.id ? (
        <Button
          title="Finish bank connection"
          loading={busy}
          onPress={() => void run(() => complete(pending!))}
        />
      ) : null}
      {message ? <Type accessibilityRole="alert">{message}</Type> : null}
      {pending ? (
        <Button
          title="Start a new connection"
          secondary
          disabled={busy}
          onPress={() => setPending(null)}
        />
      ) : null}
      {[capabilities.error, connections.error, accounts.error].filter(Boolean).map((error, i) => (
        <Type key={i} accessibilityRole="alert">
          {error!.message}
        </Type>
      ))}
      {onboarding && visibleConnections.length > 0 ? (
        <View style={styles.connectedBridge}>
          <OnboardingAnimation name="bank-bridge-builder" height={120} loop={false} />
          <Type muted style={{ textAlign: 'center' }}>
            First bank connected.
          </Type>
        </View>
      ) : null}
      {visibleConnections.map((connection) => {
        const ready =
          connection.status === 'healthy' &&
          connection.initialSyncComplete &&
          !connection.disconnectRequested;
        const status = connection.disconnectRequested
          ? 'Disconnecting'
          : ready
            ? mockData.active
              ? 'Sample'
              : 'Connected'
            : connection.status.replaceAll('_', ' ');
        return (
          <View
            key={connection.id}
            style={
              onboarding
                ? {
                    paddingVertical: 18,
                    borderBottomWidth: 0.5,
                    borderColor: colors.line,
                    gap: 12,
                  }
                : undefined
            }
          >
            <View
              style={[
                styles.listRow,
                !onboarding && { borderBottomWidth: 0.5, borderColor: colors.line },
              ]}
            >
              <BankMark
                name={connection.institutionName || 'Bank'}
                uri={
                  connection.institutionAvatar ??
                  (connection.institutionName
                    ? (logos.data?.banks?.find((bank) => bank.name === connection.institutionName)
                        ?.uri ?? null)
                    : null)
                }
              />
              <Type variant="headline" style={{ flex: 1 }} numberOfLines={1}>
                {connection.institutionName || 'Connected bank'}
              </Type>
              {onboarding ? (
                <View style={{ alignItems: 'flex-start' }}>
                  <Badge>{status}</Badge>
                </View>
              ) : (
                <Type variant="caption" muted numberOfLines={1} style={styles.connectionStatus}>
                  {status}
                </Type>
              )}
            </View>
            {!connection.initialSyncComplete && !connection.disconnectRequested ? (
              <View
                style={[
                  styles.listRow,
                  !onboarding && { borderBottomWidth: 0.5, borderColor: colors.line },
                ]}
              >
                <ActivityIndicator size="small" color={colors.muted} />
                <Type muted>Syncing transactions…</Type>
              </View>
            ) : null}
            {onboarding && ready ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expanded === connection.id }}
                onPress={() => setExpanded(expanded === connection.id ? null : connection.id)}
                style={{ paddingVertical: 8 }}
              >
                <Type muted>
                  {expanded === connection.id ? 'Hide accounts' : 'Choose accounts for roundups'}
                </Type>
              </Pressable>
            ) : null}
            {accounts.data?.items
              .filter((a) => !onboarding || expanded === a.connectionId)
              .filter((a) => a.connectionId === connection.id)
              .map((account) => (
                <View
                  key={account.id}
                  style={[
                    styles.listRow,
                    !onboarding && { borderBottomWidth: 0.5, borderColor: colors.line },
                    { paddingVertical: 8 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Type>
                      {account.name}
                      {account.mask ? ` · ${account.mask}` : ''}
                    </Type>
                    <Type variant="caption" muted>
                      {account.currency} ·{' '}
                      {account.enabled ? 'Selected for roundups' : 'Not selected'}
                    </Type>
                  </View>
                  <Switch
                    accessibilityLabel={`Use ${account.name} ${account.mask || ''} for roundups`}
                    value={account.enabled}
                    disabled={!ready || busy}
                    onValueChange={(enabled) =>
                      void run(async () => {
                        await apiRequest(auth.getAccessToken, `/v1/bank/accounts/${account.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ enabled }),
                        });
                      })
                    }
                  />
                </View>
              ))}
            {!connection.disconnectRequested ? (
              <>
                {connection.status === 'relink_required' || connection.status === 'error' ? (
                  onboarding ? (
                    <Button
                      title="Reconnect bank"
                      secondary
                      disabled={busy || !supportsBankLink}
                      onPress={() => void run(() => link(connection.id))}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || !supportsBankLink}
                      onPress={() => void run(() => link(connection.id))}
                      style={({ pressed }) => [
                        styles.listRow,
                        {
                          borderBottomWidth: 0.5,
                          borderColor: colors.line,
                          opacity: pressed ? 0.56 : 1,
                        },
                      ]}
                    >
                      <Type muted style={{ flex: 1 }}>
                        Reconnect bank
                      </Type>
                    </Pressable>
                  )
                ) : null}
                {!onboarding ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        const impact = await apiRequest<{
                          contributionSharePercent: number | null;
                          items: NonNullable<typeof unlink>['items'];
                        }>(
                          auth.getAccessToken,
                          `/v1/bank/connections/${connection.id}/unlink-impact`,
                        );
                        setUnlink({ connection, ...impact });
                      })
                    }
                    style={({ pressed }) => [
                      styles.listRow,
                      {
                        borderBottomWidth: 0.5,
                        borderColor: colors.line,
                        opacity: pressed ? 0.56 : 1,
                      },
                    ]}
                  >
                    <Type muted style={{ flex: 1 }}>
                      Disconnect bank
                    </Type>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      {!onboarding ? (
        <Pressable
          accessibilityRole="button"
          disabled={connections.isFetching || accounts.isFetching}
          onPress={() => void refresh()}
          style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.56 : 1 }]}
        >
          <Type muted style={{ flex: 1 }}>
            Refresh banks
          </Type>
          {connections.isFetching || accounts.isFetching ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : null}
        </Pressable>
      ) : null}

      {!onboarding && capabilities.data?.bankConnectionEnabled ? (
        <View style={styles.connectAction}>
          <Button
            appearance="onboarding"
            title="Connect a bank"
            disabled={busy || !!pending || !regionPickerAvailable}
            loading={busy}
            onPress={() =>
              regionPickerAvailable ? setRegionPicker(true) : void run(() => link())
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  onboardingRoot: { gap: 14 },
  // Stretches so the Connect a bank action can pin to the bottom of the screen.
  root: { gap: 14, flex: 1 },
  connectAction: { marginTop: 'auto', paddingTop: 8 },
  regionList: { gap: 12 },
  regionRow: {
    minHeight: 72,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  regionCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  regionLabel: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  listRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectedBridge: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  connectionStatus: { maxWidth: 110, textAlign: 'right' },
});
