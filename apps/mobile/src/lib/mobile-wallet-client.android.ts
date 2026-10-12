import { assertDestinationChallenge, walletMessageSignature } from './mobile-wallet-proof';
import { Buffer } from 'buffer';
import { Connection, PublicKey, type Transaction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { depositNetworks, type DepositNetwork } from './mobile-wallet-deposit';

export function walletDepositConnection(network: DepositNetwork) {
  const endpoint = process.env.EXPO_PUBLIC_SOLANA_RPC_URL?.trim() || depositNetworks[network].rpc;
  if (new URL(endpoint).protocol !== 'https:')
    throw new Error('The Solana RPC URL must use HTTPS.');
  return new Connection(endpoint, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    fetchMiddleware: (url, options, next) => {
      next(url, { ...options, signal: AbortSignal.timeout(15_000) });
    },
  });
}

export async function signWalletDeposit(
  network: DepositNetwork,
  prepare: (sender: PublicKey) => Promise<Transaction>,
) {
  return transact(async (wallet) => {
    const authorization = await wallet.authorize({
      chain: depositNetworks[network].chain,
      identity: { name: 'Beaver', uri: 'https://trybeaver.app' },
    });
    const account = authorization.accounts[0];
    if (!account) throw new Error('The wallet did not share an account.');
    const capabilities = await wallet.getCapabilities();
    if (!capabilities.features.includes('solana:signTransactions'))
      throw new Error(
        'This wallet does not support signing deposit transfers. Choose another compatible wallet or use the deposit address.',
      );
    const sender = new PublicKey(Buffer.from(account.address, 'base64'));
    const transaction = await prepare(sender);
    const [signed] = await wallet.signTransactions({ transactions: [transaction] });
    if (!signed) throw new Error('The wallet did not return a signed transfer.');
    return signed;
  });
}

export async function signWalletDestination(
  network: DepositNetwork,
  challengeFor: (
    address: string,
  ) => Promise<import('@roundups/types').WithdrawalDestinationChallenge>,
  active: () => boolean,
) {
  return transact(async (wallet) => {
    const authorization = await wallet.authorize({
      chain: depositNetworks[network].chain,
      identity: { name: 'Beaver', uri: 'https://trybeaver.app' },
    });
    if (!active()) throw new Error('Wallet verification cancelled.');
    const account = authorization.accounts[0];
    if (!account) throw new Error('The wallet did not share an account.');
    const address = new PublicKey(Buffer.from(account.address, 'base64')).toBase58();
    const challenge = await challengeFor(address);
    assertDestinationChallenge(challenge, address, network);
    if (!active()) throw new Error('Wallet verification cancelled.');
    const [signed] = await wallet.signMessages({
      addresses: [account.address],
      payloads: [Buffer.from(challenge.message, 'utf8')],
    });
    if (!active()) throw new Error('Wallet verification cancelled.');
    return { challenge, signature: walletMessageSignature(challenge.message, signed) };
  });
}
