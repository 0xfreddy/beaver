import AsyncStorage from '@react-native-async-storage/async-storage';
import { inviteCodeLength } from '@roundups/types';
const key = 'beaver.pending-invite.v1';
/** Personal codes use 4 characters; legacy codes use 8 and token links use 43. */
export const isInviteToken = (value: string) =>
  /^[A-Za-z0-9_-]+$/.test(value) &&
  (value.length === inviteCodeLength || value.length === 8 || value.length === 43);
export async function rememberInvite(token: string) {
  if (!isInviteToken(token)) throw new Error('Invalid invitation.');
  await AsyncStorage.setItem(key, JSON.stringify({ token }));
}
export async function pendingInvite() {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v.token === 'string' && isInviteToken(v.token)) return v.token as string;
  } catch {
    /* discard invalid local state */
  }
  await clearInvite();
  return null;
}
export const clearInvite = () => AsyncStorage.removeItem(key);
