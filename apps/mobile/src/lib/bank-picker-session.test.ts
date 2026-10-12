import { expect, it, vi } from 'vitest';
const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ router: { push } }));
import { openBankPicker, bankPickerSession, closeBankPicker } from './bank-picker-session';
it('opens only a picker, scopes callbacks to the owner and prevents stale dismissal from closing a newer picker', () => {
  const select = vi.fn();
  const first = openBankPicker({ userId: 'a', moneyKitCountries: [], select });
  expect(select).not.toHaveBeenCalled();
  expect(bankPickerSession(first, 'b')).toBeNull();
  const second = openBankPicker({ userId: 'a', moneyKitCountries: [], select });
  closeBankPicker(first);
  expect(bankPickerSession(second, 'a')?.select).toBe(select);
  expect(bankPickerSession(first, 'a')).toBeNull();
  closeBankPicker(second);
  expect(bankPickerSession(second, 'a')).toBeNull();
});
