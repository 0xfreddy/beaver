import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({
  permission: 'denied',
  foreground: (_state: string) => {},
  register: vi.fn(),
  request: vi.fn(),
  settings: vi.fn(),
  back: vi.fn(),
  defer: vi.fn(),
}));
vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  AppState: {
    addEventListener: (_event: string, callback: typeof f.foreground) => {
      f.foreground = callback;
      return { remove() {} };
    },
  },
}));
vi.mock('expo-router', () => ({ router: { canGoBack: () => true, back: f.back } }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('../components/ui', () => ({ Button: 'Button', TextButton: 'TextButton', Type: 'Type' }));
vi.mock('../components/onboarding-animation', () => ({ OnboardingAnimation: 'Animation' }));
vi.mock('../components/onboarding-notification-stack', () => ({
  OnboardingNotificationCard: 'Card',
}));
vi.mock('../theme', () => ({ useTheme: () => ({ colors: { background: '#fff' } }) }));
vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user' } },
    getAccessToken: async () => 'access',
  }),
}));
vi.mock('../providers/profile-provider', () => ({
  useProfile: () => ({ profile: { alias: 'Valeria' } }),
}));
vi.mock('./notifications', () => ({
  notificationPermissionState: async () => f.permission,
  requestNotificationPermission: f.request,
  openNotificationSettings: f.settings,
}));
vi.mock('./notification-registration', () => ({ enableAllNotifications: f.register }));
vi.mock('./notification-consent', () => ({ deferNotificationOffer: f.defer }));
vi.mock('./telemetry', () => ({ posthog: null }));
import NotificationSetup, { NotificationInvitation } from '../app/notification-setup';

let tree: ReactTestRenderer;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  f.permission = 'denied';
  f.request.mockImplementation(async () => f.permission);
  f.register.mockResolvedValue(true);
  await act(async () => {
    tree = create(createElement(NotificationSetup));
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  vi.unstubAllGlobals();
});
const invitation = () => tree.root.findByType(NotificationInvitation).props;

it('finishes opt-in when the user returns from Settings with permission granted', async () => {
  await act(async () => {
    invitation().onActivate();
  });
  expect(f.settings).toHaveBeenCalledOnce();
  expect(f.register).not.toHaveBeenCalled();
  f.permission = 'granted';
  await act(async () => {
    f.foreground('active');
  });
  expect(f.register).toHaveBeenCalledOnce();
  expect(f.back).toHaveBeenCalledOnce();
});
it('keeps the sheet open with a retry when the backend rejects activation', async () => {
  f.permission = 'granted';
  f.register.mockResolvedValue(false);
  await act(async () => {
    f.foreground('active');
  });
  await act(async () => {
    invitation().onActivate();
  });
  expect(f.back).not.toHaveBeenCalled();
  expect(invitation().error).toContain('incomplete');
});
it('only defers an explicit Not now choice, never mounting the screen', async () => {
  expect(f.defer).not.toHaveBeenCalled();
  await act(async () => {
    invitation().onDismiss();
  });
  expect(f.defer).toHaveBeenCalledWith('user');
  expect(f.register).not.toHaveBeenCalled();
});

it('requests permission exactly once before registering on a fresh install', async () => {
  f.permission = 'undetermined';
  f.request.mockResolvedValue('granted');
  await act(async () => {
    f.foreground('active');
  });
  await act(async () => {
    invitation().onActivate();
    invitation().onActivate();
  });
  expect(f.request).toHaveBeenCalledOnce();
  expect(f.settings).not.toHaveBeenCalled();
  expect(f.register).toHaveBeenCalledOnce();
  expect(f.back).toHaveBeenCalledOnce();
});
it('keeps a failed OS request retryable and does not register or dismiss', async () => {
  f.permission = 'undetermined';
  f.request.mockRejectedValue(new Error('native error'));
  await act(async () => {
    f.foreground('active');
  });
  await act(async () => {
    invitation().onActivate();
  });
  expect(invitation().permission).toBe('undetermined');
  expect(invitation().busy).toBe(false);
  expect(invitation().error).toContain('Try again');
  expect(f.register).not.toHaveBeenCalled();
  expect(f.back).not.toHaveBeenCalled();
});
it('explains how to enable notifications if Settings cannot open', async () => {
  f.settings.mockRejectedValue(new Error('no Settings'));
  await act(async () => {
    invitation().onActivate();
  });
  expect(invitation().error).toContain('Couldn’t open Settings');
  expect(invitation().busy).toBe(false);
  expect(f.back).not.toHaveBeenCalled();
  f.permission = 'granted';
  await act(async () => {
    f.foreground('active');
  });
  expect(f.register).not.toHaveBeenCalled();
});
it('distinguishes registration failure after returning from Settings from a Settings launch failure', async () => {
  await act(async () => {
    invitation().onActivate();
  });
  f.permission = 'granted';
  f.register.mockRejectedValue(new Error('offline'));
  await act(async () => {
    f.foreground('active');
  });
  expect(invitation().error).toContain('setup could not finish');
  expect(invitation().error).not.toContain('Couldn’t open Settings');
  expect(f.back).not.toHaveBeenCalled();
});
