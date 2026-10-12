import { bankPickerSession, openBankPicker } from '../lib/bank-picker-session';
import type { BankSelection } from '../lib/bank-picker';
import { router, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { SetupPage } from './setup-page';
import { BankGlobeFooter } from './bank-globe';
import { BankUnlinkSheet, type BankUnlinkImpact } from './bank-unlink-sheet';
import { bankAccountLabel, bankAccountState, currencySymbol } from '../lib/bank-presentation';
import { BankMark } from './bank-mark';
import { useInstitutionDirectory } from '../lib/institution-directory';
import { useLogoDirectory } from '../lib/logo-directory';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, TextButton, Type } from './ui';
import { useAuth } from '../providers/auth-provider';
import { useLive, type Capabilities } from '../lib/live';
import { apiRequest, ApiError, timeoutSignal } from '../lib/api';
import { openBankLink, supportsBankLink } from '../lib/bank-link';
import { saveBankExchangeToken } from '../lib/bank-exchange-token';
import { openSaltEdgeLink } from '../lib/bank-link-saltedge';
import {
  clearPendingSaltEdge,
  loadPendingSaltEdge,
  savePendingSaltEdge,
} from '../lib/saltedge-pending';
import {
  bankConnectFailureKind,
  reduceBankConnect,
  shouldReconcile,
  type BankConnectEvent,
  type BankConnectFailureKind,
  type BankConnectStep,
} from '../lib/bank-connect-state';
import { completeBankConnection, type BankCompletion } from '../lib/bank-completion';
import { BankInitialSyncStatus } from './bank-initial-sync-status';
import { BankConnectingSheet } from './bank-connecting-sheet';
import { posthog } from '../lib/telemetry';
import { useTheme } from '../theme';
import { useMockData } from '../providers/mock-data-provider';

