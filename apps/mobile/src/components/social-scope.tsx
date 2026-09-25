import { ProviderSegmentedControl } from './provider-segmented-control';

// Temporarily hidden; achievement accrual is preserved.
const scopes = ['friends', 'global'] as const;
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
