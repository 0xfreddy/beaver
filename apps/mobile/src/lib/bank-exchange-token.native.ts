import * as SecureStore from 'expo-secure-store';

const key = (sessionId: string) => `bank.exchange.${sessionId}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function saveBankExchangeToken(userId: string, sessionId: string, token: string) {
  await SecureStore.setItemAsync(key(sessionId), JSON.stringify({ userId, token }), options);
}

export async function loadBankExchangeToken(
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(key(sessionId), options);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { userId?: string; token?: string };
    return value.userId === userId && typeof value.token === 'string' ? value.token : null;
  } catch {
    return null;
  }
}

export async function clearBankExchangeToken(sessionId: string) {
  await SecureStore.deleteItemAsync(key(sessionId), options);
}
