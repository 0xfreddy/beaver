/** A missing credential must never turn a production or live build into a sample account. */
export function shouldUseSampleAuth(
  mockEligible: boolean,
  appId: string | undefined,
  clientId: string | undefined,
) {
  return mockEligible && (!appId?.trim() || !clientId?.trim());
}