type Connection = {
  id: string;
  institutionName: string | null;
  institutionAvatar?: string | null;
  institutionLogoFallback?: string | null;
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
type Completion = BankCompletion;
type MoneyKitCountry = 'US' | 'CA' | 'GB';
/** Mirrors the backend's Salt Edge regions (SALT_EDGE_REGIONS) for region-based links. */
type SaltEdgeLinkRegion = 'europe' | 'asia_pacific' | 'other';
const REGIONS: {
  id: string;
  label: string;
  countries: readonly MoneyKitCountry[];
  available: boolean;
  saltEdgeRegion?: SaltEdgeLinkRegion;
}[] = [
  { id: 'north_america', label: 'North America', countries: ['US', 'CA'], available: true },
  { id: 'united_kingdom', label: 'UK', countries: ['GB'], available: true },
  { id: 'europe', label: 'Europe', countries: [], available: false, saltEdgeRegion: 'europe' },
  {
    id: 'asia_pacific',
    label: 'Asia-Pacific',
    countries: [],
    available: false,
    saltEdgeRegion: 'asia_pacific',
  },
  { id: 'other', label: 'Other regions', countries: [], available: false, saltEdgeRegion: 'other' },
];

export function BankControls({
  onboarding = false,
  onCancel,
  hideConnectAction = false,
  linkRequest = 0,
  onBusyChange,
  onProgressChange,
  onStatusActiveChange,
}: {
  onboarding?: boolean;
  hideConnectAction?: boolean;
  onCancel?: () => void;
  linkRequest?: number;
  onBusyChange?: (busy: boolean) => void;
  onProgressChange?: (progress: { connected: number; syncing: number }) => void;
  onStatusActiveChange?: (active: boolean) => void;
}) {
  const auth = useAuth();
  const returnTo = usePathname();
  const directory = useInstitutionDirectory();
  const logos = useLogoDirectory();
  const [samplePicker, setSamplePicker] = useState(false);
  const [regionPicker, setRegionPicker] = useState(false);
  const selectedRegion = useRef<(typeof REGIONS)[number] | null>(null);
  const [connect, setConnect] = useState<BankConnectStep>({ kind: 'idle' });
  const statusActive =
    connect.kind === 'finishing' || connect.kind === 'failed' || connect.kind === 'success';
  useEffect(() => {
    onStatusActiveChange?.(statusActive);
  }, [statusActive, onStatusActiveChange]);
  // "Connect another bank" arrives as a ?link=1 param from the callback
  // screen; consume it into the shared request counter.
  const params = useLocalSearchParams<{ link?: string }>();
  const [connectRequest, setConnectRequest] = useState(0);
  useEffect(() => {
    if (params.link !== '1') return;
    router.setParams({ link: undefined });
    setConnectRequest((value) => value + 1);
  }, [params.link]);
  const mockData = useMockData();
  const { colors } = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.3;
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
  const [unlink, setUnlink] = useState<BankUnlinkImpact | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Completion | null>(null);
  // One reconciliation attempt per persisted pending instance.
  const reconciled = useRef<string | null>(null);
  const sheetDismissed = useRef(false);
  const running = useRef(false);
  const connectEvent = (event: BankConnectEvent) => {
    if (event.type !== 'reset' && sheetDismissed.current) return;
    setConnect((step) => reduceBankConnect(step, event));
  };
  const owner = useRef(auth.user?.id);
  useEffect(() => {
    owner.current = auth.user?.id;
    return () => {
      owner.current = undefined;
    };
  }, [auth.user?.id]);
  const refresh = () => cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function complete(value: Completion): Promise<string | null> {
    if (owner.current !== value.userId)
      throw new Error('Sign in to the account that started this bank connection.');
    const result = await completeBankConnection(value, auth.getAccessToken);
    setPending(null);
    setMessage(null);
    posthog?.capture('bank_connection_completed', { connection_mode: value.mode });
    if (value.mode === 'crypto') posthog?.capture('crypto_card_linked');
    return result?.institutionName ?? null;
  }
  // The finalize step reports into the connecting sheet; failures there are
  // recoverable from the sheet's own actions instead of an inline message.
  async function finalize(value: Completion): Promise<BankConnectFailureKind | null> {
    setFinalizing(true);
    connectEvent({ type: 'finishing' });
    try {
      const bank = await complete(value);
      connectEvent({ type: 'succeeded', bank });
      if (sheetDismissed.current)
        setMessage(`${bank ?? 'Your bank'} connected. Transactions are syncing.`);
      return null;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (sheetDismissed.current)
        setMessage(
          error instanceof Error ? error.message : 'Couldn’t finish connecting. Try again.',
        );
      connectEvent({
        type: 'failed',
        code,
        message: error instanceof Error ? error.message : undefined,
      });
      return bankConnectFailureKind(code);
    } finally {
      setFinalizing(false);
    }
  }
  async function link(
    connectionId?: string,
    countryOverride?: MoneyKitCountry,
    regionOverride?: SaltEdgeLinkRegion,
    selection?: BankSelection,
    pickerId?: string,
  ) {
    sheetDismissed.current = false;
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
    if (owner.current !== userId) throw new Error('Sign in again to connect your bank.');
    // MoneyKit countries keep the SDK flow; Salt Edge selections identify the exact bank.
    const bankCountries = (capabilities.data?.bankCountries ?? []) as MoneyKitCountry[];
    const country = capabilities.data?.country as MoneyKitCountry | null | undefined;
    const moneyKitCountry = country && bankCountries.includes(country) ? country : bankCountries[0];
    const saltEdge = !!capabilities.data?.saltEdgeEnabled;
    if (!saltEdge && !moneyKitCountry) throw new Error('Bank connections aren’t available yet.');
    const body = selection
      ? selection.provider === 'saltedge'
        ? selection
        : { country: selection.country }
      : regionOverride
        ? { region: regionOverride }
        : connectionId
          ? moneyKitCountry
            ? { country: moneyKitCountry, connectionId }
            : { region: 'other', connectionId }
          : countryOverride
            ? { country: countryOverride }
            : saltEdge
              ? { region: 'other' }
              : { country: moneyKitCountry! };
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
      signal: timeoutSignal(30_000),
      body: JSON.stringify(body),
    });
    if (owner.current !== userId || (selection && !bankPickerSession(pickerId!, userId))) return;
    let exchangeableToken: string;
    if (session.provider === 'saltedge') {
      if (!session.connectUrl || !session.returnUrl)
        throw new Error('This build requires Salt Edge banking.');
      // Persist before the widget: the bank OAuth can relaunch the app cold,
      // and the in-memory flow (and its completion payload) dies with it.
      await saveBankExchangeToken(userId, session.id, session.token);
      const saved = await savePendingSaltEdge({
        provider: 'saltedge',
        userId,
        linkSessionId: session.id,
        mode: session.mode,
        exchangeableToken: '',
        returnTo,
      });
      reconciled.current = `${saved.linkSessionId}:${saved.savedAt}`;
      if (owner.current !== userId || (selection && !bankPickerSession(pickerId!, userId))) {
        await clearPendingSaltEdge(session.id);
        return;
      }
      const outcome = await openSaltEdgeLink(
        session.connectUrl,
        session.returnUrl,
        selection ? `/bank-picker?pickerId=${pickerId}` : returnTo,
      );
      if (outcome === null) {
        void clearPendingSaltEdge(session.id);
        if (!selection) {
          if (onboarding) onCancel?.();
          else setMessage('Bank connection cancelled.');
        }
        return;
      }
      // The connect URL performs the token's role and is replayed at finalize.
      exchangeableToken = session.token;
      posthog?.capture('bank_connection_started', { bank_provider: 'saltedge' });
    } else {
      if (session.provider !== 'moneykit' || !session.redirectUri)
        throw new Error('This build requires MoneyKit banking.');
      // Persist a non-secret marker before opening the native SDK. Recovery
      // uses the securely saved SDK completion token if the process dies.
      const saved = await savePendingSaltEdge({
        provider: 'moneykit',
        userId,
        linkSessionId: session.id,
        mode: session.mode,
        exchangeableToken: '',
        returnTo,
      });
      reconciled.current = `${saved.linkSessionId}:${saved.savedAt}`;
      if (owner.current !== userId || (selection && !bankPickerSession(pickerId!, userId))) {
        await clearPendingSaltEdge(session.id);
        return;
      }
      const outcome = await openBankLink(
        session.token,
        session.redirectUri,
        session.mode,
        (token) => saveBankExchangeToken(userId, session.id, token),
      );
      if (outcome === null) {
        void clearPendingSaltEdge(session.id);
        if (!selection) {
          if (onboarding) onCancel?.();
          else setMessage('Bank connection cancelled.');
        }
        return;
      }
      exchangeableToken = outcome;
      posthog?.capture('bank_connection_started', { bank_provider: 'moneykit' });
    }
    if (selection) router.dismissTo(returnTo as Href);
    const value = { userId, linkSessionId: session.id, mode: session.mode, exchangeableToken };
    setPending(value); // Ask the server to recover the same session; never log tokens.
    await finalize(value);
  }
  function startSelectedRegion() {
    const region = selectedRegion.current;
    selectedRegion.current = null;
    if (!region) return;
    if (region.saltEdgeRegion) {
      void run(() => link(undefined, undefined, region.saltEdgeRegion));
    } else {
      const country = regionCountry(region);
      if (country) void run(() => link(undefined, country));
    }
  }
  const request = linkRequest + connectRequest;
  const started = useRef(0);
  // Salt Edge regions light up only when the backend advertises it; MoneyKit
  // regions are always on where countries resolve.
  const saltEdgeEnabled = !!capabilities.data?.saltEdgeEnabled;
  const regionAvailable = (region: (typeof REGIONS)[number]) =>
    region.available || (!!region.saltEdgeRegion && saltEdgeEnabled);
  const regionCountry = (region: (typeof REGIONS)[number]) => {
    if (!regionAvailable(region) || region.saltEdgeRegion) return undefined;
    const userCountry = capabilities.data?.country as MoneyKitCountry | null | undefined;
    return userCountry && region.countries.includes(userCountry)
      ? userCountry
      : region.countries.find((c) => capabilities.data?.bankCountries.includes(c));
  };
  const regionDisabled = (region: (typeof REGIONS)[number]) =>
    !regionAvailable(region) ||
    busy ||
    !supportsBankLink ||
    (!region.saltEdgeRegion && !regionCountry(region));
  const visibleConnections =
    connections.data?.items.filter((c) => c.status !== 'disconnected' && !c.disconnectRequested) ??
    [];
  const connectedCount = visibleConnections.filter((c) => !c.disconnectRequested).length;
  const syncingCount = visibleConnections.filter(
    (c) => !c.initialSyncComplete && !c.disconnectRequested,
  ).length;
  useEffect(() => {
    onProgressChange?.({
      connected: connectedCount,
      syncing: syncingCount,
    });
  }, [connectedCount, syncingCount, onProgressChange]);
  useEffect(() => {
    onBusyChange?.(busy && !finalizing);
  }, [busy, finalizing, onBusyChange]);
  function beginBankSelection() {
    if (!capabilities.data?.saltEdgeEnabled || mockData.active) {
      setRegionPicker(true);
      return;
    }
    if (!auth.user) return;
    const pickerId = openBankPicker({
      userId: auth.user.id,
      country: capabilities.data.country ?? undefined,
      moneyKitCountries: capabilities.data.bankCountries,
      select: async (selection) => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setMessage(null);
        try {
          await link(undefined, undefined, undefined, selection, pickerId);
          await refresh();
        } finally {
          running.current = false;
          setBusy(false);
        }
      },
    });
  }
  const startConnection = useEffectEvent(() => {
    // While a finalize is still running the picker's rows are inert; opening
    // it would swallow the region tap as a silent no-op.
    if (busy) return;
    if (supportsBankLink) {
      // A stale failure from an earlier attempt must not sit inside the picker.
      setMessage(null);
      beginBankSelection();
    } else void run(() => link());
  });
  useEffect(() => {
    if (
      busy ||
      started.current === request ||
      !mockData.ready ||
      !capabilities.data?.bankConnectionEnabled
    )
      return;
    started.current = request;
    startConnection();
  }, [request, mockData.ready, capabilities.data?.bankConnectionEnabled, busy]);

  // Resume a persisted-but-unfinalized session once per stored instance, so a
  // lost completion signal heals the next time this surface loads.
  useEffect(() => {
    if (!capabilities.data?.bankConnectionEnabled) return;
    void (async () => {
      const stored = await loadPendingSaltEdge();
      if (
        !shouldReconcile(stored, {
          userId: auth.user?.id,
          busy: running.current,
          attemptedKey: reconciled.current,
        })
      )
        return;
      reconciled.current = `${stored!.linkSessionId}:${stored!.savedAt}`;
      const value: Completion = {
        userId: stored!.userId,
        linkSessionId: stored!.linkSessionId,
        mode: stored!.mode,
        exchangeableToken: stored!.exchangeableToken,
        recovery: true,
      };
      setPending(value);
      await run(async () => {
        const failure = await finalize(value);
        if (failure === 'expired') {
          // The server session is gone; nothing to resume.
          void clearPendingSaltEdge();
          setPending(null);
          connectEvent({ type: 'reset' });
          setMessage('Your last bank connection link expired. Connect your bank again.');
        }
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities.data?.bankConnectionEnabled, auth.user?.id, busy]);
  return (
    <View
      style={[
        onboarding ? styles.onboardingRoot : styles.root,
        connect.kind === 'success' && { flexGrow: 1 },
      ]}
    >
      <BankUnlinkSheet
        unlink={unlink}
        busy={busy}
        message={message}
        onClose={() => {
          if (!busy) setUnlink(null);
        }}
        onConfirm={() => {
          if (!unlink || busy) return;
          void run(async () => {
            await apiRequest(auth.getAccessToken, `/v1/bank/connections/${unlink.connection.id}`, {
              method: 'DELETE',
            });
            cache.setQueryData<{ items: Connection[] }>(
              ['live', auth.user?.id, '/v1/bank/connections'],
              (current) =>
                current
                  ? {
                      ...current,
                      items: current.items.map((connection) =>
                        connection.id === unlink.connection.id
                          ? { ...connection, disconnectRequested: true }
                          : connection,
                      ),
                    }
                  : current,
            );
            setUnlink(null);
          });
        }}
      />
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
        onRequestClose={() => {
          selectedRegion.current = null;
          setRegionPicker(false);
        }}
        onDismiss={startSelectedRegion}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SetupPage
            title="Where is your bank?"
            animateTitle={false}
            includeTopSafeArea={false}
            actions={null}
          >
            <View style={styles.regionList}>
              {REGIONS.map((region) => {
                const disabled = regionDisabled(region);
                const available = regionAvailable(region);
                const unavailableReason = !available
                  ? 'Coming soon'
                  : !supportsBankLink
                    ? 'Use the mobile app'
                    : !region.saltEdgeRegion && !regionCountry(region)
                      ? 'Not available for this account'
                      : null;
                return (
                  <Pressable
                    key={region.id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      unavailableReason
                        ? `${region.label}, ${unavailableReason}`
                        : `Connect a bank in ${region.label}`
                    }
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.regionRow,
                      {
                        backgroundColor: disabled ? colors.surface : '#FFFFFF',
                        borderColor: disabled ? colors.line : '#FFFFFF',
                        boxShadow: disabled ? undefined : '0 8px 20px rgba(0,0,0,0.18)',
                        opacity: disabled ? 0.42 : pressed ? 0.8 : 1,
                      },
                    ]}
                    onPress={() => {
                      selectedRegion.current = region;
                      setRegionPicker(false);
                      // UIKit must finish dismissing this picker before a bank
                      // SDK or navigator presents the provider's next sheet.
                      if (Platform.OS !== 'ios') startSelectedRegion();
                    }}
                  >
                    {() => (
                      <View style={styles.regionCopy}>
                        <Type style={[styles.regionLabel, !disabled && { color: '#1B1B1B' }]}>
                          {region.label}
                        </Type>
                        {unavailableReason ? (
                          <Type variant="caption" muted>
                            {unavailableReason}
                          </Type>
                        ) : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </SetupPage>
          {regionPicker ? <BankGlobeFooter onBack={() => setRegionPicker(false)} /> : null}
        </View>
      </Modal>
      <BankConnectingSheet
        step={connect}
        canFinalize={!!pending}
        onRetryLink={() => {
          connectEvent({ type: 'reset' });
          void run(async () => {
            await clearPendingSaltEdge(pending?.linkSessionId);
            setPending(null);
            beginBankSelection();
          });
        }}
        onRetryFinalize={() => {
          if (!pending) return;
          sheetDismissed.current = false;
          void run(async () => {
            const failure = await finalize(pending);
            if (failure === 'expired') {
              void clearPendingSaltEdge();
              setPending(null);
              connectEvent({ type: 'reset' });
              setMessage('This connection link expired. Connect your bank again.');
            }
          });
        }}
        onDismiss={() => {
          if (connect.kind === 'failed' && connect.reason === 'already_linked') {
            void clearPendingSaltEdge(pending?.linkSessionId);
            setPending(null);
          }
          sheetDismissed.current = true;
          connectEvent({ type: 'reset' });
        }}
      />
      {connect.kind !== 'success' ? (
        <>
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
          {message ? <Type accessibilityRole="alert">{message}</Type> : null}
          {pending && connect.kind === 'idle' && !busy ? (
            <TextButton
              title="Review bank connection"
              onPress={() => {
                sheetDismissed.current = false;
                void run(() => finalize(pending).then(() => {}));
              }}
            />
          ) : null}
          {[capabilities.error, connections.error, accounts.error]
            .filter(Boolean)
            .map((error, i) => (
              <Type key={i} accessibilityRole="alert">
                {error!.message}
              </Type>
            ))}
          {visibleConnections.map((connection) => {
            const ready =
              connection.status === 'healthy' &&
              connection.initialSyncComplete &&
              !connection.disconnectRequested;
            // Before the first sync completes the worker is still working the
            // connection (including retrying transient errors); raw statuses like
            // "linking" or "error" would read as a dead end mid-setup.
            const status = connection.disconnectRequested
              ? 'Disconnecting'
              : ready
                ? mockData.active
                  ? 'Sample'
                  : 'Connected'
                : connection.status === 'relink_required'
                  ? 'Reconnect needed'
                  : connection.status === 'error'
                    ? 'Sync delayed'
                    : 'Connected';
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
                    { flexWrap: largeText ? 'wrap' : 'nowrap' },
                    !onboarding && { borderBottomWidth: 0.5, borderColor: colors.line },
                  ]}
                >
                  <BankMark
                    name={connection.institutionName || 'Bank'}
                    uri={
                      connection.institutionAvatar ??
                      (connection.institutionName
                        ? (logos.data?.banks?.find(
                            (bank) => bank.name === connection.institutionName,
                          )?.uri ?? null)
                        : null)
                    }
                    fallbackUri={connection.institutionLogoFallback}
                  />
                  <Type
                    style={{
                      flex: 1,
                      minWidth: largeText ? 180 : undefined,
                      fontSize: 20,
                      fontWeight: '500',
                    }}
                    numberOfLines={largeText ? undefined : 2}
                  >
                    {connection.institutionName || 'Connected bank'}
                  </Type>
                  {onboarding ? (
                    <View
                      style={{
                        alignItems: 'flex-start',
                        width: largeText ? '100%' : undefined,
                        paddingLeft: largeText ? 56 : 0,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 12,
                          borderCurve: 'continuous',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Type variant="caption" style={{ color: '#1A1A1A', fontWeight: '600' }}>
                          {status}
                        </Type>
                      </View>
                    </View>
                  ) : (
                    <Type
                      variant="caption"
                      muted
                      numberOfLines={largeText ? undefined : 1}
                      style={
                        largeText ? { width: '100%', paddingLeft: 56 } : styles.connectionStatus
                      }
                    >
                      {status}
                    </Type>
                  )}
                </View>
                {!connection.initialSyncComplete && !connection.disconnectRequested ? (
                  <BankInitialSyncStatus status={connection.status} />
                ) : null}

                {accounts.data?.items
                  .filter((a) => a.connectionId === connection.id)
                  .map((account) => {
                    const label = bankAccountLabel(account);
                    return (
                      <View
                        key={account.id}
                        style={[
                          styles.listRow,
                          !onboarding && { borderBottomWidth: 0.5, borderColor: colors.line },
                          { paddingVertical: 8 },
                        ]}
                      >
                        <View
                          accessible={false}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          style={[styles.currencyMark, { backgroundColor: colors.soft }]}
                        >
                          <Type
                            maxFontSizeMultiplier={1.2}
                            style={{
                              fontSize: currencySymbol(account.currency).length >= 3 ? 14 : 21,
                              fontWeight: '400',
                            }}
                          >
                            {currencySymbol(account.currency)}
                          </Type>
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Type numberOfLines={2}>{label.name}</Type>
                          <Type variant="caption" muted>
                            {label.detail} ·{' '}
                            {bankAccountState(
                              account.enabled,
                              connection.status,
                              connection.initialSyncComplete,
                            )}
                          </Type>
                        </View>
                      </View>
                    );
                  })}
                {!connection.disconnectRequested ? (
                  <>
                    {/* A first link that hits an error is retried by the worker on
                    its own; prompting a reconnect mid-setup only misleads. */}
                    {connection.status === 'relink_required' ||
                    (connection.status === 'error' && connection.initialSyncComplete) ? (
                      onboarding ? (
                        <Button
                          title="Reconnect bank"
                          appearance="onboarding"
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
                Refresh accounts
              </Type>
              {connections.isFetching || accounts.isFetching ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : null}
            </Pressable>
          ) : null}

          {!statusActive &&
          !onboarding &&
          !hideConnectAction &&
          capabilities.data?.bankConnectionEnabled ? (
            <View style={styles.connectAction}>
              <Button
                appearance="onboarding"
                title={visibleConnections.length ? 'Connect another bank' : 'Connect bank'}
                disabled={busy || !supportsBankLink}
                loading={busy}
                onPress={() => (supportsBankLink ? beginBankSelection() : void run(() => link()))}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  onboardingRoot: { gap: 14 },
  // Stretches so the Connect a bank action can pin to the bottom of the screen.
  root: { gap: 14, flex: 1 },
  connectAction: { marginTop: 'auto', paddingTop: 8 },
  currencyMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
