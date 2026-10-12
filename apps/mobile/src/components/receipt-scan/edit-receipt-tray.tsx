import { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CompanyMark } from '../company-mark';
import { useTheme } from '../../theme';
import { Tray } from '../reacticx/tray';
import { Button, TextButton, Type } from '../ui';
import { ExpandedSearchBar } from '../reacticx/gooey-search-tabs';
import { ReceiptDatePicker } from '../receipt-date-picker';
import { ReceiptAmountWheel } from '../receipt-amount-wheel';
import { money } from '../../lib/purchases';
import { matchesStockQuery } from '../../lib/stock-search';
import { useLive } from '../../lib/live';
import { RECEIPT_CURRENCIES, receiptCurrency } from '../../lib/receipt-scan-session';
import { currencyArtwork } from './currency-artwork';

export type EditableReceipt = {
  merchant: string;
  symbol: string | null;
  date: string;
  currency: string;
  amountCents: number;
};
export function EditReceiptTray({
  visible,
  onClose,
  value,
  policy,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  value: EditableReceipt;
  policy: { percentage: number; maxRoundupCents: number; usdCents: number | null };
  onSave: (next: EditableReceipt, conversionStale: boolean) => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const markets = useLive<{ items: { symbol: string; name: string; issuer: string }[] }>(
    '/v1/trading/markets',
    visible,
    false,
  );
  const [draft, setDraft] = useState(value);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setStep(0);
      setQuery('');
    }
  }, [visible, value.merchant, value.symbol, value.date, value.currency, value.amountCents]); // eslint-disable-line react-hooks/exhaustive-deps
  const stale = draft.amountCents !== value.amountCents || draft.currency !== value.currency;
  const usd = draft.currency === 'USD' ? draft.amountCents : !stale ? policy.usdCents : null;
  const rounded =
    usd === null
      ? null
      : Math.min(
          policy.maxRoundupCents,
          policy.percentage
            ? Math.floor((usd * policy.percentage + 50) / 100)
            : (100 - (usd % 100)) % 100,
        );
  const roundupCard = (
    <View style={{ padding: 20, gap: 8, borderRadius: 22, backgroundColor: colors.soft }}>
      <Type muted>Roundup</Type>
      <Type
        style={{ fontSize: 44, lineHeight: 52, fontWeight: '600', fontVariant: ['tabular-nums'] }}
      >
        {rounded === null ? '—' : money(rounded, 'USD')}
      </Type>
      {rounded === null ? (
        <Type variant="caption" muted>
          Calculated in USD when you confirm.
        </Type>
      ) : null}
    </View>
  );
  const valid =
    draft.amountCents > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
    draft.merchant.trim().length >= 2;
  const stocks = (markets.data?.items ?? []).filter((s) =>
    matchesStockQuery(s.symbol, s.name, query),
  );
  return (
    <Tray
      visible={visible}
      title={['Purchase amount', 'Currency & date', 'Choose a stock'][step]!}
      onClose={onClose}
      footer={
        <View style={{ gap: 6 }}>
          <Button
            appearance="onboarding"
            title={step === 2 ? 'Save changes' : 'Continue'}
            disabled={step === 0 ? draft.amountCents <= 0 : step === 2 ? !valid : false}
            onPress={() => {
              Keyboard.dismiss();
              if (step < 2) setStep(step + 1);
              else onSave({ ...draft, currency: receiptCurrency(draft.currency) }, stale);
            }}
          />
          <TextButton
            title={step ? 'Back' : 'Cancel'}
            onPress={() => {
              Keyboard.dismiss();
              if (step) setStep(step - 1);
              else onClose();
            }}
          />
        </View>
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ gap: 18 }}
      >
        {step === 0 ? (
          <>
            <Type
              style={{
                fontSize: 40,
                lineHeight: 50,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {money(draft.amountCents, draft.currency)}
            </Type>
            {Platform.OS === 'ios' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {['Thousands', 'Units', 'Cents'].map((t) => (
                  <Type key={t} variant="caption" muted>
                    {t}
                  </Type>
                ))}
              </View>
            ) : null}
            <ReceiptAmountWheel
              value={draft.amountCents}
              onChange={(amountCents) => setDraft((d) => ({ ...d, amountCents }))}
            />
            {roundupCard}
          </>
        ) : step === 1 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={Math.min(width - 90, 280) + 12}
              decelerationRate="fast"
              contentContainerStyle={{ gap: 12 }}
            >
              {RECEIPT_CURRENCIES.map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityLabel={code}
                  accessibilityState={{ selected: draft.currency === code }}
                  onPress={() => {
                    setDraft((d) => ({ ...d, currency: code }));
                    void Haptics.selectionAsync().catch(() => {});
                  }}
                  style={{
                    width: Math.min(width - 90, 280),
                    height: 220,
                    borderRadius: 26,
                    borderWidth: 2,
                    borderColor: draft.currency === code ? colors.ink : colors.line,
                    backgroundColor: colors.soft,
                    padding: 18,
                    overflow: 'hidden',
                  }}
                >
                  <Type variant="headline">{code}</Type>
                  <Image
                    source={currencyArtwork[code]}
                    resizeMode="contain"
                    style={{ width: '100%', height: 160 }}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <ReceiptDatePicker
              value={draft.date}
              onChange={(date) => setDraft((d) => ({ ...d, date }))}
            />
          </>
        ) : (
          <>
            {roundupCard}
            <ExpandedSearchBar placeholder="Search stocks" value={query} onChangeText={setQuery} />
            {markets.isPending ? <Type muted>Loading stocks…</Type> : null}
            {markets.isError ? (
              <Button title="Try again" onPress={() => void markets.refetch()} />
            ) : null}
            {!markets.isPending && !markets.isError && !stocks.length ? (
              <Type muted>No matching stocks</Type>
            ) : null}
            {stocks.map((stock) => (
              <Pressable
                key={stock.symbol}
                accessibilityRole="radio"
                accessibilityLabel={stock.symbol}
                accessibilityState={{ selected: draft.symbol === stock.symbol }}
                onPress={() => {
                  setDraft((d) => ({
                    ...d,
                    symbol: stock.symbol,
                    merchant: stock.name.replace(/\s+xStock$/i, ''),
                  }));
                  void Haptics.selectionAsync().catch(() => {});
                }}
                style={{
                  minHeight: 64,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <CompanyMark symbol={stock.symbol} size={40} />
                <Type style={{ flex: 1 }}>{stock.symbol}</Type>
                {draft.symbol === stock.symbol ? <Type>✓</Type> : null}
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Tray>
  );
}
