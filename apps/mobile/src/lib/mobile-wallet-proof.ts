import { Buffer } from 'buffer';
import type { WithdrawalDestinationChallenge, WithdrawalDestinationProof } from '@roundups/types';

export function assertDestinationChallenge(
  challenge: WithdrawalDestinationChallenge,
  address: string,
  network: string,
) {
  if (
    challenge.address !== address ||
    challenge.network !== network ||
    !challenge.id ||
    !Number.isFinite(Date.parse(challenge.expiresAt)) ||
    Date.parse(challenge.expiresAt) <= Date.now() ||
    !challenge.message.startsWith('trybeaver.app — Verify withdrawal destination\n') ||
    !challenge.message.includes(`Wallet: ${address}\n`) ||
    !challenge.message.includes(`Network: solana:${network}\n`) ||
    !challenge.message.includes(`Nonce: ${challenge.id}\n`)
  )
    throw new Error('The wallet verification request does not match this destination. Try again.');
}

/** MWA returns the original message followed by one 64-byte Ed25519 signature. */
export function walletMessageSignature(message: string, signed: Uint8Array | undefined) {
  const expected = Buffer.from(message, 'utf8');
  if (
    !signed ||
    signed.length !== expected.length + 64 ||
    !expected.equals(Buffer.from(signed.subarray(0, expected.length)))
  )
    throw new Error('The wallet returned a different verification message. Try again.');
  return Buffer.from(signed.subarray(expected.length)).toString('base64');
}

export function destinationProofIsCurrent(
  proof: WithdrawalDestinationProof,
  address: string,
  network: string,
) {
  return (
    proof.address === address &&
    proof.network === network &&
    Date.parse(proof.expiresAt) > Date.now()
  );
}
