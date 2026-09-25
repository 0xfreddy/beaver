import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RoundupPercentage } from '@roundups/types';
import { Button, Screen, Type } from './ui';
import { SetupPage } from './setup-page';
import { AppSymbol } from './app-symbol';
import { OnboardingAnimation } from './onboarding-animation';
import { ProviderSegmentedControl } from './provider-segmented-control';
import { useTheme } from '../theme';
import { useAuth } from '../providers/auth-provider';
import { apiRequest } from '../lib/api';
import { useLive, type InvestmentPolicy } from '../lib/live';
import { posthog } from '../lib/telemetry';

type FixedPercentage = Exclude<RoundupPercentage, 0 | 100>;

const fixedOptions = [1, 2, 5, 8, 10, 20] as const satisfies readonly FixedPercentage[];

function isFixedPercentage(value: RoundupPercentage | null | undefined): value is FixedPercentage {
  return value !== null && value !== undefined && value > 0 && value < 100;
}

/** Both entry points edit the same confirmed account policy. Saving never enables investing. */
export function RoundupRules({ onContinue }: { onContinue?: () => void }) {
  const auth = useAuth();
  return <Rules key={auth.user?.id ?? 'signed-out'} onContinue={onContinue} />;
}

function Rules({ onContinue }: { onContinue?: () => void }) {
  const auth = useAuth();
  const cache = useQueryClient();
  const policy = useLive<InvestmentPolicy>('/v1/investment-policy');
  const [draft, setDraft] = useState<RoundupPercentage | null>(onContinue ? 0 : null);
  const [fixedDraft, setFixedDraft] = useState<FixedPercentage | null>(null);
  const storedPercentage = policy.data?.roundupPercentage;
  const fixedPercentage =
    fixedDraft ?? (!onContinue && isFixedPercentage(storedPercentage) ? storedPercentage : 10);
  const fixedInvestment = `$${(fixedPercentage / 10).toFixed(2)}`;
  const legacyRule = !onContinue && draft === null && policy.data?.roundingIncrementCents === 1000;
  const percentage = draft ?? (onContinue ? 0 : legacyRule ? null : (storedPercentage ?? null));

  const mutation = useMutation({
    mutationFn: async () => {
      if (percentage === null) throw new Error('Choose a roundup rule to continue.');
      if (!auth.session || !policy.data || policy.isError)
        throw new Error('Refresh your account and try again.');
      const confirmed = await apiRequest<InvestmentPolicy>(
        auth.getAccessToken,
        '/v1/investment-policy/roundup-rule',
        {
          method: 'PATCH',
          body: JSON.stringify({ percentage }),
        },
      );
      if (confirmed.roundupPercentage !== percentage || confirmed.roundingIncrementCents !== 100)
        throw new Error('Your rule was not confirmed. Please try again.');
      cache.setQueryData(['live', auth.user?.id, '/v1/investment-policy'], confirmed);
      return confirmed;
    },
    onSuccess: () => {
      posthog?.capture('roundup_rule_saved', { roundup_percentage: percentage });
      if (onContinue) onContinue();
      else router.back();
    },
  });

  const choose = (value: RoundupPercentage) => {
    if (mutation.isPending) return;
    if (percentage !== value) void Haptics.selectionAsync().catch(() => {});
    setDraft(value);
  };
  const chooseFixed = (value: FixedPercentage) => {
    if (mutation.isPending) return;
    if (percentage !== value) void Haptics.selectionAsync().catch(() => {});
    setFixedDraft(value);
    setDraft(value);
  };
  const fixedSelected = isFixedPercentage(percentage);

  const actions = (
    <>
      {mutation.error || policy.error ? (
        <Type accessibilityRole="alert">{mutation.error?.message ?? policy.error?.message}</Type>
      ) : null}
      <Button
        appearance="onboarding"
        title={onContinue ? 'Continue' : 'Save rule'}
        loading={mutation.isPending}
        disabled={
          percentage === null || !policy.data || policy.isError || mutation.isPending || legacyRule
        }
        onPress={() => mutation.mutate()}
      />
    </>
  );

  const content = (
    <>
      {legacyRule ? (
        <Type muted>Current rule: next $10. Choose a new rule for future purchases.</Type>
      ) : null}
      <View pointerEvents="none">
        <OnboardingAnimation name="roundup-coin-sorter" height={100} loop transparent />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Roundup rule" style={styles.rules}>
        <RuleCard
          title="To the dollar"
          description="Invest the difference to the next whole dollar."
          example="For a $9.20 purchase"
          invested="$0.80"
          detail="Your purchase rounds up to $10.00."
          selected={percentage === 0}
          disabled={mutation.isPending}
          onPress={() => choose(0)}
        />
        <RuleCard
          title="Fixed percentage"
          description="Pick the % of each purchase to invest."
          example={`${fixedPercentage}% of a $10 purchase`}
          invested={fixedInvestment}
          selected={fixedSelected}
          disabled={mutation.isPending}
          onPress={() => choose(fixedPercentage)}
          controls={
            <View onTouchEnd={(event) => event.stopPropagation()} style={styles.percentageSelector}>
              <ProviderSegmentedControl
                accessibilityLabel="Fixed roundup percentage"
                value={`${fixedPercentage}%`}
                options={[
                  ...(fixedPercentage === 3 ? (['3%'] as const) : []),
                  ...fixedOptions.map((value) => `${value}%`),
                ]}
                onChange={(value) => chooseFixed(Number.parseInt(value, 10) as FixedPercentage)}
              />
            </View>
          }
        />
        <RuleCard
          title="Match"
          description="Invest the same amount you spend."
          example="For a $10 purchase"
          invested="$10.00"
          detail="Your stock buy matches the card spend."
          selected={percentage === 100}
          disabled={mutation.isPending}
          onPress={() => choose(100)}
        />
      </View>
    </>
  );

  if (!onContinue)
    return (
      <Screen
        title="Choose your Roundup"
        topPadding={24}
        overlay={<View style={styles.sheetActions}>{actions}</View>}
      >
        <View style={[styles.content, { paddingBottom: 150 }]}>{content}</View>
      </Screen>
    );

  return (
    <SetupPage
      title="Choose your Roundup"
      actions={actions}
      topPadding={12}
      contentStyle={styles.content}
    >
      {content}
    </SetupPage>
  );
}

