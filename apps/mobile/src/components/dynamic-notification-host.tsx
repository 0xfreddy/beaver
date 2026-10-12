import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useLive } from '../lib/live';
import { useAuth } from '../providers/auth-provider';
import { useMockData } from '../providers/mock-data-provider';
import { apiRequest } from '../lib/api';
import { notificationPermissionState, notificationRoute } from '../lib/notifications';
import { posthog } from '../lib/telemetry';
import {
  combineRoundups,
  inAppNotice,
  wasSystemPresented,
  setInAppNotificationReceiver,
  type InAppNotice,
  type SavedNotification,
} from '../lib/dynamic-notification-events';
import { DynamicNotificationCard } from './dynamic-notification-card';

type Bank = {
  id: string;
  institutionName: string | null;
  initialSyncComplete: boolean;
  status: string;
  disconnectRequested: boolean;
};
export function DynamicNotificationHost({ enabled }: { enabled: boolean }) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  useEffect(() => {
    let active = true;
    const check = () => {
      void notificationPermissionState().then((state) => {
        if (active) setPermissionGranted(state === 'granted');
      });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
      else setPermissionGranted(false);
    });
    const timer = setInterval(check, 5000);
    return () => {
      active = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  const auth = useAuth();
  const mock = useMockData();
  const userId = auth.session?.user.id;
  return userId && !mock.active ? (
    <AccountNotifications key={userId} enabled={enabled && permissionGranted} />
  ) : null;
}
function AccountNotifications({ enabled }: { enabled: boolean }) {
  const auth = useAuth();
  const cache = useQueryClient();
  const history = useLive<{ items: SavedNotification[] }>(
    '/v1/notifications/in-app',
    enabled,
    5000,
  );
  const banks = useLive<{ items: Bank[] }>('/v1/bank/connections', enabled, 5000);
  const [notice, setNotice] = useState<InAppNotice | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const mountedAt = useRef(Date.now());
  const seen = useRef(new Set<string>());
  const waiting = useRef<InAppNotice[]>([]);
  const purchases = useRef<InAppNotice[]>([]);
  const purchaseDue = useRef(0);
  const active = useRef<InAppNotice | null>(null);
  const expires = useRef(Infinity);
  const hiddenSync = useRef(new Set<string>());
  const pendingSync = useRef<InAppNotice | null>(null);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    // Returning from the background must not replay pushes already shown by iOS.
    mountedAt.current = Date.now();
    waiting.current = [];
    purchases.current = [];
    purchaseDue.current = 0;
    active.current = null;
    pendingSync.current = null;
    setNotice(null);
  }, [enabled]);
  const accept = useEffectEvent((row: SavedNotification) => {
    const item = inAppNotice(row);
    if (!item) return false;
    if (wasSystemPresented(row.id)) return false;
    if (seen.current.has(item.id)) return true;
    seen.current.add(item.id);
    if (item.kind === 'roundup') {
      purchases.current.push(item);
      // Fixed burst window, so a busy stream cannot postpone presentation forever.
      if (!purchaseDue.current) purchaseDue.current = Date.now() + 3000;
    } else waiting.current.push(item);
    return true;
  });
  useEffect(() => {
    setInAppNotificationReceiver(
      enabled
        ? (row) => {
            const accepted = accept(row);
            if (accepted)
              void cache.invalidateQueries({
                queryKey: ['live', auth.user?.id, '/v1/notifications/in-app'],
              });
            return accepted;
          }
        : null,
    );
    return () => setInAppNotificationReceiver(null);
  }, [enabled, cache, auth.user?.id]);
  useEffect(() => {
    if (!enabled) return;
    for (const row of [...(history.data?.items ?? [])].reverse()) {
      // No historical burst on login/unlock. Push reception can still explicitly present an older delivery.
      if (Date.parse(row.createdAt) >= mountedAt.current) accept(row);
    }
  }, [history.data, enabled]);
  useEffect(() => {
    if (!enabled || !banks.data) return;
    const items = banks.data.items;
    const syncing = items.filter(
      (b) =>
        !b.initialSyncComplete &&
        !b.disconnectRequested &&
        ['healthy', 'syncing', 'pending', 'connected'].includes(b.status),
    );
    const id = `sync:${syncing
      .map((b) => b.id)
      .sort()
      .join(':')}`;
    pendingSync.current =
      syncing.length && !hiddenSync.current.has(id)
        ? {
            id,
            kind: 'sync',
            title: 'Getting your transactions…',
            message: 'You can keep using Beaver while we finish.',
            route: '/settings/banks',
            sourceIds: [],
          }
        : null;
  }, [banks.data, enabled]);
  const advance = useEffectEvent(() => {
    if (!enabled) return;
    if (purchaseDue.current && Date.now() >= purchaseDue.current) {
      waiting.current.push(combineRoundups(purchases.current));
      purchases.current = [];
      purchaseDue.current = 0;
    }
    const current = active.current;
    if (current && current.kind !== 'sync' && Date.now() < expires.current) return;
    const next = waiting.current.shift() ?? pendingSync.current;
    if (next?.id === current?.id) return;
    active.current = next;
    expires.current = next?.kind === 'sync' || screenReader ? Infinity : Date.now() + 7000;
    setNotice(next);
  });
  useEffect(() => {
    const timer = setInterval(() => advance(), 250);
    return () => clearInterval(timer);
  }, []);
  const dismiss = () => {
    if (active.current?.kind === 'sync') {
      hiddenSync.current.add(active.current.id);
      pendingSync.current = null;
    }
    active.current = null;
    setNotice(null);
  };
  const open = () => {
    if (!notice || !enabled) return;
    const route = notificationRoute(notice.route);
    if (route) router.push(route as Href);
    for (const id of notice.sourceIds) {
      void apiRequest(auth.getAccessToken, `/v1/notifications/${id}/opened`, {
        method: 'POST',
      }).catch(() => {});
    }
    posthog?.capture('in_app_notification_opened', {
      kind: notice.kind,
      notification_ids: notice.sourceIds,
    });
    dismiss();
  };
  if (!enabled || !notice) return null;
  const card = (
    <GestureHandlerRootView pointerEvents="box-none" style={{ flex: 1 }}>
      <DynamicNotificationCard key={notice.id} notice={notice} onDismiss={dismiss} onOpen={open} />
    </GestureHandlerRootView>
  );
  return Platform.OS === 'ios' ? (
    <FullWindowOverlay>{card}</FullWindowOverlay>
  ) : (
    <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0 }}>
      {card}
    </View>
  );
}
