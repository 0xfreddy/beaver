import { describe, expect, it, vi } from 'vitest';
import { nextTenCents, limitPayload, saveConfirmedPolicy } from './roundup-rules';
import { validateAlias } from './profile-preview';
describe('Phase 1 financial and identity boundaries', () => {
  it('uses integer cents, including exact increments', () => {
    expect(nextTenCents(465)).toBe(535);
    expect(nextTenCents(1000)).toBe(0);
    expect(nextTenCents(0)).toBe(0);
    expect(nextTenCents(1999)).toBe(1);
    expect(() => nextTenCents(4.65)).toThrow();
    expect(() => nextTenCents(-1)).toThrow();
  });
  it('validates limits against the live contract without changing enabled state', () => {
    expect(limitPayload('10,01', false)).toEqual({
      enabled: false,
      dailyLimitCents: 1001,
      maxRoundupCents: 900,
      policyVersion: 'automatic-spot-v1',
    });
    expect(limitPayload('1000', true).dailyLimitCents).toBe(100000);
    for (const value of ['9.99', '1000.01', '1e3', '20.001', '-10', ''])
      expect(() => limitPayload(value, true)).toThrow();
  });
  it('retains the confirmed policy on a rejected write and commits only a response', async () => {
    let policy = { enabled: false, dailyLimitCents: 5000 };
    const commit = vi.fn((value) => {
      policy = value;
    });
    await expect(
      saveConfirmedPolicy(async () => {
        throw new Error('WALLET_AUTHORIZATION_REQUIRED');
      }, commit),
    ).rejects.toThrow('WALLET_AUTHORIZATION_REQUIRED');
    expect(commit).not.toHaveBeenCalled();
    expect(policy.dailyLimitCents).toBe(5000);
    await saveConfirmedPolicy(async () => ({ enabled: false, dailyLimitCents: 2500 }), commit);
    expect(policy).toEqual({ enabled: false, dailyLimitCents: 2500 });
  });
  it('trims aliases and rejects controls and invalid lengths', () => {
    expect(validateAlias('  River  ')).toBe('River');
    expect(validateAlias('🌊🌱')).toBe('🌊🌱');
    for (const value of ['a', ' '.repeat(4), 'a'.repeat(25), 'a\nb', 'a\u200bb'])
      expect(() => validateAlias(value)).toThrow();
  });
});
