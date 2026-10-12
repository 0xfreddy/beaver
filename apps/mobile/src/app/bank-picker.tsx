import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider';
import { apiRequest, withRequestTimeout } from '../lib/api';
import { bankPickerSession, closeBankPicker } from '../lib/bank-picker-session';
import { loadBankCatalogue, type BankPage, type PickerCountry } from '../lib/bank-picker';
import { NativeBankPicker } from '../components/native-bank-picker';
import { Screen, Type, Button } from '../components/ui';

export default function BankPicker() {
  const auth = useAuth();
  const { pickerId } = useLocalSearchParams<{ pickerId: string }>();
  const session = bankPickerSession(pickerId, auth.user?.id);
  const [country, setCountry] = useState(session?.country ?? '');
  const changedCountry = useRef(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const preferenceKey = `bank-picker-country:${auth.user?.id ?? ''}`;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(preferenceKey)
      .then((saved) => {
        if (active && !changedCountry.current && saved && /^[A-Z]{2}$/.test(saved))
          setCountry(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setPreferenceLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [preferenceKey]);
  function chooseCountry(value: string) {
    changedCountry.current = true;
    setCountry(value);
    void AsyncStorage.setItem(preferenceKey, value).catch(() => {});
  }
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) closeBankPicker(pickerId);
      });
    };
  }, [pickerId]);
  const countries = useQuery({
    queryKey: ['bank-countries', auth.user?.id],
    enabled: !!session,
    staleTime: 300000,
    retry: false,
    queryFn: ({ signal }) =>
      withRequestTimeout(
        (boundedSignal) =>
          apiRequest<{ items: PickerCountry[] }>(
            auth.getAccessToken,
            '/v1/bank/catalogue/countries?provider=saltedge',
            { signal: boundedSignal },
          ),
        15_000,
        signal,
      ),
  });
  const moneyKit = !!session?.moneyKitCountries.includes(country);
  const banks = useQuery({
    queryKey: ['bank-catalogue', auth.user?.id, country],
    enabled: !!session && preferenceLoaded && !!country && !moneyKit,
    staleTime: 300000,
    retry: false,
    queryFn: ({ signal }) =>
      withRequestTimeout(
        (boundedSignal) =>
          loadBankCatalogue((cursor) =>
            apiRequest<BankPage>(
              auth.getAccessToken,
              `/v1/bank/catalogue?${new URLSearchParams({ provider: 'saltedge', country, ...(cursor ? { cursor } : {}) })}`,
              { signal: boundedSignal },
            ),
          ),
        30_000,
        signal,
      ),
  });
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings/banks');
  };
  if (!session)
    return (
      <Screen title="Connect your bank">
        <Type>Start a new bank connection to continue.</Type>
        <Button title="Back" onPress={back} />
      </Screen>
    );
  if (!preferenceLoaded)
    return (
      <Screen title="Connect your bank">
        <Type muted>Loading your bank country…</Type>
      </Screen>
    );
  const countryMap = new Map((countries.data?.items ?? []).map((item) => [item.code, item]));
  const names: Record<string, string> = { US: 'United States', CA: 'Canada', GB: 'United Kingdom' };
  for (const code of session.moneyKitCountries)
    countryMap.set(code, { code, name: names[code] ?? code });
  return (
    <NativeBankPicker
      countries={[...countryMap.values()].sort((a, b) => a.name.localeCompare(b.name))}
      country={country}
      onCountry={chooseCountry}
      banks={banks.data ?? []}
      loading={!!country && !moneyKit && banks.isPending && !banks.isError}
      countriesLoading={countries.isPending && !countries.isError}
      error={banks.error ? 'Couldn’t load banks. Check your connection and try again.' : null}
      countriesError={countries.error ? 'Couldn’t load all countries. Try again.' : null}
      moneyKit={moneyKit}
      onRetry={() => void banks.refetch()}
      onRetryCountries={() => void countries.refetch()}
      onBack={back}
      onSelect={session.select}
    />
  );
}
