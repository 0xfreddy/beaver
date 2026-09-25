/**
 * Ephemeral hand-off between the receipt scan and review screens. Router
 * params cannot carry multi-megabyte receipt photos, so the draft lives in a
 * module singleton for the lifetime of one scan flow. It is never persisted.
 */
export type ReceiptLineItem = { name: string | null; amount: string | null };

export type ReceiptScanDraft = {
  receiptId: string | null;
  /** data: URL of the captured/picked photo, kept in memory only. */
  image: string | null;
  merchant: string;
  total: string;
  date: string;
  currency: string;
  usdCents: number | null;
  category: string | null;
  paymentMethod: string | null;
  subtotal: string | null;
  tax: string | null;
  items: ReceiptLineItem[] | null;
};

let draft: ReceiptScanDraft | null = null;

export function setReceiptScanDraft(next: ReceiptScanDraft) {
  draft = next;
}

export function getReceiptScanDraft() {
  return draft;
}

export function clearReceiptScanDraft() {
  draft = null;
}

/** "23.17" → 2317; null when unreadable so the review screen can ask for edits. */
export function receiptAmountCents(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole = '0', fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

// Mirrors the currencies the confirm endpoint accepts; USD needs no conversion.
export const RECEIPT_CURRENCIES = ['USD', 'EUR', 'CHF', 'AED', 'GBP', 'INR'] as const;
export type ReceiptCurrency = (typeof RECEIPT_CURRENCIES)[number];
export function receiptCurrency(code: string | null | undefined): ReceiptCurrency {
  return RECEIPT_CURRENCIES.find((currency) => currency === code) ?? 'USD';
}
