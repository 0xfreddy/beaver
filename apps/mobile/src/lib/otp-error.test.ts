import { describe, expect, it } from 'vitest';
import { classifyOtpError } from './otp-error';

describe('classifyOtpError', () => {
  it('recognizes Privy expired-code failures', () => {
    expect(classifyOtpError({ code: 'invalid_data', message: 'Invalid data' })).toBe('unavailable');
    expect(classifyOtpError(new Error('The verification code has expired.'))).toBe('expired');
  });

  it('recognizes throttling without treating it as a wrong code', () => {
    expect(classifyOtpError({ code: 'too_many_requests' })).toBe('rate-limited');
  });

  it('uses access denied only for rejected codes', () => {
    expect(classifyOtpError({ code: 'invalid_credentials' })).toBe('invalid');
    expect(classifyOtpError(new Error('Invalid review code.'))).toBe('invalid');
  });

  it('does not blame the code for infrastructure failures', () => {
    for (const message of [
      'Network request failed',
      'Unable to access storage',
      'Sign-in is still loading',
      'No match',
    ]) {
      expect(classifyOtpError(new Error(message))).toBe('unavailable');
    }
  });
});
