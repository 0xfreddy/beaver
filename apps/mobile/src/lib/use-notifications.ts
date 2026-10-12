import {
  receiveInAppNotification,
  markSystemPresented,
  type SavedNotification,
} from './dynamic-notification-events';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  attachNotificationListeners,
  notificationRoute,
} from './notifications';
import { syncNotificationRegistration } from './notification-registration';
import { apiRequest } from './api';
import { posthog } from './telemetry';
import { useAuth } from '../providers/auth-provider';
import { useMockData } from '../providers/mock-data-provider';

import { notificationOfferKey } from './notification-consent';
export { notificationOfferKey } from './notification-consent';

export function useNotifications({
  canNavigate,
  canOffer,
}: {
  canNavigate: boolean;
  canOffer: boolean;
}) {
  const auth = useAuth();
  const mock = useMockData();
  const userId = auth.session?.user.id ?? null;
  const owner = useRef(userId);
  owner.current = userId;
  const accessToken = useRef(auth.getAccessToken);
  accessToken.current = auth.getAccessToken;
  const [response, setResponse] = useState<Notifications.NotificationResponse | null>(null);
  const handled = useRef<string | null>(null);
  useEffect(
    () =>
      attachNotificationListeners(setResponse, async (notification) => {
        const data = notification.request.content.data;
        const id = data?.notification_id;
        const recipient = owner.current;
        if (data?.userId && data.userId !== recipient) return true;
        if (
          !recipient ||
          data?.userId !== recipient ||
          typeof id !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(id)
        )
          return false;
        try {
          const row = await apiRequest<SavedNotification>(
            () => accessToken.current(),
            `/v1/notifications/${id}`,
            { signal: AbortSignal.timeout(1500) },
          );
          if (owner.current !== recipient) return true;
          const handled = receiveInAppNotification(row);
          if (!handled) markSystemPresented(id);
          return handled;
        } catch {
          markSystemPresented(id);
          return false;
        }
      }),
    [],
  );
  useEffect(() => {
    if (!userId || !mock.ready || mock.active) return;
    let active = true;
    let inFlight = false;
    const sync = async () => {
      if (inFlight || !active || AppState.currentState !== 'active') return;
      inFlight = true;
      try {
        await syncNotificationRegistration(
          userId,
          () => accessToken.current(),
          () => active && owner.current === userId,
        );
      } catch {
        posthog?.capture('notification_registration_failed');
      } finally {
        inFlight = false;
      }
    };
    void sync();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    const refresh = Notifications.addPushTokenListener(() => void sync());
    const retry = setInterval(() => void sync(), 60000);
    return () => {
      active = false;
      foreground.remove();
      refresh.remove();
      clearInterval(retry);
    };
  }, [userId, mock.ready, mock.active]);

  useEffect(() => {
    if (!response || !canNavigate || !userId) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = response.notification.request.content.data;
    const route = notificationRoute(data?.deepLink);
    // Never open another account's financial notification after an account switch.
    if (data?.userId && data.userId !== userId) {
      void Notifications.clearLastNotificationResponseAsync();
      return;
    }
    if (route) router.push(route as Href);
    posthog?.capture('push_notification_opened', {
      notification_id: typeof data?.notification_id === 'string' ? data.notification_id : id,
    });
    if (typeof data?.notification_id === 'string' && !mock.active) {
      void apiRequest(
        () => accessToken.current(),
        `/v1/notifications/${data.notification_id}/opened`,
        { method: 'POST' },
      ).catch(() => {});
    }
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, canNavigate, userId, mock.active]);

  useEffect(() => {
    if (!canOffer || !userId || !mock.ready || mock.active) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const offered = await AsyncStorage.getItem(notificationOfferKey(userId));
        if (!active || offered || AppState.currentState !== 'active')
          return;
        if (active && owner.current === userId) router.push('/notification-setup');
      })().catch(() => {});
    }, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [canOffer, userId, mock.ready, mock.active]);
}
