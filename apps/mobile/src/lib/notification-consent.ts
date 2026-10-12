import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATION_CONSENT_VERSION } from '@roundups/types';

export { NOTIFICATION_CONSENT_VERSION };
export const notificationOfferKey = (userId: string) =>
  `beaver.notification-offer.v${NOTIFICATION_CONSENT_VERSION}:${userId}`;
const consentKey = (userId: string) =>
  `beaver.notification-consent.v${NOTIFICATION_CONSENT_VERSION}:${userId}`;
export const hasNotificationConsent = async (userId: string) =>
  (await AsyncStorage.getItem(consentKey(userId))) === 'accepted';
export const acceptNotificationConsent = (userId: string) =>
  AsyncStorage.setItem(consentKey(userId), 'accepted');
