import { Buffer } from 'buffer';
import { describe, expect, it } from 'vitest';
import {
  assertDestinationChallenge,
  destinationProofIsCurrent,
  walletMessageSignature,
} from './mobile-wallet-proof';

describe('MWA destination proofs', () => {
  it('extracts only a signature appended to the exact challenge bytes', () => {
    const message = 'Beaver verification — no transfer';
    const signature = Buffer.alloc(64, 9);
    expect(walletMessageSignature(message, Buffer.concat([Buffer.from(message), signature]))).toBe(
      signature.toString('base64'),
    );
    expect(() =>
      walletMessageSignature(message, Buffer.concat([Buffer.from(message + '!'), signature])),
    ).toThrow();
    expect(() => walletMessageSignature(message, signature)).toThrow();
    expect(() => walletMessageSignature(message, undefined)).toThrow();
  });
  it('binds the challenge to its destination, nonce, network and expiration', () => {
    const challenge = {
      id: 'nonce',
      address: 'wallet',
      network: 'devnet' as const,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      message:
        'trybeaver.app — Verify withdrawal destination\nWallet: wallet\nNetwork: solana:devnet\nNonce: nonce\n',
    };
    expect(() => assertDestinationChallenge(challenge, 'wallet', 'devnet')).not.toThrow();
    expect(() => assertDestinationChallenge(challenge, 'other', 'devnet')).toThrow();
    expect(() => assertDestinationChallenge(challenge, 'wallet', 'mainnet')).toThrow();
    expect(() =>
      assertDestinationChallenge({ ...challenge, expiresAt: 'invalid' }, 'wallet', 'devnet'),
    ).toThrow();
    expect(destinationProofIsCurrent(challenge, 'wallet', 'devnet')).toBe(true);
    expect(
      destinationProofIsCurrent({ ...challenge, expiresAt: '2000-01-01' }, 'wallet', 'devnet'),
    ).toBe(false);
    expect(destinationProofIsCurrent(challenge, 'other', 'devnet')).toBe(false);
  });
});
