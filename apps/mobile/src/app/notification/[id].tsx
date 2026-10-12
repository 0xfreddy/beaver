import { useState } from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Screen, Type, Button } from '../../components/ui';
import { useLive } from '../../lib/live';
import { notificationRoute } from '../../lib/notifications';

type Detail = {
  display: {
    title: string;
    body: string;
    deepLink: string;
    updateUrl?: string;
    week?: string;
    symbols?: string;
  } | null;
  createdAt: string;
};
export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  const query = useLive<Detail>(`/v1/notifications/${id}`, valid, false);
  const [error, setError] = useState<string | null>(null);
  const display = query.data?.display;
  async function open() {
    if (!display) return;
    if (display.updateUrl) {
      try {
        const url = new URL(display.updateUrl);
        if (
          url.protocol !== 'https:' ||
          !['apps.apple.com', 'testflight.apple.com'].includes(url.hostname)
        )
          return;
        await Linking.openURL(display.updateUrl);
      } catch {
        setError('Couldn’t open the update. Please try again.');
      }
      return;
    }
    const route = notificationRoute(display.deepLink);
    if (route) router.push(route as Href);
  }
  return (
    <Screen title="Beaver update">
      {display ? (
        <>
          <Type variant="title" accessibilityRole="header">
            {display.title}
          </Type>
          <Type>{display.body}</Type>
          {display.week ? <Type muted>Week of {display.week}</Type> : null}
          {display.symbols ? <Type muted>{display.symbols}</Type> : null}
          <Type variant="caption" muted>
            {new Date(query.data!.createdAt).toLocaleDateString()}
          </Type>
          {error ? <Type accessibilityRole="alert">{error}</Type> : null}
          <Button
            title={display.updateUrl ? 'Get the update' : 'Open Beaver'}
            onPress={() => void open()}
          />
        </>
      ) : (
        <>
          <Type>
            {query.isPending && valid
              ? 'Loading your update…'
              : 'This update is no longer available.'}
          </Type>
          {query.isError ? <Button title="Try again" onPress={() => void query.refetch()} /> : null}
        </>
      )}
    </Screen>
  );
}
