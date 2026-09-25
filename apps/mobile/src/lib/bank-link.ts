// Native MoneyKit implementation resolves through Metro on iOS/Android.
export const supportsBankLink = false;
export async function continueBankLink(_url: string): Promise<boolean> {
  return false;
}
export async function openBankLink(
  _token: string,
  _redirectUri: string,
  _mode: string,
): Promise<string | null> {
  throw new Error('Connect your bank in the iOS or Android app.');
}
