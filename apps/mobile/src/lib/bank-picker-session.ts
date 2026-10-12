import { router } from 'expo-router';
import type { BankSelection } from './bank-picker';

type PickerSession = {
  id: string;
  userId: string;
  country?: string;
  moneyKitCountries: string[];
  select: (selection: BankSelection) => Promise<void>;
};
let active: PickerSession | null = null;
let sequence = 0;
export function openBankPicker(options: Omit<PickerSession, 'id'>) {
  const id = String(++sequence);
  active = { ...options, id };
  router.push({ pathname: '/bank-picker', params: { pickerId: id } });
  return id;
}
export function bankPickerSession(id: string, userId?: string) {
  return active?.id === id && active.userId === userId ? active : null;
}
export function closeBankPicker(id: string) {
  if (active?.id === id) active = null;
}
