import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Type } from './ui';

export function LegalLinks({ privacyOnly = false }: { privacyOnly?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function open(path: string) {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(`https://trybeaver.app/${path}`);
    } catch {
      setError('Couldn’t open this page. Please try again.');
    }
  }
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 }}>
        {[
          ['privacy', 'Privacy policy'],
          ['terms', 'Terms and Conditions'],
        ].filter(([path]) => !privacyOnly || path === 'privacy').map(([path, title]) => (
          <Pressable
            key={path}
            accessibilityRole="link"
            onPress={() => void open(path!)}
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Type variant="caption" style={{ textDecorationLine: 'underline' }}>
              {title}
            </Type>
          </Pressable>
        ))}
      </View>
      {error ? <Type accessibilityRole="alert">{error}</Type> : null}
    </View>
  );
}
