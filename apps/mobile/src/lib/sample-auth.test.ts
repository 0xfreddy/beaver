import { expect, it } from 'vitest';
import { shouldUseSampleAuth } from './sample-auth';

it('opens the credential-free sample only in explicitly eligible mock builds', () => {
  expect(shouldUseSampleAuth(true, undefined, undefined)).toBe(true);
  expect(shouldUseSampleAuth(true, 'app', 'client')).toBe(false);
  expect(shouldUseSampleAuth(false, undefined, undefined)).toBe(false);
  expect(shouldUseSampleAuth(false, 'app', undefined)).toBe(false);
});
