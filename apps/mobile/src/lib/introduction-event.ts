import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './api';
// Only a real, authenticated completion creates this entry. Old completion flags
// Retrying uses the same one-time server criterion.
const key = (id: string) => `roundups.introduction-event.v1:${id}`;
export async function flushIntroduction(id: string, getToken: () => Promise<string | null>) {
  if (await AsyncStorage.getItem(key(id))) {
    await apiRequest(getToken, '/v1/social/events', {
      method: 'POST',
      body: JSON.stringify({ criterion: 'introduction-complete', version: 1 }),
    });
    await AsyncStorage.removeItem(key(id));
  }
}
export async function recordIntroduction(id: string, getToken: () => Promise<string | null>) {
  await AsyncStorage.setItem(key(id), 'pending');
  await flushIntroduction(id, getToken).catch(() => {});
}
