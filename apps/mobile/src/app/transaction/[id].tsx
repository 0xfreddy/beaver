import { useState, type PropsWithChildren } from 'react';
import { Linking, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, Type } from '../../components/ui';
import { CompanyMark } from '../../components/company-mark';
import { PurchaseReceipt } from '../../components/purchase-receipt';
import { AccountGate } from '../../components/account-gate';
import { useLive } from '../../lib/live';
import { apiRequest } from '../../lib/api';
import { solscanTxUrl } from '../../lib/explorer';
import type { Purchase } from '../../lib/purchases';
import { useAuth } from '../../providers/auth-provider';

export default function TransactionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LiveDetails id={id} />;
}
function DetailSheet({ children }: PropsWithChildren) {
  const { fontScale } = useWindowDimensions();
  return (
    <Screen>
      <Type
        variant="headline"
        accessibilityRole="header"
        style={{ fontSize: fontScale > 1.3 ? 20 : 28, lineHeight: fontScale > 1.3 ? 28 : 34 }}
      >
        Purchase details
      </Type>
      {children}
    </Screen>
  );
}
function ExplorerLink({ item }: { item: Purchase }) {
  const signature = item.signature;
  if (!signature) return null;
  return (
    <Card style={{ gap: 12 }}>
      <Type variant="headline">Invested on Solana</Type>
      <Type muted>
        The roundup order is confirmed on-chain. Follow it in the blockchain explorer.
      </Type>
      <Button
        title="Open in Solscan"
        secondary
        onPress={() => void Linking.openURL(solscanTxUrl(signature))}
      />
    </Card>
  );
}
function CompanyDetails({ item }: { item: Purchase }) {
  if (!item.symbol) return null;
  return (
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CompanyMark symbol={item.symbol} size={38} />
        <View style={{ flex: 1 }}>
          <Type variant="headline">{item.symbol}</Type>
          <Type variant="caption" muted>
            Spot xStock · No leverage
          </Type>
        </View>
      </View>
      <Type variant="headline">Why this company?</Type>
      <Type muted>
        {item.mappingMethod === 'user'
          ? 'You selected this company for this purchase.'
          : item.mappingMethod === 'direct'
            ? 'This purchase matches the merchant directly.'
            : 'This purchase follows a company mapping.'}{' '}
        Investments buy a tokenized product, not shares held in a brokerage account.
      </Type>
    </Card>
  );
}
function LiveDetails({ id }: { id: string }) {
  const auth = useAuth();
  const cache = useQueryClient();
  const query = useLive<Purchase>(`/v1/transactions/${encodeURIComponent(id)}`);
  const markets = useLive<{ items: { symbol: string; name: string }[] }>(
    '/v1/trading/markets',
    !!query.data && !query.data.symbol && !query.data.pending && !query.data.removedAt,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(auth.getAccessToken, `/v1/transactions/${encodeURIComponent(id)}/mapping`, {
        method: 'POST',
        body: JSON.stringify({ symbol: selected }),
      });
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const item = query.data;
  const needsMapping =
    item &&
    !item.symbol &&
    !item.pending &&
    !item.removedAt &&
    ['mapping_confirmation_required'].includes(item.reason || '');
  return (
    <DetailSheet>
      <AccountGate>
        {query.isPending ? <Type muted>Loading your purchase…</Type> : null}
        {query.error ? (
          <>
            <Type accessibilityRole="alert">{query.error.message}</Type>
            <Button title="Try again" onPress={() => void query.refetch()} />
          </>
        ) : null}
        {item ? (
          <>
            <PurchaseReceipt key={item.id} item={item} />
            <CompanyDetails item={item} />
            <ExplorerLink item={item} />
            {needsMapping ? (
              <Card>
                <Type variant="headline">Choose a company</Type>
                <Type muted>
                  We couldn’t confidently match this merchant. Your choice applies to this purchase.
                  It creates a roundup only if the purchase is eligible.
                </Type>
                {markets.data?.items.map((market) => (
                  <Button
                    key={market.symbol}
                    title={`${selected === market.symbol ? 'Selected: ' : ''}${market.name} · ${market.symbol}`}
                    secondary
                    disabled={busy}
                    onPress={() => setSelected(market.symbol)}
                  />
                ))}
                {markets.error ? (
                  <Type accessibilityRole="alert">{markets.error.message}</Type>
                ) : null}
                {selected ? (
                  <Button
                    title={`Confirm ${selected} for this purchase`}
                    loading={busy}
                    onPress={() => void confirm()}
                  />
                ) : null}
                {error ? <Type accessibilityRole="alert">{error}</Type> : null}
              </Card>
            ) : null}
          </>
        ) : null}
      </AccountGate>
    </DetailSheet>
  );
}
