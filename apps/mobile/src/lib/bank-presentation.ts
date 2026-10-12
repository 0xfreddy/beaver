/** Provider placeholders aren't brand marks; continue to the next source. */
export function bankLogoSources(...sources: (string | null | undefined)[]) {
  return [
    ...new Set(
      sources.filter((source): source is string => {
        if (!source) return false;
        try {
          const url = new URL(source);
          return (
            url.protocol === 'https:' && !/\/placeholder[^/]*\.(svg|png|webp)$/i.test(url.pathname)
          );
        } catch {
          return false;
        }
      }),
    ),
  ];
}

export function bankAccountLabel(account: { name: string; mask: string | null; currency: string }) {
  const currency = account.currency.toUpperCase();
  const raw = account.name.trim();
  // Salt Edge sometimes returns the IBAN followed by the currency as the name.
  const withoutCurrency = raw.replace(new RegExp(`[-\\s]+${currency}$`, 'i'), '').trim();
  const compact = withoutCurrency.replace(/\s/g, '');
  const isIdentifier = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(compact) || /^\d{8,}$/.test(compact);
  const ending = (account.mask || (isIdentifier ? compact.slice(-4) : '')).replace(/^[*•\s]+/, '');
  return {
    name:
      isIdentifier || !withoutCurrency || withoutCurrency.toUpperCase() === currency
        ? 'Bank account'
        : withoutCurrency,
    detail: [currency, ending ? `•• ${ending.slice(-4)}` : null].filter(Boolean).join(' · '),
  };
}

export function currencySymbol(currency: string) {
  const code = currency.trim().toUpperCase();
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    KRW: '₩',
    CHF: 'Fr',
    AED: 'AED',
    CAD: 'C$',
    AUD: 'A$',
    SGD: 'S$',
    NZD: 'NZ$',
    HKD: 'HK$',
    THB: '฿',
  };
  if (symbols[code]) return symbols[code];
  try {
    return (
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
}

export function bankAccountState(enabled: boolean, status: string, initialSyncComplete: boolean) {
  if (status === 'relink_required') return 'Reconnect bank';
  if (status === 'error') return 'Check delayed';
  if (!initialSyncComplete) return 'Importing';
  return enabled ? 'Active' : 'Unavailable';
}
