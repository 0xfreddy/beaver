import { useState } from 'react';
import { Animated, Image, Linking, Pressable, View, useWindowDimensions } from 'react-native';
import { useSheetReveal } from '../lib/use-sheet-reveal';
import Svg, { Path } from 'react-native-svg';
import { Type } from './ui';
import { AppSymbol } from './app-symbol';
import { explorerName, explorerTxUrl } from '../lib/explorer';
import { InteractiveArt } from './interactive-art';
import { CompanyMark } from './company-mark';
import { useTheme } from '../theme';
import { money, purchaseAmount, purchaseExplanation, type Purchase } from '../lib/purchases';
/* eslint-disable @typescript-eslint/no-require-imports */
const seal = require('../../assets/illustrations/merchant-seal.png');
const starbucksSeal = require('../../assets/illustrations/starbucks-seal.png');
const receiptArt = require('../../assets/illustrations/activity-receipt.png');
/* eslint-enable @typescript-eslint/no-require-imports */

function Fact({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      style={{
        flexDirection: fontScale > 1.3 ? 'column' : 'row',
        justifyContent: 'space-between',
        gap: 5,
        paddingVertical: 5,
      }}
    >
      <Type
        variant="caption"
        muted={!total}
        style={{ flexShrink: 1, fontWeight: total ? '600' : '400' }}
      >
        {label}
      </Type>
      <Type
        variant="caption"
        style={{ fontWeight: total ? '600' : '400', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Type>
    </View>
  );
}
/** The paper travels through a hollow slot, driven by the sheet's reversible progress. */
export function PurchaseReceipt({ item }: { item: Purchase }) {
  const { colors, isDark } = useTheme();
  const roundupCents = item.reason === 'awaiting_exchange_rate' ? null : item.roundupCents;
  const { width, fontScale } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const reveal = useSheetReveal(height);
  const paper = isDark ? '#242321' : '#FFFEFA';
  const paperWidth = Math.min(width, 600) - 64;
  const teeth = Array.from(
    { length: 35 },
    (_, i) => `L${(i + 0.5) * 10},8 L${(i + 1) * 10},0`,
  ).join(' ');
  const merchant = (item.merchant || 'Purchase').replace(/\s+xStock$/i, '');
  return (
    <View style={{ marginHorizontal: -8 }}>
      <View
        accessible={false}
        accessibilityElementsHidden
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          right: 10,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#11110F',
        }}
      />
      <View
        accessible={false}
        accessibilityElementsHidden
        style={{
          height: 28,
          marginHorizontal: 2,
          borderRadius: 14,
          backgroundColor: 'transparent',
          zIndex: 2,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 9,
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            backgroundColor: isDark ? '#4A4946' : '#DAD8D3',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.08)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 16,
            left: 0,
            right: 0,
            height: 12,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            backgroundColor: isDark ? '#3A3937' : '#DAD8D3',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 0,
            width: 10,
            height: 8,
            backgroundColor: isDark ? '#3A3937' : '#DAD8D3',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 0,
            width: 10,
            height: 8,
            backgroundColor: isDark ? '#3A3937' : '#DAD8D3',
          }}
        />
      </View>
      <View
        style={{ overflow: 'hidden', marginTop: -20, paddingHorizontal: 16, paddingBottom: 12 }}
      >
        <Animated.View style={[{ overflow: 'hidden', opacity: height ? 1 : 0 }, reveal.mask]}>
          <Animated.View
            onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
            style={reveal.paper}
          >
            <View
              style={{
                backgroundColor: paper,
                padding: 22,
                paddingTop: 34,
                borderColor: isDark ? '#393833' : '#E8E5DD',
                borderWidth: 1,
                borderBottomWidth: 0,
                gap: 18,
              }}
            >
              <View
                style={{
                  flexDirection: fontScale > 1.3 ? 'column' : 'row',
                  gap: 12,
                  alignItems: fontScale > 1.3 ? 'flex-start' : 'center',
                }}
              >
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  style={{
                    width: 78,
                    height: 78,
                    marginLeft: -32,
                    marginTop: -23,
                    transform: [{ rotate: '-12deg' }],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    source={merchant.trim().toLowerCase() === 'starbucks' ? starbucksSeal : seal}
                    style={{ position: 'absolute', width: 90, height: 90 }}
                    resizeMode="contain"
                  />
                  {merchant.trim().toLowerCase() !== 'starbucks' ? (
                    <View style={{ width: 47, height: 47, borderRadius: 24, overflow: 'hidden' }}><CompanyMark merchant={merchant} symbol={item.symbol ?? undefined} size={47} /></View>
                  ) : null}
                </View>
                <View
                  style={{
                    flex: fontScale > 1.3 ? undefined : 1,
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Type
                    variant="headline"
                    accessibilityRole="header"
                    style={{ fontSize: fontScale > 1.3 ? 19 : 24 }}
                  >
                    {merchant}
                  </Type>
                  <Type variant="caption" muted>
                    {new Date(item.occurredAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </Type>
                </View>
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.line,
                  paddingTop: 16,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Type variant="caption" muted>
                      Your roundup
                    </Type>
                    <Type
                      variant="display"
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      minimumFontScale={0.6}
                      style={{
                        fontSize: fontScale > 1.2 ? 38 : 48,
                        lineHeight: fontScale > 1.2 ? 46 : 56,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {roundupCents == null
                        ? '—'
                        : `+${money(roundupCents, item.roundupCurrency ?? item.currency)}`}
                    </Type>
                  </View>
                  {fontScale <= 1.2 ? (
                    <InteractiveArt source={receiptArt} name="activity receipt" size={104} />
                  ) : null}
                </View>
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.line,
                  paddingTop: 7,
                }}
              >
                <Fact label="Purchase amount" value={purchaseAmount(item)} />
                {item.usdConversion && (item.originalCurrency ?? item.currency) !== 'USD' ? (
                  <>
                    <Fact label="Purchase in USD" value={money(item.usdConversion.usdCents)} />
                    <Type variant="caption" muted>
                      Converted to USD before calculating your roundup. Reference rate from{' '}
                      {new Date(item.usdConversion.observedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                      .
                    </Type>
                  </>
                ) : null}
                {item.reason === 'awaiting_exchange_rate' ? (
                  <Type muted>{purchaseExplanation(item)}</Type>
                ) : null}
                {roundupCents != null ? (
                  <>
                    <Fact
                      label="Rounded to"
                      value={money(
                        (item.usdConversion?.usdCents ?? item.amountCents) + roundupCents,
                        item.roundupCurrency ?? item.currency,
                      )}
                    />
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderColor: colors.line,
                        marginTop: 8,
                        paddingTop: 8,
                      }}
                    />
                    <Fact
                      label="Your small change"
                      value={`+${money(roundupCents, item.roundupCurrency ?? item.currency)}`}
                      total
                    />
                  </>
                ) : null}
              </View>
              {item.symbol ? (
                <View
                  style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 16, gap: 8 }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 44,
                    }}
                  >
                    <Type variant="caption" muted>
                      Rounded in
                    </Type>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <CompanyMark symbol={item.symbol} size={26} />
                      <Type variant="caption">{item.symbol}</Type>
                    </View>
                  </View>
                  {item.signature ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`See transaction in ${explorerName()}`}
                      onPress={() => void Linking.openURL(explorerTxUrl(item.signature!))}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Type variant="caption">See transaction</Type>
                      <AppSymbol name="next" color={colors.ink} size={18} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
            <Svg
              width="100%"
              height={9}
              viewBox="0 0 350 9"
              preserveAspectRatio="none"
              accessible={false}
            >
              <Path d={`M0,0 ${teeth} L350,0 Z`} fill={paper} />
            </Svg>
            <View style={{ width: paperWidth, height: 2 }} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
