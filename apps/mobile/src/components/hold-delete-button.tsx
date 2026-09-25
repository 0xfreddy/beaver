import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Pressable, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useReducedMotion } from 'react-native-reanimated';
import { Type } from './ui';
import { createHoldConfirmation } from '../lib/hold-confirmation';

/** Releasing, leaving the screen or backgrounding cancels the destructive hold. */
export function HoldDeleteButton({
  disabled,
  busy,
  onConfirm,
}: {
  disabled: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const held = useRef(false);
  const confirmation = useRef(createHoldConfirmation()).current;
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const allowed = useRef(false);
  allowed.current = !disabled && !busy && focused;
  function cancel() {
    held.current = false;
    confirmation.cancel();
    progress.stopAnimation();
    progress.setValue(0);
    setHolding(false);
  }
  useEffect(() => {
    if (disabled || busy || !focused) cancel();
    // Cancellation depends on the current eligibility, not render-created callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, busy, focused]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') cancel();
    });
    return () => {
      held.current = false;
      confirmation.cancel();
      progress.stopAnimation();
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
  function start() {
    if (!allowed.current || held.current) return;
    held.current = true;
    const token = confirmation.begin();
    setHolding(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!confirmation.complete(token, finished, allowed.current)) return;
      held.current = false;
      setHolding(false);
      onConfirm();
    });
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hold to delete my Beaver account"
      accessibilityHint="Keep pressing for two seconds. Release to cancel."
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPressIn={start}
      onPressOut={cancel}
      style={{
        minHeight: 56,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#A82020',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: reducedMotion
            ? holding
              ? '100%'
              : '0%'
            : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: '#EB2424',
        }}
      />
      <View pointerEvents="none" style={{ padding: 16, alignItems: 'center' }}>
        <Type style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>
          {busy
            ? 'Deleting account…'
            : holding
              ? 'Keep holding to delete…'
              : 'Hold to delete my account'}
        </Type>
      </View>
    </Pressable>
  );
}
