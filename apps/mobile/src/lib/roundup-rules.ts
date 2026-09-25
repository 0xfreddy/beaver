import { activationSchema } from '@roundups/types';
export function nextTenCents(purchaseCents: number) {
  if (!Number.isSafeInteger(purchaseCents) || purchaseCents < 0)
    throw new Error('Use nonnegative integer cents.');
  return (1000 - (purchaseCents % 1000)) % 1000;
}
export function limitPayload(limit: string, enabled: boolean) {
  const text = limit.trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text))
    throw new Error('Enter a USD amount with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const parsed = activationSchema.safeParse({
    enabled,
    policyVersion: 'automatic-spot-v1',
    dailyLimitCents: Number(whole) * 100 + Number(fraction.padEnd(2, '0')),
  });
  if (!parsed.success) throw new Error('Choose a daily purchase limit between $10 and $1,000 USD.');
  return parsed.data;
}
/** Commit only the response, never the submitted draft. Rejection cannot change confirmed state. */
export async function saveConfirmedPolicy<T>(write: () => Promise<T>, commit: (value: T) => void) {
  const confirmed = await write();
  commit(confirmed);
  return confirmed;
}
