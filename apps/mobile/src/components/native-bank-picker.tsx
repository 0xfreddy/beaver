import { ExpandedSearchBar } from './reacticx/gooey-search-tabs';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, FlatList, Keyboard, Platform, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { OnboardingAnimation } from './onboarding-animation';
import { BankMark } from './bank-mark';
import { Button, TextButton, Type } from './ui';
import {
  searchBanks,
  type BankSelection,
  type PickerBank,
  type PickerCountry,
} from '../lib/bank-picker';

type Props = {
  countries: PickerCountry[];
  country: string;
  onCountry: (value: string) => void;
  banks: PickerBank[];
  loading: boolean;
  countriesLoading: boolean;
  error?: string | null;
  countriesError?: string | null;
  moneyKit: boolean;
  onRetry: () => void;
  onRetryCountries: () => void;
  onBack: () => void;
  onSelect: (selection: BankSelection) => Promise<void>;
};
export function NativeBankPicker(props: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [choosingCountry, setChoosingCountry] = useState(false);
  const [term, setTerm] = useState('');
  const [countryTerm, setCountryTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const selecting = useRef(false);
  async function select(selection: BankSelection) {
    if (selecting.current) return;
    selecting.current = true;
    setBusy(true);
    setSelectionError(null);
    Keyboard.dismiss();
    try {
      await props.onSelect(selection);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : 'Couldn’t open your bank. Try again.',
      );
    } finally {
      selecting.current = false;
      setBusy(false);
    }
  }
  const row = {
    paddingVertical: 18,
    minHeight: 56,
    borderBottomWidth: 1,
    borderColor: colors.line,
  };
  const content = {
    padding: 24,
    paddingTop: insets.top + 16,
    paddingBottom: insets.bottom + 24,
    gap: 8,
  };
  const countryName = props.countries.find((item) => item.code === props.country)?.name;
  const back = () => {
    if (choosingCountry) {
      setChoosingCountry(false);
      setCountryTerm('');
    } else props.onBack();
  };
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !choosingCountry) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setChoosingCountry(false);
        setCountryTerm('');
        return true;
      });
      return () => subscription.remove();
    }, [choosingCountry]),
  );
  if (choosingCountry)
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          style={{ flex: 1, backgroundColor: colors.background }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onAccessibilityEscape={back}
          data={props.countries.filter((item) =>
            `${item.name} ${item.code}`.toLowerCase().includes(countryTerm.trim().toLowerCase()),
          )}
          keyExtractor={(item) => item.code}
          ListHeaderComponent={
            <View style={{ gap: 20, paddingBottom: 16 }}>
              <Type variant="title">Choose country</Type>
              <OnboardingAnimation
                name={isDark ? 'country-dark' : 'country-light'}
                height={140}
                loop={false}
              />
              <ExpandedSearchBar
                placeholder="Search countries"
                value={countryTerm}
                onChangeText={setCountryTerm}
              />
              {props.countriesLoading ? <Type muted>Loading countries…</Type> : null}
              {props.countriesError ? (
                <>
                  <Type accessibilityRole="alert">{props.countriesError}</Type>
                  <Button
                    title="Try again"
                    appearance="onboarding"
                    onPress={props.onRetryCountries}
                  />
                </>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item.code === props.country }}
              style={({ pressed }) => [row, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => {
                props.onCountry(item.code);
                setTerm('');
                setSelectionError(null);
                setChoosingCountry(false);
                setCountryTerm('');
                Keyboard.dismiss();
              }}
            >
              <Type>
                {item.name}
                {item.code === props.country ? ' · Selected' : ''}
              </Type>
            </Pressable>
          )}
          ListEmptyComponent={
            !props.countriesLoading && !props.countriesError ? (
              <Type muted>No matching countries. Try another name.</Type>
            ) : null
          }
        />
        <View style={{ paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 20) }}>
          <TextButton title="Back" onPress={back} />
        </View>
      </View>
    );
  const matches = searchBanks(props.banks, term);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[content, !props.country && { flexGrow: 1 }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onAccessibilityEscape={back}
        data={props.moneyKit ? [] : matches}
        keyExtractor={(item) => `${item.country}:${item.providerCode}`}
        ListHeaderComponentStyle={!props.country ? { flex: 1 } : undefined}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 12, flex: !props.country ? 1 : undefined }}>
            <Type variant="title">{bankTitle(props.country, countryName)}</Type>
            {!props.country ? (
              <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
                <OnboardingAnimation
                  name={isDark ? 'country-dark' : 'country-light'}
                  height={340}
                  loop
                />
                <Type muted style={{ textAlign: 'center' }}>
                  700 banks supported
                </Type>
                <Type style={{ textAlign: 'center' }}>🇪🇺🇺🇸🇬🇧</Type>
              </View>
            ) : null}
            {props.country && !props.moneyKit ? (
              <ExpandedSearchBar
                placeholder="Search banks, e.g. Revolut"
                value={term}
                onChangeText={setTerm}
                editable={!busy}
              />
            ) : null}
            {props.countriesError ? (
              <>
                <Type accessibilityRole="alert">{props.countriesError}</Type>
                <Button
                  title="Reload countries"
                  appearance="onboarding"
                  onPress={props.onRetryCountries}
                />
              </>
            ) : null}
            {selectionError ? <Type accessibilityRole="alert">{selectionError}</Type> : null}
            {busy ? (
              <Type accessibilityLiveRegion="polite">Opening your secure connection…</Type>
            ) : null}
            {props.error ? (
              <>
                <Type accessibilityRole="alert">{props.error}</Type>
                <Button title="Try again" appearance="onboarding" onPress={props.onRetry} />
              </>
            ) : null}
            {props.loading ? <Type muted>Loading banks…</Type> : null}
            {props.moneyKit ? (
              <>
                <Type muted>Continue to browse and search banks in {countryName}.</Type>
                <Button
                  title="Open bank search"
                  appearance="onboarding"
                  loading={busy}
                  onPress={() => void select({ provider: 'moneykit', country: props.country })}
                />
              </>
            ) : null}
            {props.country && !props.moneyKit && matches.length > 0 ? (
              <Type variant="headline">{term.trim() ? 'Matching banks' : 'Available banks'}</Type>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Connect ${item.name}, ${countryName}`}
            disabled={busy}
            style={({ pressed }) => [
              row,
              { flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() =>
              void select({
                provider: 'saltedge',
                country: item.country,
                providerCode: item.providerCode,
              })
            }
          >
            <BankMark name={item.name} uri={item.logoUrl} />
            <View style={{ flex: 1, gap: 4 }}>
              <Type>{item.name}</Type>
              {props.banks.filter((bank) => bank.name === item.name).length > 1 ? (
                <Type variant="caption" muted>
                  {item.mode === 'oauth' ? 'Bank sign-in' : 'Online banking'} · Option{' '}
                  {props.banks
                    .filter((bank) => bank.name === item.name)
                    .findIndex((bank) => bank.providerCode === item.providerCode) + 1}
                </Type>
              ) : null}
            </View>
            <Type muted>›</Type>
          </Pressable>
        )}
        ListEmptyComponent={
          props.country &&
          !props.moneyKit &&
          !props.loading &&
          !props.error &&
          !props.countriesError ? (
            <View style={{ gap: 12, paddingVertical: 20 }}>
              <Type variant="headline">
                {term.trim() ? 'No matching banks' : 'No available banks here'}
              </Type>
              <Type muted>
                {term.trim()
                  ? 'Check the country or try another bank name.'
                  : 'No supported banks are currently available for this country.'}
              </Type>
              {term.trim() ? <TextButton title="Clear search" onPress={() => setTerm('')} /> : null}
            </View>
          ) : null
        }
      />
      <View style={{ paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 20) }}>
        {props.country ? (
          <Type variant="caption" muted style={{ paddingBottom: 16 }}>
            Secure connection via {props.moneyKit ? 'MoneyKit' : 'Salt Edge'}. Availability depends
            on your bank and account.
          </Type>
        ) : null}
        <View style={{ gap: 8 }}>
          <Button
            title={props.country ? 'Change country' : 'Choose country'}
            appearance="onboarding"
            disabled={busy}
            onPress={() => {
              Keyboard.dismiss();
              setChoosingCountry(true);
            }}
          />
        </View>
        <TextButton title="Back" disabled={busy} onPress={back} />
      </View>
    </View>
  );
}

function bankTitle(code: string, name?: string) {
  const adjectives: Record<string, string> = {
    IT: 'Italian',
    US: 'American',
    GB: 'British',
    DE: 'German',
    FR: 'French',
    ES: 'Spanish',
    LT: 'Lithuanian',
    NL: 'Dutch',
    IE: 'Irish',
    PT: 'Portuguese',
    CH: 'Swiss',
    AT: 'Austrian',
    BE: 'Belgian',
    PL: 'Polish',
  };
  return adjectives[code]
    ? `Connect your ${adjectives[code]} Banks`
    : name
      ? `Connect your banks in ${name}`
      : 'Connect your bank';
}
