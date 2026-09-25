import { router } from 'expo-router';
import { Button, Screen, Type } from '../components/ui';

export default function NotFound() {
  return (
    <Screen title="A little off track.">
      <Type muted>This page is unavailable.</Type>
      <Button title="Back home" onPress={() => router.replace('/')} />
    </Screen>
  );
}
