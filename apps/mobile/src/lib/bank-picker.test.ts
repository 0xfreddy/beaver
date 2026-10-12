import { expect, it, vi } from 'vitest';
import { loadBankCatalogue, searchBanks, type PickerBank } from './bank-picker';
const bank: PickerBank = {
  id: 'revolut_lt',
  provider: 'saltedge',
  providerCode: 'revolut_lt',
  country: 'LT',
  name: 'Revolut',
  mode: 'oauth',
  logoUrl: null,
};
it('searches later pages, including through an empty filtered page, without merging regional variants', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ items: [bank], nextCursor: '100' })
    .mockResolvedValueOnce({ items: [], nextCursor: '200' })
    .mockResolvedValueOnce({
      items: [bank, { ...bank, id: 'business_lt', providerCode: 'business_lt' }],
      nextCursor: null,
    });
  const banks = await loadBankCatalogue(fetch);
  expect(fetch.mock.calls).toEqual([[undefined], ['100'], ['200']]);
  expect(searchBanks(banks, ' revolut ')).toHaveLength(2);
  expect(searchBanks(banks, 'missing')).toHaveLength(0);
});
it('reports an incomplete directory instead of returning partial search results', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ items: [bank], nextCursor: '100' })
    .mockRejectedValueOnce(new Error('offline'));
  await expect(loadBankCatalogue(fetch)).rejects.toThrow('offline');
});
it('stops cyclic pagination', async () => {
  await expect(loadBankCatalogue(async () => ({ items: [], nextCursor: '100' }))).rejects.toThrow(
    'could not be completed',
  );
});

it('promotes familiar banks only when present in the returned country catalogue', () => {
  const values = ['Local Bank', 'Revolut'].map((name, i) => ({
    id: String(i),
    provider: 'saltedge' as const,
    providerCode: String(i),
    country: 'LT',
    name,
    mode: 'oauth',
    logoUrl: null,
  }));
  expect(searchBanks(values, '').map((bank) => bank.name)).toEqual(['Revolut', 'Local Bank']);
  expect(searchBanks(values, 'n26')).toEqual([]);
});
