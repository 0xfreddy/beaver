import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDeferredValue } from 'react';
import { CompanyMark } from '../company-mark';
import { useTheme } from '../../theme';
import { Tray } from '../reacticx/tray';
import { NumberFlow } from '../reacticx/number-flow';
import { Button, Type } from '../ui';
import { AppSymbol } from '../app-symbol';
import { ReceiptDatePicker } from '../receipt-date-picker';
import { money } from '../../lib/purchases';
import { matchesStockQuery } from '../../lib/stock-search';
import { useLive } from '../../lib/live';
import { RECEIPT_CURRENCIES, receiptCurrency } from '../../lib/receipt-scan-session';

export type EditableReceipt = {
  merchant: string;
  symbol: string | null;
  date: string;
  currency: string;
  amountCents: number;
};

const MAX_CENTS = 100_000_000;

/** Editing the scanned receipt in the Tray, with a NumberFlow total adjusted in steps of 1. */
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
  const markets = useLive<{ items: { symbol: string; name: string; issuer: string }[] }>(
    '/v1/trading/markets',
    visible,
    false,
  );
  const [merchant, setMerchant] = useState(value.merchant);
  // The ticker picked from the suggestions; typing by hand clears it so the
  // confirm falls back to the merchant mapping or the fallback stock.
  const [symbol, setSymbol] = useState<string | null>(value.symbol);
  const [date, setDate] = useState(value.date);
  const [currency, setCurrency] = useState(receiptCurrency(value.currency));
  const [amountCents, setAmountCents] = useState(value.amountCents);
  // Stepping the amount or switching currency invalidates the scanned USD conversion.
  const [stale, setStale] = useState(false);
  const merchantQuery = useDeferredValue(merchant.trim());
  const suggestions =
    merchantQuery.length > 0
      ? (markets.data?.items ?? [])
          .filter(
            (stock) =>
              matchesStockQuery(stock.symbol, stock.name, merchantQuery) &&
              stock.name.toLocaleLowerCase() !== merchantQuery.toLocaleLowerCase(),
          )
          .slice(0, 6)
      : [];

  // Reset from the receipt only when its actual values change, so re-renders
  // of the parent (live queries polling) never wipe in-progress edits.
  useEffect(() => {
    if (!visible) return;
    setMerchant(value.merchant);
    setSymbol(value.symbol);
    setDate(value.date);
    setCurrency(receiptCurrency(value.currency));
    setAmountCents(value.amountCents);
    setStale(false);
  }, [
    visible,
    value.merchant,
    value.symbol,
    value.date,
    value.currency,
    value.amountCents,
  ]);

  function step(delta: number) {
    void Haptics.selectionAsync().catch(() => {});
    setStale(true);
    setAmountCents((cents) => Math.min(MAX_CENTS, Math.max(1, cents + delta)));
  }

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const savable = merchant.trim().length >= 2 && amountCents > 0 && validDate;
  const effectiveCents = stale ? amountCents : (policy.usdCents ?? amountCents);
  const calculated = policy.percentage
    ? Math.floor((effectiveCents * policy.percentage + 50) / 100)
    : (100 - (effectiveCents % 100)) % 100;
  const roundup = Math.min(calculated, policy.maxRoundupCents);
  const roundCurrency = !stale && policy.usdCents != null ? 'USD' : currency;

  return (
    <Tray
      visible={visible}
      title="Edit receipt"
      onClose={onClose}
      footer={
        <Button
          appearance="onboarding"
          title="Save changes"
          disabled={!savable}
          onPress={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => {},
            );
            onSave(
              {
                merchant: merchant.trim(),
                symbol,
                date,
                currency,
                amountCents,
              },
              stale,
            );
          }}
        />
      }
    >
      <ScrollView
        style={{ flexShrink: 1, flexGrow: 0 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel="Merchant"
            value={merchant}
            onChangeText={(text) => {
              setMerchant(text);
              setSymbol(null);
            }}
            placeholder="Where was this purchase?"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
          />
          {suggestions.map((stock) => (
            <Pressable
              key={stock.symbol}
              accessibilityRole="button"
              accessibilityLabel={`Use ${stock.name} (${stock.symbol})`}
              onPress={() => {
                setMerchant(stock.name);
                setSymbol(stock.symbol);
                void Haptics.selectionAsync().catch(() => {});
              }}
              style={({ pressed }) => [
                styles.suggestion,
                { borderColor: colors.line, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <CompanyMark symbol={stock.symbol} size={36} />
              <Type numberOfLines={1} style={{ flex: 1 }}>
                {stock.name}
              </Type>
              <Type variant="caption" muted>
                {stock.symbol}
              </Type>
            </Pressable>
          ))}
          {symbol ? (
            <Type variant="caption" muted>
              This purchase rounds up into {symbol}.
            </Type>
          ) : null}
        </View>
        <View style={{ gap: 12, alignItems: 'center' }}>
          <View style={styles.amountRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease total by one"
              onPress={() => step(-100)}
              style={({ pressed }) => [
                styles.stepButton,
                { backgroundColor: colors.soft, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <AppSymbol name="minus" color={colors.ink} size={20} />
            </Pressable>
            <View style={styles.amountValue}>
              {currency === 'USD' ? (
                <Type style={styles.currencySign}>$</Type>
              ) : null}
              <NumberFlow
                value={amountCents / 100}
                decimals={2}
                groupSeparator=","
                fontSize={44}
                color={colors.ink}
                fontWeight="600"
              />
              {currency !== 'USD' ? (
                <Type variant="caption" muted style={{ marginBottom: 6 }}>
                  {' '}
                  {currency}
                </Type>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase total by one"
              onPress={() => step(100)}
              style={({ pressed }) => [
                styles.stepButton,
                { backgroundColor: colors.soft, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <AppSymbol name="plus" color={colors.ink} size={20} />
            </Pressable>
          </View>
          <View style={styles.centsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease total by one cent"
              onPress={() => step(-1)}
              style={({ pressed }) => [
                styles.centsButton,
                { borderColor: colors.line, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Type variant="caption" muted>
                − 0.01
              </Type>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase total by one cent"
              onPress={() => step(1)}
              style={({ pressed }) => [
                styles.centsButton,
                { borderColor: colors.line, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Type variant="caption" muted>
                + 0.01
              </Type>
            </Pressable>
          </View>
          {!stale && policy.usdCents != null ? (
            <Type variant="caption" muted>
              Converted to USD {(policy.usdCents / 100).toFixed(2)} at today’s rate.
            </Type>
          ) : null}
        </View>
        <View style={[styles.roundupCard, { backgroundColor: colors.soft }]}>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Type variant="headline">Roundup</Type>
            <Type variant="caption" muted>
              {policy.percentage
                ? `${policy.percentage}% of this purchase`
                : 'To the next whole dollar'}
            </Type>
          </View>
          <Type
            style={{
              fontSize: 26,
              lineHeight: 32,
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
            }}
          >
            {money(roundup, roundCurrency)}
          </Type>
        </View>
        <View style={{ gap: 8 }}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Receipt currency"
            style={styles.currencyGrid}
          >
            {RECEIPT_CURRENCIES.map((code) => {
              const selected = currency === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityLabel={code}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (selected) return;
                    void Haptics.selectionAsync().catch(() => {});
                    setCurrency(code);
                    setStale(true);
                  }}
                  style={[
                    styles.currencyChip,
                    {
                      borderColor: selected ? colors.ink : colors.line,
                      backgroundColor: selected ? colors.ink : colors.surface,
                    },
                  ]}
                >
                  <Type
                    style={{
                      color: selected ? colors.background : colors.ink,
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    {code}
                  </Type>
                </Pressable>
              );
            })}
          </View>
        </View>
        <ReceiptDatePicker value={date} onChange={setDate} />
      </ScrollView>
    </Tray>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  suggestion: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    minHeight: 96,
  },
  amountValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // A whole line height keeps the currency sign from clipping next to NumberFlow.
  currencySign: { fontSize: 34, lineHeight: 48, fontWeight: '600', marginRight: 4 },
  stepButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centsButton: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyChip: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  roundupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: 20,
  },
});
