/** Solana explorer links follow the build's cluster; mainnet needs no suffix. */
export function solscanTxUrl(signature: string) {
  const network = process.env.EXPO_PUBLIC_SOLANA_NETWORK?.trim();
  const cluster =
    network === 'mainnet' || network === 'mainnet-beta' ? '' : `?cluster=${network ?? 'devnet'}`;
  return `https://solscan.io/tx/${encodeURIComponent(signature)}${cluster}`;
}
