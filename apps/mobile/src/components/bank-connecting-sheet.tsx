import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, TextButton, Type } from './ui';
import { bankRecoveryAction, type BankConnectStep } from '../lib/bank-connect-state';
import { OnboardingAnimation } from './onboarding-animation';
import { useTheme } from '../theme';

// Keep completion on the banks screen. Presenting a native Modal while the
// provider's sheet is dismissing can leave an empty UIKit presentation behind,
// especially when completion succeeds before its presentation animation ends.
export function BankConnectingSheet({
  step,
  canFinalize,
  onRetryLink,
  onRetryFinalize,
  onDismiss,
}: {
  step: BankConnectStep;
  canFinalize: boolean;
  onRetryLink: () => void;
  onRetryFinalize: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  if (step.kind === 'idle') return null;
  if (step.kind === 'success')
    return (
      <View style={[styles.status, { flexGrow: 1 }]} accessibilityLiveRegion="polite">
        <Type variant="headline">{step.bank ?? 'Your bank'} connected</Type>
        <OnboardingAnimation name="bank-bridge-builder" height={180} loop />
        <View style={{ marginTop: 'auto', gap: 16, paddingTop: 24 }}>
          <Type muted>Your purchases are syncing.</Type>
          <Button appearance="onboarding" title="Continue" onPress={onDismiss} />
        </View>
      </View>
    );
  const recovery = step.kind === 'failed' ? bankRecoveryAction(step.reason, canFinalize) : null;
  const primary =
    step.kind === 'failed'
      ? recovery === 'view_banks'
        ? { title: 'View banks', onPress: onDismiss }
        : recovery === 'connect'
          ? { title: 'Connect again', onPress: onRetryLink }
          : { title: 'Try again', onPress: onRetryFinalize }
      : null;
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Type variant="headline">
        {step.kind === 'failed' ? 'Couldn’t connect' : 'Finishing your connection'}
      </Type>
      <View style={styles.wait}>
        {step.kind === 'finishing' ? <ActivityIndicator color={colors.muted} /> : null}
        <Type
          muted
          accessibilityRole={step.kind === 'failed' ? 'alert' : undefined}
          style={styles.copy}
        >
          {step.kind === 'failed' ? step.message : 'Checking your bank’s response…'}
        </Type>
      </View>
      {primary ? (
        <Button appearance="onboarding" title={primary.title} onPress={primary.onPress} />
      ) : null}
      <TextButton title="Back" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: 16, paddingVertical: 16 },
  wait: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, fontSize: 16, lineHeight: 24 },
});
