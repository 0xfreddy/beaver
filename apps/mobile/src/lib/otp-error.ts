type CodedError = {
  code?: unknown;
  error?: unknown;
  message?: unknown;
};

export type OtpFailure = 'expired' | 'rate-limited' | 'invalid' | 'unavailable';

export function classifyOtpError(cause: unknown): OtpFailure {
  const value = cause && typeof cause === 'object' ? (cause as CodedError) : null;
  const code = typeof value?.code === 'string' ? value.code.toLowerCase() : '';
  const detail = [value?.error, value?.message, typeof cause === 'string' ? cause : '']
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();

  if (code === 'too_many_requests' || /too many|rate.?limit/.test(detail)) return 'rate-limited';
  if (/expir|no longer valid/.test(detail)) return 'expired';
  if (
    code === 'invalid_credentials' ||
    code === 'invalid_code' ||
    /invalid (verification |otp |review )?code|incorrect code|wrong code/.test(detail)
  )
    return 'invalid';
  // Storage, connectivity and SDK readiness failures say nothing about the digits.
  return 'unavailable';
}
