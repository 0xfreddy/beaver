export type DepositAsset = 'USDC' | 'SOL';

export type DepositOption = {
  asset: DepositAsset;
  caip2: string;
  name: string;
  iconUrl: string | null;
  tokenAddress: string | null;
  decimals: number;
};

export type DepositInstruction = {
  id: string | null;
  address: string;
  sourceChain: string;
  createdAt: string;
  estimatedSeconds: number;
};

export const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const SOLANA_DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export function devnetDepositOptions(): DepositOption[] {
  return [
    {
      asset: 'USDC',
      caip2: SOLANA_DEVNET_CAIP2,
      name: 'Solana Devnet',
      iconUrl: null,
      tokenAddress: SOLANA_DEVNET_USDC_MINT,
      decimals: 6,
    },
    {
      asset: 'SOL',
      caip2: SOLANA_DEVNET_CAIP2,
      name: 'Solana Devnet',
      iconUrl: null,
      tokenAddress: null,
      decimals: 9,
    },
  ];
}

export function depositBalanceRaw(
  balances: { onchainUsdcRaw?: string; usdcRaw: string; lamports: string },
  asset: DepositAsset,
) {
  return BigInt(
    asset === 'USDC' ? (balances.onchainUsdcRaw ?? balances.usdcRaw) : balances.lamports,
  );
}

export function formatDepositAmount(raw: bigint | string, asset: DepositAsset, decimals: number) {
  const amount = typeof raw === 'bigint' ? raw : BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''} ${asset}`;
}
