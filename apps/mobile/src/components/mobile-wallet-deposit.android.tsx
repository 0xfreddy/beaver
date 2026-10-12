import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Linking, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { MobileWalletDepositProps } from './mobile-wallet-deposit';
import { Button, Type } from './ui';
import { useTheme } from '../theme';
import { useAuth } from '../providers/auth-provider';
import { useMockData } from '../providers/mock-data-provider';
import { isBypassUserId } from '../lib/review-auth';
import { apiRequest, withRequestTimeout } from '../lib/api';
import type { FundingDetails } from '../lib/live';
import { formatDepositAmount } from '../lib/deposit-options';
import {
  broadcastWalletDeposit,
  clearFinishedDeposit,
  depositExplorerUrl,
  depositNetworks,
  loadWalletDeposit,
  parseDepositAmount,
  startWalletDeposit,
  walletDepositStatus,
  type DepositNetwork,
} from '../lib/mobile-wallet-deposit';
import { signWalletDeposit, walletDepositConnection } from '../lib/mobile-wallet-client.android';

export function MobileWalletDeposit(props: MobileWalletDepositProps) {
  const auth = useAuth();
  const mock = useMockData();
  if (props.option.asset !== 'USDC') return null;
  if (mock.active || !mock.ready || !auth.user || isBypassUserId(auth.user.id))
    return <Type muted>Wallet deposits are available when signed into a live Beaver account.</Type>;
  const network: DepositNetwork =
    process.env.EXPO_PUBLIC_SOLANA_NETWORK === 'mainnet' ? 'mainnet' : 'devnet';
  if (
    props.instruction.address !== auth.user.walletAddress ||
    props.option.caip2 !== `solana:${depositNetworks[network].genesis.slice(0, 32)}` ||
    props.option.tokenAddress !== depositNetworks[network].mint
  )
    return null;
  return (
    <WalletDepositForm
      key={`${auth.user.id}:${network}:${props.instruction.address}`}
      {...props}
      network={network}
    />
  );
}

