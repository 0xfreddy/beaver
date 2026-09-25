import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Screen, Type, Button } from '../../components/ui';
import { continueBankLink } from '../../lib/bank-link';

export default function BankCallback() {
  const url = Linking.useURL();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url) return;
    let current = true;
    void continueBankLink(url)
      .then((resumed) => {
        if (!current) return;
        if (resumed && router.canGoBack()) router.back();
        else setFailed(true);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [url]);
  return (
    <Screen title="Bank connection">
      <Type>
        {failed
          ? 'Please return to bank setup and reconnect to finish signing in.'
          : 'Returning to your bank connection…'}
      </Type>
      {failed ? (
        <Button title="Return to bank setup" onPress={() => router.replace('/onboarding/bank')} />
      ) : null}
    </Screen>
  );
}
