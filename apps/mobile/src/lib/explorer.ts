/** Explorer links follow the build's cluster: mainnet opens Orb, everything else Solscan. */
export function explorerTxUrl(signature: string) {
  const network = process.env.EXPO_PUBLIC_SOLANA_NETWORK?.trim();
  if (network === 'mainnet' || network === 'mainnet-beta')
    return `https://orbmarkets.io/tx/${encodeURIComponent(signature)}`;
  return `https://solscan.io/tx/${encodeURIComponent(signature)}?cluster=${network ?? 'devnet'}`;
}

/** Button labels name whichever explorer the build's links open. */
export function explorerName() {
  const network = process.env.EXPO_PUBLIC_SOLANA_NETWORK?.trim();
  return network === 'mainnet' || network === 'mainnet-beta' ? 'Orb' : 'Solscan';
}
