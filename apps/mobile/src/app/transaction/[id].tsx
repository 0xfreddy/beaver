import { useState, type PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, Type } from '../../components/ui';
import { PurchaseReceipt } from '../../components/purchase-receipt';
import { AccountGate } from '../../components/account-gate';
import { useLive } from '../../lib/live';
import { cancelRoundup as cancelRoundupRequest } from '../../lib/api';
import { canCancelRoundup, needsStockChoice, type Purchase } from '../../lib/purchases';
import { useAuth } from '../../providers/auth-provider';
import { CancelRoundupTray } from '../../components/cancel-roundup-tray';

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
function LiveDetails({ id }: { id: string }) {
  const auth = useAuth();
  const cache = useQueryClient();
  const query = useLive<Purchase>(`/v1/transactions/${encodeURIComponent(id)}`);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  async function cancelRoundup() {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelRoundupRequest(auth.getAccessToken, id);
      await cache.invalidateQueries({ queryKey: ['live', auth.user?.id] });
      setCancelSheetOpen(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setCancelling(false);
    }
  }
  const item = query.data;
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
            {canCancelRoundup(item) ? (
              <Card style={{ gap: 12 }}>
                <Type variant="headline">Roundup controls</Type>
                <Type muted>This roundup has not been reserved by an investment order yet.</Type>
                <Button
                  title="Cancel roundup"
                  secondary
                  loading={cancelling}
                  onPress={() => {
                    setCancelError(null);
                    setCancelSheetOpen(true);
                  }}
                />
              </Card>
            ) : null}
            {needsStockChoice(item) ? (
              <Card style={{ gap: 12 }}>
                <Type variant="headline" accessibilityRole="alert">
                  Choose stock
                </Type>
                <Type muted>
                  Choose a fallback stock for purchases without a stock match. Eligible purchases
                  start investing after you save your choice.
                </Type>
                <Button title="Choose stock" onPress={() => router.push('/settings/fallback')} />
              </Card>
            ) : null}
          </>
        ) : null}
      </AccountGate>
      <CancelRoundupTray
        item={cancelSheetOpen && item ? item : null}
        busy={cancelling}
        error={cancelError}
        onClose={() => {
          if (!cancelling) setCancelSheetOpen(false);
        }}
        onConfirm={() => void cancelRoundup()}
      />
    </DetailSheet>
  );
}
