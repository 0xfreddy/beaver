import type { CryptoCard, OnchainSpendingPreview } from '@roundups/types';
import type { Purchase } from './purchases';

export const cryptoProviderNames = { etherfi: 'EtherFi', tuyo: 'Tuyo' } as const;

type PreviewInput = OnchainSpendingPreview | readonly OnchainSpendingPreview[] | null;

export function purchasesFromOnchainPreview(preview: OnchainSpendingPreview | null): Purchase[] {
  if (!preview) return [];
  return preview.transactions.map((transaction) => ({
    id: `onchain:${preview.provider}:${transaction.id}`,
    amountCents: transaction.amountCents,
    currency: 'USD',
    merchant: 'Card purchase',
    occurredAt: transaction.occurredAt,
    pending: false,
    removedAt: null,
    reason: null,
    historicalPreview: true,
    roundupCents: transaction.roundupCents,
    symbol: null,
    roundupStatus: 'preview',
    sourceName: cryptoProviderNames[preview.provider],
    chainHash: transaction.id,
    cryptoCardProvider: preview.provider,
  }));
}

/** Combines bank activity with the card activity already discovered during onboarding. */
export function recentPurchases(
  bankPurchases: readonly Purchase[],
  preview: PreviewInput,
  limit = 3,
) {
  const previews = Array.isArray(preview) ? preview : preview ? [preview] : [];
  // Synced card spends already arrive through the transactions API; drop their preview twins.
  const synced = new Set(
    bankPurchases.flatMap((item) => (item.chainHash ? [item.chainHash] : [])),
  );
  const unique = new Map<string, Purchase>();
  for (const item of [
    ...bankPurchases,
    ...previews.flatMap((preview) =>
      purchasesFromOnchainPreview(preview).filter(
        (purchase) => !purchase.chainHash || !synced.has(purchase.chainHash),
      ),
    ),
  ])
    unique.set(item.id, item);
  return [...unique.values()]
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
        right.id.localeCompare(left.id),
    )
    .slice(0, limit);
}

/** The preview API accepts at most eight addresses in one request. */
export function cryptoPreviewRequests(cards: readonly CryptoCard[]) {
  const groups = new Map<CryptoCard['provider'], Set<string>>();
  for (const card of cards) {
    const addresses = groups.get(card.provider) ?? new Set<string>();
    addresses.add(card.address.toLowerCase());
    groups.set(card.provider, addresses);
  }
  return [...groups.entries()].flatMap(([provider, group]) => {
    const addresses = [...group].sort();
    const batches: { provider: CryptoCard['provider']; addresses: string[] }[] = [];
    for (let i = 0; i < addresses.length; i += 8)
      batches.push({ provider, addresses: addresses.slice(i, i + 8) });
    return batches;
  });
}

/** Stop displaying an ephemeral preview once any of its cards has been removed. */
export function retainedOnboardingPreview(
  preview: OnchainSpendingPreview | null,
  cards: readonly CryptoCard[] | undefined,
) {
  if (!preview || !cards) return preview;
  const saved = new Set(
    cards
      .filter((card) => card.provider === preview.provider)
      .map((card) => card.address.toLowerCase()),
  );
  return preview.addresses.length > 0 &&
    preview.addresses.every((entry) => saved.has(entry.address.toLowerCase()))
    ? preview
    : null;
}
