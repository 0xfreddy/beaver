import { ProviderSegmentedControl } from './provider-segmented-control';

const scopes = ['friends', 'global', 'achievements'] as const;
type Scope = 'friends' | 'global' | 'achievements';

export function SocialScope({ scope, onChange }: { scope: Scope; onChange: (v: Scope) => void }) {
  return (
    <ProviderSegmentedControl
      value={scope}
      options={scopes}
      accessibilityLabel="Leaderboard section"
      onChange={onChange}
    />
  );
}
