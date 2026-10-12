import { ScrollView, View } from 'react-native';
import { Tray } from './reacticx/tray';
import { BankMark } from './bank-mark';
import { Button, TextButton, Type } from './ui';
import { roundupStateLabel } from '../lib/purchases';

export type BankUnlinkImpact = {
  connection: {
    id: string;
    institutionName: string | null;
    institutionAvatar?: string | null;
    institutionLogoFallback?: string | null;
  };
  contributionSharePercent: number | null;
  items: {
    merchant: string;
    purchaseCents: number;
    roundupCents: number;
    currency: string;
    symbol: string;
    status: string;
    preview: boolean;
  }[];
};

export function BankUnlinkSheet({
  unlink,
  busy,
  message,
  onClose,
  onConfirm,
}: {
  unlink: BankUnlinkImpact | null;
  busy: boolean;
  message: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Tray
      visible={!!unlink}
      title={`Unlink ${unlink?.connection.institutionName || 'this bank'}?`}
      dismissible={!busy}
      onClose={onClose}
      footer={
        <>
          <Button appearance="onboarding" title="Unlink bank" loading={busy} onPress={onConfirm} />
          <TextButton title="Keep bank connected" disabled={busy} onPress={onClose} />
        </>
      }
    >
      {unlink ? (
        <ScrollView contentContainerStyle={{ gap: 20 }}>
          <BankMark
            name={unlink.connection.institutionName || 'Bank'}
            uri={unlink.connection.institutionAvatar}
            fallbackUri={unlink.connection.institutionLogoFallback}
            size={48}
          />
          <Type>
            {unlink.contributionSharePercent == null
              ? 'There is not enough live USD history to estimate this bank’s contribution.'
              : `This bank supplied ${unlink.contributionSharePercent}% of your USD bank roundups in the last 30 days. Unlinking removes this source of future stock purchases.`}
          </Type>
          <Type muted>
            Your existing stocks stay in your wallet. Future and unreserved roundups stop; already
            signed orders can still settle.
          </Type>
          <Type variant="headline">Recent purchases from this bank</Type>
          {unlink.items.length === 0 ? (
            <Type muted>No roundup history yet.</Type>
          ) : (
            unlink.items.map((item, i) => (
              <View key={i} style={{ gap: 4 }}>
                <Type>
                  {item.merchant} · {item.currency} {(item.purchaseCents / 100).toFixed(2)}
                </Type>
                <Type variant="caption" muted>
                  {item.currency} {(item.roundupCents / 100).toFixed(2)} → {item.symbol} ·{' '}
                  {item.preview ? 'Preview' : roundupStateLabel(item.status)}
                </Type>
              </View>
            ))
          )}
          {message ? <Type accessibilityRole="alert">{message}</Type> : null}
        </ScrollView>
      ) : null}
    </Tray>
  );
}
