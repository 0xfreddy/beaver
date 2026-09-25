import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { receiptAmountCents, type ReceiptLineItem } from '../../lib/receipt-scan-session';
import { money } from '../../lib/purchases';

const PAPER = '#FFFEFA';
const PAPER_INK = '#1C2027';
const PAPER_BODY = '#3E444F';
const PAPER_MUTED = '#8A8F99';
const PAPER_RULE = '#E4E2D9';

export type ReviewReceiptData = {
  merchant: string;
  category: string | null;
  date: string;
  paymentMethod: string | null;
  items: ReceiptLineItem[] | null;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  currency: string;
  usdCents: number | null;
};

function Row({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <View style={[styles.row, total && styles.rowTotal]}>
      <Text style={[styles.label, total && styles.labelTotal]}>{label}</Text>
      <Text style={[styles.value, total && styles.valueTotal]}>{value}</Text>
    </View>
  );
}

function Rule({ dashed = true }: { dashed?: boolean }) {
  return <View style={[styles.rule, dashed ? styles.ruleDashed : styles.ruleSolid]} />;
}

function TornEdge({ teeth, flipped = false }: { teeth: string; flipped?: boolean }) {
  return (
    <Svg
      width="100%"
      height={9}
      viewBox="0 0 350 9"
      preserveAspectRatio="none"
      accessibilityElementsHidden
      accessible={false}
      style={flipped ? { transform: [{ scaleY: -1 }] } : undefined}
    >
      <Path d={`M0,0 ${teeth} L350,0 Z`} fill={PAPER} />
    </Svg>
  );
}

/**
 * The scanned receipt as a review card: white paper with torn edges, the
 * Starbucks-style layout of merchant, facts, items and totals. Fixed palette
 * on purpose — it renders on the blue review screen in both themes.
 */
export function ReviewReceiptCard({ data }: { data: ReviewReceiptData }) {
  const { width } = useWindowDimensions();
  // Bottom teeth, reused upside down for the card's top edge.
  const teeth = Array.from(
    { length: 35 },
    (_, i) => `L${(i + 0.5) * 10},8 L${(i + 1) * 10},0`,
  ).join(' ');
  const cardWidth = Math.min(width - 48, 380);
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(data.date)
    ? new Date(`${data.date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
  const items = data.items ?? [];
  return (
    <View style={{ width: cardWidth }}>
      <TornEdge teeth={teeth} flipped />
      <View style={styles.paper}>
        <Text style={styles.merchant} numberOfLines={2} accessibilityRole="header">
          {data.merchant.trim() || 'Receipt'}
        </Text>
        {data.category ? <Text style={styles.category}>{data.category}</Text> : null}
        <Rule />
        <Row label="Date" value={dateLabel} />
        <Row label="Payment Method" value={data.paymentMethod ?? '—'} />
        {items.length ? (
          <>
            <Rule />
            {items.map((item, index) => (
              <Row
                key={`${item.name ?? 'item'}-${index}`}
                label={item.name?.trim() || 'Item'}
                value={
                  receiptAmountCents(item.amount) == null
                    ? '—'
                    : money(receiptAmountCents(item.amount)!, data.currency)
                }
              />
            ))}
          </>
        ) : null}
        {data.subtotalCents != null || data.taxCents != null ? (
          <>
            <Rule />
            {data.subtotalCents != null ? (
              <Row label="Subtotal" value={money(data.subtotalCents, data.currency)} />
            ) : null}
            {data.taxCents != null ? (
              <Row label="Tax" value={money(data.taxCents, data.currency)} />
            ) : null}
          </>
        ) : null}
        <Rule dashed={false} />
        <Row
          label="Total"
          value={data.totalCents == null ? '—' : money(data.totalCents, data.currency)}
          total
        />
        {data.usdCents != null && data.currency !== 'USD' ? (
          <Text style={styles.conversion}>
            Converted to USD {(data.usdCents / 100).toFixed(2)} at today’s rate.
          </Text>
        ) : null}
      </View>
      <TornEdge teeth={teeth} />
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: PAPER,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    gap: 12,
  },
  merchant: {
    color: PAPER_INK,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  category: {
    color: PAPER_MUTED,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: -6,
  },
  rule: { width: '100%' },
  ruleDashed: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: PAPER_RULE },
  ruleSolid: { borderTopWidth: 1.5, borderColor: '#D8D6CC' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 2,
  },
  rowTotal: { paddingVertical: 6 },
  label: { color: PAPER_MUTED, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  value: {
    color: PAPER_BODY,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  labelTotal: { color: PAPER_INK, fontSize: 15, fontWeight: '600' },
  valueTotal: {
    color: '#141821',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  conversion: { color: PAPER_MUTED, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
