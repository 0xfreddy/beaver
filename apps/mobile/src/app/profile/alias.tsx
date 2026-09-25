import { useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, Type } from '../../components/ui';
import { ProfileAvatar } from '../../components/profile-avatar';
import { avatars } from '../../lib/avatars';
import { useProfile } from '../../providers/profile-provider';
import { useTheme } from '../../theme';
function AliasEditor() {
  const { profile, ready, save } = useProfile();
  const { colors } = useTheme();
  const [alias, setAlias] = useState(profile.alias);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function commit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await save({ alias, avatarId });
      Keyboard.dismiss();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    // KeyboardAvoidingView measures the keyboard in screen coordinates and
    // miscalculates inside a native form sheet; Screen's native inset
    // adjustment plus a growing content container keep the avatar grid
    // scrollable above the keyboard instead.
    <Screen title="Your profile" keyboard fillContent>
      <View style={{ alignItems: 'center' }}>
        <ProfileAvatar id={avatarId} size={96} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {avatars.map((avatar) => (
          <Pressable
            key={avatar.id}
            accessibilityRole="button"
            accessibilityLabel={avatar.name}
            accessibilityState={{ selected: avatarId === avatar.id }}
            disabled={busy}
            onPress={() => setAvatarId(avatar.id)}
            style={({ pressed }) => ({
              width: '25%',
              minHeight: 68,
              padding: 6,
              alignItems: 'center',
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <View
              style={{
                padding: 3,
                borderRadius: 34,
                borderWidth: 2,
                borderColor: avatarId === avatar.id ? colors.ink : 'transparent',
              }}
            >
              <ProfileAvatar id={avatar.id} size={46} />
            </View>
          </Pressable>
        ))}
      </View>
      <TextInput
        autoFocus
        accessibilityLabel="Name"
        placeholder="Name"
        placeholderTextColor={colors.muted}
        defaultValue={profile.alias}
        onChangeText={(value) => {
          setAlias(value);
          setError(null);
        }}
        editable={!busy}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => void commit()}
        style={{
          minHeight: 52,
          padding: 14,
          color: colors.ink,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.line,
          fontSize: 18,
        }}
      />
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
      <Button title="Save profile" disabled={!ready} loading={busy} onPress={() => void commit()} />
      <Button title="Cancel" secondary disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}

export default function ProfileEditorRoute() {
  const { ready, error, scope } = useProfile();
  if (!ready || error)
    return (
      <Screen title="Your profile">
        <Type accessibilityRole="alert">{error ?? 'Loading your local profile…'}</Type>
      </Screen>
    );
  return <AliasEditor key={scope} />;
}