function WalletDepositForm({
  instruction,
  network,
  onConfirmed,
}: MobileWalletDepositProps & { network: DepositNetwork }) {
  const { colors } = useTheme();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [editing, setEditing] = useState(false);
  const current = useRef(true);
  const notified = useRef<string | null>(null);
  const confirmedCallback = useRef(onConfirmed);
  confirmedCallback.current = onConfirmed;
  const queryKey = ['mwa-deposit', auth.user?.id, network, instruction.address];
  // Construct the RPC only inside requests: a bad deployment URL becomes a recoverable inline error.
  const saved = useQuery({
    queryKey,
    queryFn: () => loadWalletDeposit(AsyncStorage, network, instruction.address),
    staleTime: 0,
    retry: false,
  });
  const pending = saved.data;
  const status = useQuery({
    queryKey: [...queryKey, pending?.signature, 'status'],
    enabled: !!pending,
    queryFn: () => walletDepositStatus(walletDepositConnection(network), pending!),
    refetchInterval: (query) =>
      query.state.data && query.state.data !== 'pending' ? false : 4_000,
    retry: false,
  });
  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: ['mwa-deposit'] });
    });
    return () => subscription.remove();
  }, [queryClient]);
  useEffect(() => {
    if (status.data === 'finalized' && pending && notified.current !== pending.signature) {
      notified.current = pending.signature;
      confirmedCallback.current();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [status.data, pending]);
  const send = useMutation({
    mutationFn: async () => {
      Keyboard.dismiss();
      const funding = await withRequestTimeout(
        (signal) => apiRequest<FundingDetails>(auth.getAccessToken, '/v1/funding', { signal }),
        15_000,
      );
      return startWalletDeposit({
        storage: AsyncStorage,
        rpc: walletDepositConnection(network),
        funding,
        destination: instruction.address,
        network,
        amount,
        isCurrent: () => current.current,
        sign: (prepare) => signWalletDeposit(network, prepare),
      });
    },
    onSuccess: (deposit) => {
      queryClient.setQueryData(queryKey, deposit);
    },
    onSettled: () => {
      void saved.refetch();
    },
    retry: false,
  });
  const recover = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      const rpc = walletDepositConnection(network);
      if ((await walletDepositStatus(rpc, pending)) === 'pending')
        await broadcastWalletDeposit(rpc, pending);
    },
    onSettled: () => {
      void status.refetch();
    },
    retry: false,
  });
  const reset = useMutation({
    mutationFn: async () => {
      if (pending)
        await clearFinishedDeposit(AsyncStorage, walletDepositConnection(network), pending);
    },
    onSuccess: async () => {
      send.reset();
      recover.reset();
      setAmount('');
      setEditing(false);
      await saved.refetch();
    },
    retry: false,
  });
  const busy = send.isPending || recover.isPending || reset.isPending;
  let validAmount = false;
  try {
    parseDepositAmount(amount);
    validAmount = true;
  } catch {
    /* Render inline guidance. */
  }
  const error = send.error || recover.error || reset.error || saved.error || status.error;
  const terminal = status.data && status.data !== 'pending';

  return (
    <View style={{ gap: 12, paddingVertical: 16 }}>
      <Type variant="headline">Deposit from wallet</Type>
      {pending ? (
        <>
          <Type accessibilityLiveRegion="polite" variant="headline">
            {status.data === 'finalized'
              ? 'Transfer confirmed'
              : status.data === 'failed'
                ? 'Transfer failed'
                : status.data === 'expired'
                  ? 'Transfer expired'
                  : 'Checking your transfer…'}
          </Type>
          <Type muted>
            {formatDepositAmount(pending.amountRaw, 'USDC', 6)} ·{' '}
            {network === 'mainnet' ? 'Solana' : 'Solana Devnet'}
          </Type>
          <Type muted>
            {status.data === 'finalized'
              ? 'Confirmed on Solana. Your Beaver balance updates after the deposit is verified.'
              : terminal
                ? 'No USDC was deposited by this transfer. You can start again.'
                : 'Keep this transfer while confirmation is pending. Retrying sends the same signed transfer.'}
          </Type>
          <Button
            secondary
            title="View on Solana Explorer"
            onPress={() => void Linking.openURL(depositExplorerUrl(pending)).catch(() => {})}
          />
          {terminal ? (
            <Button
              title="Make another deposit"
              loading={reset.isPending}
              disabled={busy}
              onPress={() => reset.mutate()}
            />
          ) : (
            <Button
              secondary
              title="Check and retry transfer"
              loading={recover.isPending}
              disabled={busy}
              onPress={() => recover.mutate()}
            />
          )}
        </>
      ) : editing ? (
        <>
          <Type muted>
            Choose an amount, then approve it in your wallet. Keep some SOL there for network fees.
          </Type>
          <Type variant="caption">
            Amount in USDC{network === 'devnet' ? ' · Devnet test tokens' : ''}
          </Type>
          <TextInput
            accessibilityLabel="Deposit amount in USDC"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={setAmount}
            editable={!busy}
            keyboardType="decimal-pad"
            autoCorrect={false}
            maxLength={22}
            style={{
              minHeight: 52,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 12,
              padding: 14,
              color: colors.ink,
              fontSize: 24,
            }}
          />
          {amount.length > 0 && !validAmount ? (
            <Type muted>Enter a positive amount with up to 6 decimal places.</Type>
          ) : null}
          <Type variant="caption" muted>
            To your Beaver wallet
          </Type>
          <Type selectable variant="caption">
            {instruction.address}
          </Type>
          <Button
            title={send.isPending ? 'Continue in your wallet…' : 'Continue in wallet'}
            loading={send.isPending}
            disabled={!validAmount || busy || saved.isPending || !!saved.error}
            onPress={() => send.mutate()}
          />
          <Button
            secondary
            title="Cancel"
            disabled={busy}
            onPress={() => {
              setEditing(false);
              send.reset();
            }}
          />
        </>
      ) : (
        <>
          <Type muted>
            Transfer USDC from a Solana wallet installed on this phone
            {network === 'devnet' ? ' using Devnet test tokens' : ''}.
          </Type>
          <Button
            title="Deposit from wallet"
            loading={saved.isPending}
            disabled={saved.isPending || !!saved.error}
            onPress={() => setEditing(true)}
          />
        </>
      )}
      {error ? (
        <Type accessibilityRole="alert" muted>
          {depositErrorMessage(error)}
        </Type>
      ) : null}
      {saved.error ? (
        <Button secondary title="Check saved transfer" onPress={() => void saved.refetch()} />
      ) : null}
    </View>
  );
}

function depositErrorMessage(error: Error) {
  const code = 'code' in error ? error.code : null;
  if (code === 'ERROR_WALLET_NOT_FOUND')
    return 'Install a Solana Mobile Wallet Adapter compatible wallet, then try again. You can also use the deposit address below.';
  if (code === -1 || code === -3 || code === 'ERROR_ASSOCIATION_CANCELLED')
    return 'The wallet request was not approved. You can try again when ready.';
  if (error.name === 'AbortError' || error.name === 'TimeoutError')
    return 'The connection timed out. Check the transfer status before trying again.';
  // SDK transport messages may include RPC URLs; keep those out of the interface.
  if (/https?:|fetch|network request|429|403|timed out/i.test(error.message))
    return 'Solana is temporarily unreachable. Your saved transfer will be checked when the connection returns.';
  return error.message || 'The wallet request could not be completed. Please try again.';
}
