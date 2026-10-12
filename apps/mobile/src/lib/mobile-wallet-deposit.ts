import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { PublicKey, Transaction, type Connection } from '@solana/web3.js';
import {
  ACCOUNT_SIZE,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from '@solana/spl-token';
import type { FundingDetails } from './live';

export const depositNetworks = {
  mainnet: {
    chain: 'solana:mainnet',
    genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    rpc: 'https://api.mainnet-beta.solana.com',
  },
  devnet: {
    chain: 'solana:devnet',
    genesis: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    rpc: 'https://api.devnet.solana.com',
  },
} as const;
export type DepositNetwork = keyof typeof depositNetworks;
export type WalletDeposit = {
  version: 1;
  network: DepositNetwork;
  destination: string;
  amountRaw: string;
  signature: string;
  signedTransaction: string;
  lastValidBlockHeight: number;
};
export type DepositStatus = 'pending' | 'finalized' | 'failed' | 'expired';
export type DepositStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type DepositRpc = Pick<
  Connection,
  | 'getGenesisHash'
  | 'getAccountInfo'
  | 'getBalance'
  | 'getLatestBlockhash'
  | 'getMinimumBalanceForRentExemption'
  | 'getFeeForMessage'
  | 'sendRawTransaction'
  | 'getSignatureStatuses'
  | 'getBlockHeight'
>;

/** Never pass a floating-point UI amount to an SPL instruction. */
export function parseDepositAmount(input: string): bigint {
  const value = input.trim().replace(',', '.');
  if (!/^\d{1,14}(?:\.\d{1,6})?$/.test(value))
    throw new Error('Enter a USDC amount with up to 6 decimal places.');
  const [whole = '0', fraction = ''] = value.split('.');
  const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (raw <= 0n || raw > 18_446_744_073_709_551_615n)
    throw new Error('Enter a positive USDC amount within the transfer limit.');
  return raw;
}

export function validateDepositFunding(
  funding: FundingDetails,
  destination: string,
  network: DepositNetwork,
) {
  if (
    funding.address !== destination ||
    funding.chain !== 'solana' ||
    funding.network !== network ||
    funding.asset !== 'USDC' ||
    funding.decimals !== 6 ||
    funding.mint !== depositNetworks[network].mint
  )
    throw new Error('Your deposit details changed. Close this screen and open Add money again.');
  const address = new PublicKey(destination);
  if (!PublicKey.isOnCurve(address.toBytes()))
    throw new Error('Your Beaver wallet address is invalid.');
}

export function depositStorageKey(network: DepositNetwork, destination: string) {
  return `beaver:mwa-deposit:v1:${network}:${destination}`;
}

export async function loadWalletDeposit(
  storage: DepositStorage,
  network: DepositNetwork,
  destination: string,
): Promise<WalletDeposit | null> {
  const raw = await storage.getItem(depositStorageKey(network, destination));
  if (!raw) return null;
  const value: WalletDeposit = JSON.parse(raw);
  // Fail closed on damaged storage; never silently replace a potentially sent transfer.
  if (
    value.version !== 1 ||
    value.network !== network ||
    value.destination !== destination ||
    !/^[1-9]\d*$/.test(value.amountRaw) ||
    typeof value.signedTransaction !== 'string' ||
    typeof value.signature !== 'string' ||
    !Number.isSafeInteger(value.lastValidBlockHeight) ||
    value.lastValidBlockHeight < 0
  )
    throw new Error(
      'The saved transfer could not be read. Check your wallet activity before depositing again.',
    );
  const signed = Transaction.from(Buffer.from(value.signedTransaction, 'base64'));
  if (
    !signed.signature ||
    bs58.encode(signed.signature) !== value.signature ||
    !signed.verifySignatures()
  )
    throw new Error('The saved transfer could not be verified. Check your wallet activity.');
  if (
    !signed.feePayer ||
    !signed.recentBlockhash ||
    BigInt(value.amountRaw) > 18_446_744_073_709_551_615n
  )
    throw new Error('The saved transfer details are invalid. Check your wallet activity.');
  const expected = buildDepositTransaction(
    signed.feePayer,
    new PublicKey(destination),
    network,
    BigInt(value.amountRaw),
    signed.recentBlockhash,
  );
  if (!signed.serializeMessage().equals(expected.serializeMessage()))
    throw new Error('The saved transfer does not match this deposit. Check your wallet activity.');
  return value;
}

export async function verifyDepositNetwork(rpc: DepositRpc, network: DepositNetwork) {
  if ((await rpc.getGenesisHash()) !== depositNetworks[network].genesis)
    throw new Error('The Solana connection is on the wrong network. No transfer was sent.');
}

export function buildDepositTransaction(
  sender: PublicKey,
  destination: PublicKey,
  network: DepositNetwork,
  amount: bigint,
  blockhash: string,
) {
  if (sender.equals(destination))
    throw new Error('Choose the external wallet you want to deposit from.');
  const mint = new PublicKey(depositNetworks[network].mint);
  const source = getAssociatedTokenAddressSync(mint, sender);
  const target = getAssociatedTokenAddressSync(mint, destination);
  return new Transaction({ feePayer: sender, recentBlockhash: blockhash }).add(
    createAssociatedTokenAccountIdempotentInstruction(sender, target, destination, mint),
    createTransferCheckedInstruction(source, mint, target, sender, amount, 6),
  );
}

export async function prepareWalletDeposit(
  rpc: DepositRpc,
  sender: PublicKey,
  destination: string,
  network: DepositNetwork,
  amount: bigint,
) {
  const mint = new PublicKey(depositNetworks[network].mint);
  const owner = new PublicKey(destination);
  const source = getAssociatedTokenAddressSync(mint, sender);
  const target = getAssociatedTokenAddressSync(mint, owner);
  const [sourceInfo, targetInfo, lamports, block] = await Promise.all([
    rpc.getAccountInfo(source, 'confirmed'),
    rpc.getAccountInfo(target, 'confirmed'),
    rpc.getBalance(sender, 'confirmed'),
    rpc.getLatestBlockhash('confirmed'),
  ]);
  if (!sourceInfo) throw new Error('This wallet has no USDC on the selected Solana network.');
  const account = unpackAccount(source, sourceInfo);
  if (!account.owner.equals(sender) || !account.mint.equals(mint) || account.isFrozen)
    throw new Error('This wallet’s USDC account cannot send deposits.');
  if (account.amount < amount) throw new Error('This wallet does not have enough USDC.');
  if (targetInfo) {
    const recipient = unpackAccount(target, targetInfo);
    if (!recipient.owner.equals(owner) || !recipient.mint.equals(mint) || recipient.isFrozen)
      throw new Error('Your Beaver USDC account cannot receive deposits right now.');
  }
  const transaction = buildDepositTransaction(sender, owner, network, amount, block.blockhash);
  const [fee, rent] = await Promise.all([
    rpc.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
    targetInfo
      ? Promise.resolve(0)
      : rpc.getMinimumBalanceForRentExemption(ACCOUNT_SIZE, 'confirmed'),
  ]);
  if (fee.value === null) throw new Error('The network fee is unavailable. Please try again.');
  if (lamports < fee.value + rent)
    throw new Error(
      'Keep some SOL in your external wallet for the network fee and USDC account setup.',
    );
  return { transaction, lastValidBlockHeight: block.lastValidBlockHeight };
}

const activeDeposits = new Set<string>();

/** Persist the verified signed bytes BEFORE broadcast. Recovery resends only these exact bytes. */
export async function startWalletDeposit(input: {
  storage: DepositStorage;
  rpc: DepositRpc;
  funding: FundingDetails;
  destination: string;
  network: DepositNetwork;
  amount: string;
  isCurrent(): boolean;
  sign(prepare: (sender: PublicKey) => Promise<Transaction>): Promise<Transaction>;
}): Promise<WalletDeposit> {
  const { storage, rpc, funding, destination, network } = input;
  const key = depositStorageKey(network, destination);
  if (activeDeposits.has(key)) throw new Error('A wallet request is already open.');
  activeDeposits.add(key);
  try {
    validateDepositFunding(funding, destination, network);
    const amount = parseDepositAmount(input.amount);
    if (await loadWalletDeposit(storage, network, destination))
      throw new Error('Check the previous transfer before starting another deposit.');
    await verifyDepositNetwork(rpc, network);
    if (!input.isCurrent()) throw new Error('Deposit cancelled. Open Add money to try again.');
    let expectedMessage: Buffer | undefined;
    let lastValidBlockHeight = 0;
    const signed = await input.sign(async (sender) => {
      if (!input.isCurrent()) throw new Error('Deposit cancelled. Open Add money to try again.');
      const prepared = await prepareWalletDeposit(rpc, sender, destination, network, amount);
      expectedMessage = prepared.transaction.serializeMessage();
      lastValidBlockHeight = prepared.lastValidBlockHeight;
      return prepared.transaction;
    });
    if (
      !expectedMessage ||
      !signed.serializeMessage().equals(expectedMessage) ||
      !signed.signature ||
      !signed.verifySignatures()
    )
      throw new Error('The wallet returned a different or invalid transfer. Nothing was sent.');
    const pending: WalletDeposit = {
      version: 1,
      network,
      destination,
      amountRaw: amount.toString(),
      signature: bs58.encode(signed.signature),
      signedTransaction: signed.serialize().toString('base64'),
      lastValidBlockHeight,
    };
    if (!input.isCurrent()) throw new Error('Deposit cancelled before sending.');
    await storage.setItem(key, JSON.stringify(pending));
    // Transport errors do not prove rejection. Keep the same signature available for recovery.
    if (input.isCurrent()) await broadcastWalletDeposit(rpc, pending).catch(() => {});
    return pending;
  } finally {
    activeDeposits.delete(key);
  }
}

export async function broadcastWalletDeposit(rpc: DepositRpc, deposit: WalletDeposit) {
  await verifyDepositNetwork(rpc, deposit.network);
  const signature = await rpc.sendRawTransaction(Buffer.from(deposit.signedTransaction, 'base64'), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  if (signature !== deposit.signature)
    throw new Error('The network returned an unexpected transfer signature.');
}

export async function walletDepositStatus(
  rpc: DepositRpc,
  deposit: WalletDeposit,
): Promise<DepositStatus> {
  await verifyDepositNetwork(rpc, deposit.network);
  // Get finalized height BEFORE status: a transaction could land while the height request runs.
  const height = await rpc.getBlockHeight('finalized');
  const {
    value: [status],
  } = await rpc.getSignatureStatuses([deposit.signature], { searchTransactionHistory: true });
  if (status?.confirmationStatus === 'finalized') return status.err ? 'failed' : 'finalized';
  if (status) return 'pending';
  return height > deposit.lastValidBlockHeight ? 'expired' : 'pending';
}

export async function clearFinishedDeposit(
  storage: DepositStorage,
  rpc: DepositRpc,
  deposit: WalletDeposit,
) {
  const key = depositStorageKey(deposit.network, deposit.destination);
  if (activeDeposits.has(key)) throw new Error('A wallet request is already open.');
  activeDeposits.add(key);
  try {
    const saved = await loadWalletDeposit(storage, deposit.network, deposit.destination);
    if (saved?.signature !== deposit.signature)
      throw new Error('The saved transfer changed. Close Add money and open it again.');
    const status = await walletDepositStatus(rpc, deposit);
    if (status === 'pending')
      throw new Error('This transfer is still pending. Check it again shortly.');
    await storage.removeItem(key);
  } finally {
    activeDeposits.delete(key);
  }
}

export function depositExplorerUrl(deposit: Pick<WalletDeposit, 'signature' | 'network'>) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(deposit.signature)}${deposit.network === 'devnet' ? '?cluster=devnet' : ''}`;
}
