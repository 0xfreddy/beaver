import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, Type } from '../../components/ui';
import { ProfileAvatar } from '../../components/profile-avatar';
import { useProfile } from '../../providers/profile-provider';
import { avatars, avatarFor } from '../../lib/avatars';
import { useTheme } from '../../theme';
function AvatarPicker() {
  const { profile, ready, save } = useProfile();
  const { colors } = useTheme();
  const [selected, setSelected] = useState(profile.avatarId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function commit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await save({ avatarId: selected });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Profile" topPadding={32}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <ProfileAvatar id={selected} size={96} />
        <Type muted>{avatarFor(selected).name}</Type>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {avatars.map((avatar) => (
          <Pressable
            key={avatar.id}
            accessibilityRole="button"
            accessibilityLabel={avatar.name}
            accessibilityState={{ selected: selected === avatar.id }}
            disabled={busy}
            onPress={() => setSelected(avatar.id)}
            style={({ pressed }) => ({
              width: '33.333%',
              minHeight: 80,
              padding: 8,
              alignItems: 'center',
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <View
              style={{
                padding: 4,
                borderRadius: 40,
                borderWidth: 2,
                borderColor: selected === avatar.id ? colors.ink : 'transparent',
              }}
            >
              <ProfileAvatar id={avatar.id} size={52} />
              {selected === avatar.id ? (
                <Type
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    backgroundColor: colors.background,
                    borderRadius: 10,
                    paddingHorizontal: 3,
                  }}
                >
                  ✓
                </Type>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
      <Button title="Save avatar" disabled={!ready} loading={busy} onPress={() => void commit()} />
      {Platform.OS === 'web' ? (
        <Button title="Cancel" secondary onPress={() => router.back()} />
      ) : null}
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
  return <AvatarPicker key={scope} />;
}
