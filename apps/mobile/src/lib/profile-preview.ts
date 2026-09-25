export type PreviewProfile = { version: 1; alias: string; avatarId: string };
export const defaultProfile: PreviewProfile = { version: 1, alias: '', avatarId: 'glass-01' };
export function validateAlias(value: string) {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) throw new Error('Use an alias without control characters.');
  const alias = value.trim();
  if ([...alias].length < 2 || [...alias].length > 24)
    throw new Error('Choose an alias with 2–24 characters.');
  return alias;
}
