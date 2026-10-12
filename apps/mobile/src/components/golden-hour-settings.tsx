import { Host, Switch } from '@expo/ui';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Type } from './ui';
export function GoldenHourSettings() {
  const { choice, colors, responsive, setResponsive } = useTheme();
  if (choice !== 'golden') return null;
  return (
    <View style={{ gap: 8 }}>
      <Host matchContents colorScheme="light" seedColor={colors.accent}>
        <Switch label="Respond to activity" value={responsive} onValueChange={setResponsive} />
      </Host>
      <Type variant="caption" muted>
        {responsive
          ? 'A warmer sky as roundups build. A peach glow when an investment is confirmed.'
          : 'Keep the original golden palette, with no activity changes.'}
      </Type>
    </View>
  );
}
