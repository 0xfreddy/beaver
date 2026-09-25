import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CompanyMark } from './company-mark';
import { Type } from './ui';
import { useTheme } from '../theme';

const notifications = [
  { symbol: 'SBUX', merchant: 'Starbucks', detail: 'Purchase rounded up', amount: '+$0.35' },
  { symbol: 'UBER', merchant: 'Uber', detail: 'Trip spare change found', amount: '+$0.80' },
  { symbol: 'NFLX', merchant: 'Netflix', detail: 'Subscription still counted', amount: '+$0.01' },
] as const;

type NotificationCardProps = {
  index?: number;
  symbol?: string;
  merchant: string;
  detail: string;
  amount?: string;
  onComplete?: () => void;
  animated?: boolean;
};

export function OnboardingNotificationStack({ onComplete }: { onComplete?: () => void }) {
  return (
    <View style={styles.stack}>
      {notifications.map((notification, index) => (
        <OnboardingNotificationCard
          key={notification.merchant}
          index={index}
          onComplete={index === notifications.length - 1 ? onComplete : undefined}
          {...notification}
        />
      ))}
    </View>
  );
}

export function OnboardingNotificationCard({
  index = 0,
  symbol,
  merchant,
  detail,
  amount,
  onComplete,
  animated = true,
}: NotificationCardProps) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const progress = useSharedValue(animated ? 0 : 1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!animated) {
      progress.set(1);
      return;
    }
    progress.set(0);
    if (!focused) return;
    progress.set(
      withDelay(
        reducedMotion ? index * 90 : 450 + index * 950,
        withTiming(
          1,
          {
            duration: reducedMotion ? 140 : 300,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          },
          (finished) => {
            if (finished && onComplete) scheduleOnRN(onComplete);
          },
        ),
      ),
    );
    return () => cancelAnimation(progress);
  }, [animated, focused, index, onComplete, progress, reducedMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: reducedMotion
      ? []
      : [{ translateY: -16 * (1 - progress.get()) }, { scale: 0.98 + progress.get() * 0.02 }],
  }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={[merchant, detail, amount].filter(Boolean).join('. ')}
      style={[
        styles.notification,
        cardStyle,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <CompanyMark symbol={symbol} size={36} />
      <View style={styles.notificationText}>
        <View style={styles.notificationRow}>
          <Type style={styles.merchant}>{merchant}</Type>
          <Type muted style={styles.now}>
            now
          </Type>
        </View>
        <View style={styles.notificationRow}>
          <Type muted style={styles.detail}>
            {detail}
          </Type>
          {amount ? <Type style={styles.amount}>{amount}</Type> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8, width: '100%' },
  notification: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    boxShadow: '0 10px 30px -18px rgba(0,0,0,0.9)',
  },
  notificationText: { flex: 1, gap: 2 },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  merchant: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  now: { fontSize: 11, lineHeight: 14 },
  detail: { flex: 1, fontSize: 13, lineHeight: 18 },
  amount: { fontSize: 13, lineHeight: 18, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
