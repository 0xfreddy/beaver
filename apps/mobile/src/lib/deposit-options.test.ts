import { describe, expect, it } from 'vitest';
import {
  depositBalanceRaw,
  devnetDepositOptions,
  formatDepositAmount,
  SOLANA_DEVNET_CAIP2,
  SOLANA_DEVNET_USDC_MINT,
} from './deposit-options';

describe('Solana Devnet deposit options', () => {
  it('offers native SOL and Circle Devnet USDC at the same wallet destination', () => {
    expect(devnetDepositOptions()).toEqual([
      expect.objectContaining({
        asset: 'USDC',
        caip2: SOLANA_DEVNET_CAIP2,
        tokenAddress: SOLANA_DEVNET_USDC_MINT,
        decimals: 6,
      }),
      expect.objectContaining({
        asset: 'SOL',
        caip2: SOLANA_DEVNET_CAIP2,
        tokenAddress: null,
        decimals: 9,
      }),
    ]);
  });

  it('uses the selected asset balance for authoritative receipt detection', () => {
    const balances = {
      onchainUsdcRaw: '1250000',
      usdcRaw: '1000000',
      lamports: '50000000',
    };
    expect(depositBalanceRaw(balances, 'USDC')).toBe(1_250_000n);
    expect(depositBalanceRaw(balances, 'SOL')).toBe(50_000_000n);
  });

  it('falls back to the legacy USDC field while an older backend is being upgraded', () => {
    expect(depositBalanceRaw({ usdcRaw: '900000', lamports: '0' }, 'USDC')).toBe(900_000n);
  });

  it('formats token base units without losing precision', () => {
    expect(formatDepositAmount('1250000', 'USDC', 6)).toBe('1.25 USDC');
    expect(formatDepositAmount(50_000_000n, 'SOL', 9)).toBe('0.05 SOL');
  });
});
