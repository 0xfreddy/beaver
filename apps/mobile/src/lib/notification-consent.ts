import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATION_CONSENT_VERSION } from '@roundups/types';

export { NOTIFICATION_CONSENT_VERSION };
export const notificationOfferKey = (userId: string) =>
  `beaver.notification-offer.v${NOTIFICATION_CONSENT_VERSION}:${userId}`;
const consentKey = (userId: string) =>
  `beaver.notification-consent.v${NOTIFICATION_CONSENT_VERSION}:${userId}`;
export const hasNotificationConsent = async (userId: string) =>
  ['accepted', 'completed'].includes((await AsyncStorage.getItem(consentKey(userId))) ?? '');
export const hasCompletedNotificationSetup = async (userId: string) =>
  (await AsyncStorage.getItem(consentKey(userId))) === 'completed';
export const completeNotificationConsent = (userId: string) =>
  AsyncStorage.setItem(consentKey(userId), 'completed');

// "Not now" defers this session; an impression or interruption never completes setup.
const deferred = new Set<string>();
export const deferNotificationOffer = (userId: string) => {
  deferred.add(userId);
};
export const notificationOfferDeferred = (userId: string) => deferred.has(userId);
