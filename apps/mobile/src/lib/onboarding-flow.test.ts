vi.mock('./introduction-event', () => ({
  recordIntroduction: vi.fn().mockResolvedValue(undefined),
}));
import { recordIntroduction } from './introduction-event';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  dismissAll: vi.fn(),
}));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({ session: {}, user: { id: 'test-user' }, getAccessToken: vi.fn() }),
}));
vi.mock('expo-router', () => ({ router: mocks }));
vi.mock('../providers/onboarding-provider', () => ({
  useOnboarding: () => ({ complete: mocks.complete }),
}));
import { POST_WELCOME_STEP, useOnboardingFlow } from './onboarding-flow';
beforeEach(() => {
  vi.clearAllMocks();
});
it('keeps onboarding real and completes only at the end', async () => {
  const flow = useOnboardingFlow();
  await flow.next('welcome');
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith('/onboarding/welcome');
  await flow.finish();
  expect(mocks.complete).toHaveBeenCalledOnce();
  expect(mocks.replace).toHaveBeenLastCalledWith('/');
});

it('records an introduction only when explicitly reviewed', async () => {
  await useOnboardingFlow().reviewIntroduction();
  expect(recordIntroduction).toHaveBeenCalledOnce();
});

it('goes straight to spending after welcome', () => {
  expect(POST_WELCOME_STEP).toBe('spending');
});
