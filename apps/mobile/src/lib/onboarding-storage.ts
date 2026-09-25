export const accountStoragePrefix = 'roundups.introduction.account.v1:';
export const accountSpendingStoragePrefix = 'roundups.spending-profile.account.v1:';

export function accountKey(prefix: string, userId: string) {
  return `${prefix}${encodeURIComponent(userId)}`;
}
