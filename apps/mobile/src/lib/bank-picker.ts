export type PickerCountry = { code: string; name: string };
export type PickerBank = {
  id: string;
  provider: 'saltedge';
  providerCode: string;
  country: string;
  name: string;
  mode: string | null;
  logoUrl: string | null;
};
export type BankSelection =
  | { provider: 'saltedge'; country: string; providerCode: string }
  | { provider: 'moneykit'; country: string };
export type BankPage = { items: PickerBank[]; nextCursor: string | null };

/** Search is complete only after every page, including empty filtered pages. */
export async function loadBankCatalogue(fetchPage: (cursor?: string) => Promise<BankPage>) {
  const seen = new Set<string>();
  const banks = new Map<string, PickerBank>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await fetchPage(cursor);
    for (const bank of result.items) banks.set(bank.providerCode, bank);
    if (!result.nextCursor)
      return [...banks.values()].sort(
        (a, b) => a.name.localeCompare(b.name) || a.providerCode.localeCompare(b.providerCode),
      );
    if (seen.has(result.nextCursor))
      throw new Error('Bank list could not be completed. Please try again.');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('Bank list could not be completed. Please try again.');
}
export function searchBanks(banks: PickerBank[], search: string) {
  const term = search.trim().toLocaleLowerCase();
  const matches = banks.filter((bank) => bank.name.toLocaleLowerCase().includes(term));
  if (term) return matches;
  // Only promote banks returned by the provider for this country; never invent availability.
  const rank = (name: string) => {
    const index = ['revolut', 'n26', 'ing', 'bnp paribas', 'santander', 'hsbc'].findIndex(
      (popular) =>
        name.toLocaleLowerCase() === popular || name.toLocaleLowerCase().startsWith(`${popular} `),
    );
    return index < 0 ? 100 : index;
  };
  return matches.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}
