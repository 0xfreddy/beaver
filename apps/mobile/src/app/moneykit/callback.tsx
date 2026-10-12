import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Screen, Type, Button } from '../../components/ui';
import { continueBankLink } from '../../lib/bank-link';

export default function BankCallback() {
  const url = Linking.useURL();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    const watchdog = setTimeout(() => {
      if (current) setFailed(true);
    }, 15_000);
    if (!url)
      return () => {
        current = false;
        clearTimeout(watchdog);
      };
    void continueBankLink(url)
      .then((resumed) => {
        if (!current) return;
        clearTimeout(watchdog);
        if (resumed && router.canGoBack()) router.back();
        else router.replace({ pathname: '/onboarding/bank', params: { stage: 'connect' } });
      })
      .catch(() => {
        clearTimeout(watchdog);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
      clearTimeout(watchdog);
    };
  }, [url]);
  return (
    <Screen title="Bank connection">
      <Type>
        {failed
          ? 'Please return to bank setup to check your connection.'
          : 'Returning to your bank connection…'}
      </Type>
      {failed ? (
        <Button
          title="Return to bank setup"
          onPress={() =>
            router.replace({ pathname: '/onboarding/bank', params: { stage: 'connect' } })
          }
        />
      ) : null}
    </Screen>
  );
}
