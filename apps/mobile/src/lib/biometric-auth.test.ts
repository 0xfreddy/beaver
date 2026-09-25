import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  supportedAuthenticationTypesAsync: vi.fn(async () => [2]),
  getEnrolledLevelAsync: vi.fn(async () => 0),
  isEnrolledAsync: vi.fn(async () => false),
  authenticateAsync: vi.fn(async () => ({ success: true })),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-local-authentication', () => ({
  ...native,
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2 },
}));
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    store.delete(key);
  },
}));
import {
  biometricAvailability,
  hasSeenBiometricOffer,
  markBiometricOfferSeen,
} from './biometric-auth';
beforeEach(() => {
  store.clear();
  native.getEnrolledLevelAsync.mockResolvedValue(0);
  native.isEnrolledAsync.mockResolvedValue(false);
});
describe('biometric setup', () => {
  it('recognizes simulator Face ID even without a passcode security level', async () => {
    native.isEnrolledAsync.mockResolvedValue(true);
    expect(await biometricAvailability()).toMatchObject({
      available: true,
      enrolled: true,
      label: 'Face ID',
    });
  });
  it('offers a passcode when only a passcode is enrolled', async () => {
    native.getEnrolledLevelAsync.mockResolvedValue(1);
    expect(await biometricAvailability()).toMatchObject({
      available: true,
      enrolled: false,
      label: 'Device passcode',
    });
  });
  it('does not offer device authentication without enrollment', async () => {
    expect(await biometricAvailability()).toMatchObject({ available: false });
  });
  it('remembers dismissal independently for each account', async () => {
    await markBiometricOfferSeen('did:privy:first');
    expect(await hasSeenBiometricOffer('did:privy:first')).toBe(true);
    expect(await hasSeenBiometricOffer('did:privy:second')).toBe(false);
  });
});
