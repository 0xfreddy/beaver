/**
 * Normalizes user-entered phone input to E.164 form (`+` followed by 7–15
 * digits). Returns null when the input is missing the country code or is too
 * short to be dialable; callers decide how to present that to the user.
 */
export function normalizePhoneNumber(input: string): string | null {
  if (!input.trim().startsWith('+')) return null;
  const digits = input.replace(/\D/g, '');
  return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
}
