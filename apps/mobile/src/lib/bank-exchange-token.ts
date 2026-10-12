// Bank linking is native-only. Never put the exchange token in web storage.
export async function saveBankExchangeToken(_userId: string, _sessionId: string, _token: string) {}
export async function loadBankExchangeToken(
  _userId: string,
  _sessionId: string,
): Promise<string | null> {
  return null;
}
export async function clearBankExchangeToken(_sessionId: string) {}
