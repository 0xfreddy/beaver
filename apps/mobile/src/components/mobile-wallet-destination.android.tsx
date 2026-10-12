import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import type { WithdrawalDestinationChallenge, WithdrawalDestinationProof } from '@roundups/types';
import type { MobileWalletDestinationProps } from './mobile-wallet-destination';
import { Button, Type } from './ui';
import { useAuth } from '../providers/auth-provider';
import { useMockData } from '../providers/mock-data-provider';
import { isBypassUserId } from '../lib/review-auth';
import { ApiError, apiRequest, withRequestTimeout } from '../lib/api';
import { signWalletDestination } from '../lib/mobile-wallet-client.android';
import { destinationProofIsCurrent } from '../lib/mobile-wallet-proof';

export function MobileWalletDestination(props: MobileWalletDestinationProps) {
  const auth = useAuth();
  const mock = useMockData();
  if (!mock.ready || mock.active || !auth.user || isBypassUserId(auth.user.id)) return null;
  return <WalletDestination key={auth.user.id} {...props} />;
}

function WalletDestination({ disabled, onVerified, onBusy }: MobileWalletDestinationProps) {
  const auth = useAuth();
  const active = useRef(true);
  const locked = useRef(false);
  const callbacks = useRef({ onVerified, onBusy });
  callbacks.current = { onVerified, onBusy };
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      callbacks.current.onBusy(false);
    };
  }, []);
  const network = process.env.EXPO_PUBLIC_SOLANA_NETWORK === 'mainnet' ? 'mainnet' : 'devnet';
  const verification = useMutation({
    mutationFn: async () => {
      const post = <T,>(path: string, body: unknown) =>
        withRequestTimeout(
          (signal) =>
            apiRequest<T>(auth.getAccessToken, path, {
              method: 'POST',
              body: JSON.stringify(body),
              signal,
            }),
          15_000,
        );
      const { challenge, signature } = await signWalletDestination(
        network,
        (address) =>
          post<WithdrawalDestinationChallenge>('/v1/withdrawal-destinations/challenge', {
            address,
          }),
        () => active.current,
      );
      if (!active.current) throw new Error('Wallet verification cancelled.');
      const proof = await post<WithdrawalDestinationProof>('/v1/withdrawal-destinations/verify', {
        id: challenge.id,
        signature,
      });
      if (
        proof.id !== challenge.id ||
        !destinationProofIsCurrent(proof, challenge.address, network)
      )
        throw new Error('The verified destination does not match. Try again.');
      return proof;
    },
    onSuccess: (proof) => {
      if (active.current) callbacks.current.onVerified(proof);
    },
    onSettled: () => {
      locked.current = false;
      if (active.current) callbacks.current.onBusy(false);
    },
  });
  return (
    <View style={{ gap: 8 }}>
      <Button
        title={verification.isPending ? 'Verify in your wallet…' : 'Use my wallet'}
        disabled={disabled || verification.isPending}
        onPress={() => {
          if (disabled || locked.current) return;
          locked.current = true;
          callbacks.current.onBusy(true);
          verification.mutate();
        }}
      />
      <Type variant="caption" muted>
        Connect a Solana wallet and sign a message to verify your receiving address. No funds move
        during verification.
      </Type>
      {verification.error ? (
        <Type accessibilityRole="alert">
          {verification.error instanceof ApiError && verification.error.status === 404
            ? 'Wallet verification is not available on this service yet. You can enter an address below.'
            : 'Wallet verification did not complete. Unlock a compatible wallet and try again, or enter an address below.'}
        </Type>
      ) : null}
    </View>
  );
}
