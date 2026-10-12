import { View } from 'react-native';
import { useLive } from '../lib/live';
import { type Purchase, purchaseStatus } from '../lib/purchases';
import { Type } from './ui';

export function ReceiptOutcome({
  transactionId,
  name,
  preview,
  alreadyConfirmed,
  dark = false,
}: {
  transactionId: string | null;
  name: string | null;
  preview: boolean;
  alreadyConfirmed: boolean;
  dark?: boolean;
}) {
  const result = useLive<Purchase>(
    `/v1/transactions/${transactionId ?? ''}`,
    !!transactionId && !preview,
    3000,
  );
  const complete = result.data?.roundupStatus === 'redeemed';
  const clean = (name ?? result.data?.symbol ?? 'Your').replace(/\s+xStock$/i, '');
  const color = dark ? '#fff' : undefined;
  return (
    <View style={{ gap: 18, alignItems: 'center' }}>
      <Type variant="title" style={{ textAlign: 'center', color }}>
        {alreadyConfirmed
          ? 'Already saved'
          : preview
            ? 'Saved as preview'
            : `${clean} roundup ${complete ? 'completed' : 'submitted'}`}
      </Type>
      {complete ? (
        <>
          <Type style={{ fontSize: 28, lineHeight: 36, textAlign: 'center', color }}>
            You now hold {clean} stock
          </Type>
          <Type muted style={{ color: dark ? '#aaa' : undefined }}>
            (pretty cool)
          </Type>
        </>
      ) : (
        <Type muted style={{ textAlign: 'center', color: dark ? '#aaa' : undefined }}>
          {preview
            ? 'No money invested.'
            : result.data
              ? purchaseStatus(result.data)
              : 'Check Activity for its progress.'}
        </Type>
      )}
    </View>
  );
}
