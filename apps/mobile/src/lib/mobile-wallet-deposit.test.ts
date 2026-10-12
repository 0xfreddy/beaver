import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'buffer';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  ACCOUNT_SIZE,
  AccountLayout,
  AccountState,
  TOKEN_PROGRAM_ID,
  decodeTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  broadcastWalletDeposit,
  buildDepositTransaction,
  clearFinishedDeposit,
  depositNetworks,
  depositStorageKey,
  loadWalletDeposit,
  parseDepositAmount,
  prepareWalletDeposit,
  startWalletDeposit,
  validateDepositFunding,
  walletDepositStatus,
  type DepositRpc,
  type DepositStorage,
} from './mobile-wallet-deposit';
import type { FundingDetails } from './live';

const sender = Keypair.generate();
const destination = Keypair.generate().publicKey.toBase58();
const mint = new PublicKey(depositNetworks.devnet.mint);
const blockhash = Keypair.generate().publicKey.toBase58();
const funding: FundingDetails = {
  address: destination,
  asset: 'USDC',
  mint: mint.toBase58(),
  decimals: 6,
  chain: 'solana',
  network: 'devnet',
  acceptedAssets: [],
};

function tokenInfo(
  owner = sender.publicKey,
  amount = 100_000_000n,
  state = AccountState.Initialized,
) {
  const data = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return { data, owner: TOKEN_PROGRAM_ID, executable: false, lamports: 2_039_280 };
}

function fixture() {
  const entries = new Map<string, string>();
  const storage: DepositStorage = {
    getItem: vi.fn(async (key: string) => entries.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      entries.delete(key);
    }),
  };
  const rpc = {
    getGenesisHash: vi.fn(async () => depositNetworks.devnet.genesis as string),
    getAccountInfo: vi.fn(async (address: PublicKey) =>
      address.equals(getAssociatedTokenAddressSync(mint, sender.publicKey)) ? tokenInfo() : null,
    ),
    getBalance: vi.fn(async () => 10_000_000),
    getLatestBlockhash: vi.fn(async () => ({ blockhash, lastValidBlockHeight: 150 })),
    getMinimumBalanceForRentExemption: vi.fn(async () => 2_039_280),
    getFeeForMessage: vi.fn(async () => ({ context: { slot: 1 }, value: 5000 })),
    sendRawTransaction: vi.fn(async () => {
      throw new Error('transport disconnected');
    }),
    getSignatureStatuses: vi.fn<DepositRpc['getSignatureStatuses']>(async () => ({
      context: { slot: 1 },
      value: [null],
    })),
    getBlockHeight: vi.fn(async () => 100),
  };
  const sign = vi.fn(async (prepare: (address: PublicKey) => Promise<Transaction>) => {
    const transaction = await prepare(sender.publicKey);
    transaction.sign(sender);
    return transaction;
  });
  const input = {
    storage,
    rpc,
    funding,
    destination,
    network: 'devnet' as const,
    amount: '1.000001',
    isCurrent: () => true,
    sign,
  };
  return { storage, rpc, input, entries };
}

describe('wallet deposit amounts and destinations', () => {
  it('preserves micro-USDC and integers beyond floating-point precision', () => {
    expect(parseDepositAmount('1.000001')).toBe(1_000_001n);
    expect(parseDepositAmount('9007199254.740993')).toBe(9_007_199_254_740_993n);
    expect(parseDepositAmount('0,01')).toBe(10_000n);
  });
  it.each(['0', '-1', 'NaN', '1e3', '1.0000001', '1,000,000', '18446744073709.551616'])(
    'rejects invalid amount %s',
    (value) => {
      expect(() => parseDepositAmount(value)).toThrow();
    },
  );
  it('rejects mismatched backend identity, network and mint', () => {
    expect(() => validateDepositFunding(funding, destination, 'devnet')).not.toThrow();
    expect(() => validateDepositFunding(funding, sender.publicKey.toBase58(), 'devnet')).toThrow();
    expect(() => validateDepositFunding(funding, destination, 'mainnet')).toThrow();
    expect(() =>
      validateDepositFunding({ ...funding, mint: destination }, destination, 'devnet'),
    ).toThrow();
  });
  it('constructs only idempotent destination setup and the exact checked USDC transfer', () => {
    const transaction = buildDepositTransaction(
      sender.publicKey,
      new PublicKey(destination),
      'devnet',
      1_000_001n,
      blockhash,
    );
    expect(transaction.instructions).toHaveLength(2);
    const transfer = decodeTransferCheckedInstruction(transaction.instructions[1]!);
    expect(transfer.data.amount).toBe(1_000_001n);
    expect(transfer.data.decimals).toBe(6);
    expect(transfer.keys.mint.pubkey.equals(mint)).toBe(true);
    expect(
      transfer.keys.destination.pubkey.equals(
        getAssociatedTokenAddressSync(mint, new PublicKey(destination)),
      ),
    ).toBe(true);
    expect(transaction.feePayer?.equals(sender.publicKey)).toBe(true);
    expect(() =>
      buildDepositTransaction(sender.publicKey, sender.publicKey, 'devnet', 1n, blockhash),
    ).toThrow();
  });
});

