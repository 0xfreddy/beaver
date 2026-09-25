import { useState } from 'react';
import { ManualGuideVideo } from '../../components/manual-guide-video';
import { Button, TextButton, Type } from '../../components/ui';
import { SetupPage } from '../../components/setup-page';
import { useOnboardingFlow } from '../../lib/onboarding-flow';
import { useAuth } from '../../providers/auth-provider';
import { apiRequest } from '../../lib/api';
import { posthog } from '../../lib/telemetry';
import { useQueryClient } from '@tanstack/react-query';
export default function Manual() {
  const flow = useOnboardingFlow();
  const auth = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function activate() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(auth.getAccessToken, '/v1/manual/mode', { method: 'POST' });
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      await flow.next('enter-app');
      posthog?.capture('manual_mode_enabled');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupPage
      title={'Go the old way.\nManual mode.'}
      actions={
        <>
          <Button
            appearance="onboarding"
            title="Use manual mode"
            loading={busy}
            onPress={() => void activate()}
          />
          <TextButton
            title="Skip for now"
            disabled={busy}
            onPress={() => void flow.next('enter-app')}
          />
        </>
      }
    >
      <ManualGuideVideo />
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
    </SetupPage>
  );
}