function RuleCard({
  title,
  description,
  example,
  invested,
  detail,
  selected,
  disabled,
  controls,
  onPress,
}: {
  title: string;
  description: string;
  example: string;
  invested: string;
  detail?: string;
  selected: boolean;
  disabled: boolean;
  controls?: ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${description}. ${example}, invest ${invested}${detail ? `. ${detail}` : ''}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.ink : colors.line,
          opacity: disabled ? 0.48 : pressed ? 0.74 : 1,
        },
      ]}
    >
      <View style={styles.cardIntro}>
        <View style={styles.cardHeading}>
          <Type style={styles.cardTitle}>{title}</Type>
          <View
            accessible={false}
            style={[
              styles.radio,
              {
                borderColor: selected ? colors.ink : colors.line,
                backgroundColor: selected ? colors.ink : 'transparent',
              },
            ]}
          >
            {selected ? <AppSymbol name="check" color={colors.background} size={13} /> : null}
          </View>
        </View>
        <Type muted style={styles.description}>
          {description}
        </Type>
      </View>
      {controls}
      <View style={[styles.divider, { backgroundColor: colors.line }]} />
      <View style={styles.exampleRow}>
        <Type muted style={styles.exampleCopy}>
          {example}
        </Type>
        <Type style={styles.investAmount}>{invested}</Type>
      </View>
      {detail ? (
        <Type muted style={styles.detailCopy}>
          {detail}
        </Type>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheetActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 20,
  },
  content: { gap: 20, paddingBottom: 120 },
  rules: { gap: 12 },
  card: {
    borderWidth: 2,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: 20,
    gap: 14,
  },
  // Title and description sit close together; the radio stays pinned to the
  // trailing edge of the heading row, clear of the wrapped title.
  cardIntro: { gap: 5 },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  radio: {
    width: 23,
    height: 23,
    borderRadius: 999,
    borderWidth: 1.5,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  description: { fontSize: 16, lineHeight: 23 },
  percentageSelector: { marginHorizontal: -4 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 2 },
  exampleRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  exampleCopy: { flex: 1, fontSize: 15, lineHeight: 21 },
  detailCopy: { fontSize: 13, lineHeight: 18 },
  investAmount: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
});
