import { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Type } from '../../components/ui';
import { SetupPage } from '../../components/setup-page';
import { useProfile } from '../../providers/profile-provider';
import { useTheme } from '../../theme';

export default function Name() {
  const { colors } = useTheme();
  const { profile, ready, save } = useProfile();
  const [name, setName] = useState(
    profile.alias && profile.alias !== 'Roundups member' ? profile.alias : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function continueOnboarding() {
    if (busy || !ready || trimmed.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await save({ alias: trimmed });
      Keyboard.dismiss();
      router.replace('/onboarding/intro');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t save your name. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupPage
      title={'What should we\ncall you?'}
      topPadding={8}
      keyboard
      actions={
        <Button
          appearance="onboarding"
          title="Continue"
          disabled={!ready || trimmed.length < 2}
          loading={busy}
          onPress={() => void continueOnboarding()}
        />
      }
    >
      <View style={styles.field}>
        <TextInput
          accessibilityLabel="First name"
          autoFocus
          value={name}
          onChangeText={(value) => {
            setName(value.replace(/[^\p{L}\p{M}' -]/gu, '').slice(0, 24));
            setError(null);
          }}
          editable={!busy}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="name-given"
          textContentType="givenName"
          returnKeyType="done"
          onSubmitEditing={() => void continueOnboarding()}
          style={[styles.input, { color: colors.ink, borderBottomColor: colors.ink }]}
        />
      </View>
      {error ? (
        <Type accessibilityRole="alert" muted>
          {error}
        </Type>
      ) : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  field: { width: '100%' },
  input: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 0,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});