describe('wallet deposit signing and recovery', () => {
  it('persists signed bytes before broadcast and retains them after an ambiguous network error', async () => {
    const { input, storage, rpc } = fixture();
    const deposit = await startWalletDeposit(input);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(vi.mocked(storage.setItem).mock.invocationCallOrder[0]).toBeLessThan(
      rpc.sendRawTransaction.mock.invocationCallOrder[0]!,
    );
    expect(await loadWalletDeposit(storage, 'devnet', destination)).toEqual(deposit);
    await expect(startWalletDeposit(input)).rejects.toThrow('previous transfer');
    expect(input.sign).toHaveBeenCalledOnce();
    await broadcastWalletDeposit(rpc, deposit).catch(() => {});
    expect(rpc.sendRawTransaction.mock.calls[0]).toEqual(rpc.sendRawTransaction.mock.calls[1]);
  });
  it('never broadcasts if persistent storage fails', async () => {
    const { input, storage, rpc } = fixture();
    vi.mocked(storage.setItem).mockRejectedValue(new Error('storage unavailable'));
    await expect(startWalletDeposit(input)).rejects.toThrow('storage unavailable');
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('does not sign against an RPC from a different cluster', async () => {
    const { input, rpc } = fixture();
    rpc.getGenesisHash.mockResolvedValue(depositNetworks.mainnet.genesis);
    await expect(startWalletDeposit(input)).rejects.toThrow('wrong network');
    expect(input.sign).not.toHaveBeenCalled();
  });
  it('checks USDC and SOL for rent/fees before signing', async () => {
    const { rpc } = fixture();
    await expect(
      prepareWalletDeposit(rpc, sender.publicKey, destination, 'devnet', 101_000_000n),
    ).rejects.toThrow('enough USDC');
    rpc.getBalance.mockResolvedValue(5000);
    await expect(
      prepareWalletDeposit(rpc, sender.publicKey, destination, 'devnet', 1n),
    ).rejects.toThrow('some SOL');
  });
  it('rejects frozen source accounts', async () => {
    const { rpc } = fixture();
    rpc.getAccountInfo.mockResolvedValue(
      tokenInfo(sender.publicKey, 100_000_000n, AccountState.Frozen),
    );
    await expect(
      prepareWalletDeposit(rpc, sender.publicKey, destination, 'devnet', 1n),
    ).rejects.toThrow('cannot send');
  });
  it('rejects a valid wallet signature over a modified transaction', async () => {
    const { input, rpc, storage } = fixture();
    input.sign.mockImplementation(async (prepare) => {
      const transaction = await prepare(sender.publicKey);
      transaction.instructions.pop();
      transaction.sign(sender);
      return transaction;
    });
    await expect(startWalletDeposit(input)).rejects.toThrow('different or invalid');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('cancellation never creates a pending deposit or broadcasts', async () => {
    const { input, storage, rpc } = fixture();
    input.sign.mockRejectedValue(new Error('cancelled'));
    await expect(startWalletDeposit(input)).rejects.toThrow('cancelled');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('does not broadcast if the account screen disappears during signing', async () => {
    const { input, rpc } = fixture();
    let active = true;
    input.isCurrent = () => active;
    input.sign.mockImplementation(async (prepare) => {
      const transaction = await prepare(sender.publicKey);
      transaction.sign(sender);
      active = false;
      return transaction;
    });
    await expect(startWalletDeposit(input)).rejects.toThrow('cancelled before sending');
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('serializes duplicate taps even before the first wallet has connected', async () => {
    const { input } = fixture();
    const first = startWalletDeposit(input);
    await expect(startWalletDeposit(input)).rejects.toThrow('already open');
    await first;
    expect(input.sign).toHaveBeenCalledOnce();
  });
  it('never permits a fresh transfer while confirmation is pending', async () => {
    const { input, rpc, storage } = fixture();
    const deposit = await startWalletDeposit(input);
    expect(await walletDepositStatus(rpc, deposit)).toBe('pending');
    await expect(clearFinishedDeposit(storage, rpc, deposit)).rejects.toThrow('still pending');
    rpc.getBlockHeight.mockResolvedValue(151);
    expect(await walletDepositStatus(rpc, deposit)).toBe('expired');
    await clearFinishedDeposit(storage, rpc, deposit);
    expect(await loadWalletDeposit(storage, 'devnet', destination)).toBeNull();
  });
  it('does not mistake confirmed or failed-but-unfinalized transactions for terminal outcomes', async () => {
    const { input, rpc } = fixture();
    const deposit = await startWalletDeposit(input);
    rpc.getBlockHeight.mockResolvedValue(200);
    rpc.getSignatureStatuses.mockResolvedValue({
      context: { slot: 1 },
      value: [
        {
          slot: 1,
          confirmations: 1,
          err: { InstructionError: [1, 'Custom'] },
          confirmationStatus: 'confirmed',
        },
      ],
    });
    expect(await walletDepositStatus(rpc, deposit)).toBe('pending');
    rpc.getSignatureStatuses.mockResolvedValue({
      context: { slot: 1 },
      value: [{ slot: 1, confirmations: null, err: null, confirmationStatus: 'finalized' }],
    });
    expect(await walletDepositStatus(rpc, deposit)).toBe('finalized');
    rpc.getSignatureStatuses.mockResolvedValue({
      context: { slot: 1 },
      value: [
        {
          slot: 1,
          confirmations: null,
          err: { InstructionError: [1, 'Custom'] },
          confirmationStatus: 'finalized',
        },
      ],
    });
    expect(await walletDepositStatus(rpc, deposit)).toBe('failed');
  });
  it('fails closed on corrupted recovery data and scopes storage by destination and network', async () => {
    const { storage, entries } = fixture();
    entries.set(depositStorageKey('devnet', destination), '{"version": 2}');
    await expect(loadWalletDeposit(storage, 'devnet', destination)).rejects.toThrow();
    expect(await loadWalletDeposit(storage, 'mainnet', destination)).toBeNull();
    expect(await loadWalletDeposit(storage, 'devnet', sender.publicKey.toBase58())).toBeNull();
  });
});
