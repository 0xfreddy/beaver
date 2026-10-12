import { afterEach, describe, expect, it, vi } from 'vitest';
import eas from '../../eas.json';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('production authentication build configuration', () => {
  it('requires production configuration for forked release builds', () => {
    expect(eas.build.production.env.APP_ENV).toBe('production');
    expect(eas.build.hackathon.extends).toBe('production');
    expect(eas.build['dapp-store'].extends).toBe('hackathon');
  });

  for (const key of ['EXPO_PUBLIC_PRIVY_APP_ID', 'EXPO_PUBLIC_PRIVY_CLIENT_ID']) {
    it(`refuses a production build missing ${key}`, async () => {
      vi.stubEnv('APP_ENV', 'production');
      vi.stubEnv('EXPO_PUBLIC_PRIVY_APP_ID', 'test-app');
      vi.stubEnv('EXPO_PUBLIC_PRIVY_CLIENT_ID', 'test-client');
      vi.stubEnv(key, '  ');
      await expect(import('../../app.config')).rejects.toThrow(
        `Missing required release configuration: ${key}`,
      );
    });
  }
});
