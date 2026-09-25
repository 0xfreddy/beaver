import { Linking, Pressable } from 'react-native';
import { Type } from './ui';
import { useLogoDirectory } from '../lib/logo-directory';

// The logo.dev free tier requires an attribution link back when logos are
// served commercially; renders nothing while the token is unset.
export function LogoAttribution() {
  const { data } = useLogoDirectory();
  const attribution = data?.attribution;
  if (!attribution) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Logos by ${attribution.name}`}
      onPress={() => void Linking.openURL(attribution.url)}
      style={{ paddingVertical: 16, alignItems: 'center' }}
    >
      <Type variant="caption" muted>
        Logos by {attribution.name}
      </Type>
    </Pressable>
  );
}
