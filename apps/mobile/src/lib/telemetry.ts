import * as Sentry from '@sentry/react-native';
import { PostHog } from 'posthog-react-native';

export let posthog: PostHog | undefined;

// Internal testers (the team's own accounts) must stay separable from customer
// data in every dashboard. Add more via EXPO_PUBLIC_INTERNAL_TESTER_EMAILS.
const INTERNAL_TESTER_EMAILS = (
  process.env.EXPO_PUBLIC_INTERNAL_TESTER_EMAILS ?? ''
)
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isInternalTester(email: string | null | undefined) {
  return !!email && INTERNAL_TESTER_EMAILS.includes(email.trim().toLowerCase());
}

/** Stamp every subsequent event while a sample account drives the app. */
export function setSyntheticSession(active: boolean) {
  if (!posthog) return;
  if (active) posthog.register({ synthetic: true });
  else posthog.unregister('synthetic');
}

/** Stamp events from the team's own accounts so dashboards can exclude them. */
export function setInternalTeamTester(active: boolean) {
  if (!posthog) return;
  if (active) posthog.register({ internal_team: true });
  else posthog.unregister('internal_team');
}

/** PRD §15: sample-account tooling must emit its own auditable event trail. */
export function captureMockDataEvent(
  event: 'mock_data_load_started' | 'mock_data_load_succeeded' | 'mock_data_clear_succeeded',
) {
  posthog?.capture(event, { synthetic: true });
}

export function initializeMobileTelemetry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (dsn)
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      enableAutoSessionTracking: false,
      beforeSend(event) {
        delete event.user;
        delete event.request;
        delete event.breadcrumbs;
        return event;
      },
    });

  if (posthog) return;
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();
  if (!apiKey || !host) {
    if (__DEV__) {
      const variableName = apiKey ? 'EXPO_PUBLIC_POSTHOG_HOST' : 'EXPO_PUBLIC_POSTHOG_KEY';
      throw new Error(
        `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
      );
    }
    return;
  }
  posthog = new PostHog(apiKey, {
    host,
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
        console: false,
      },
    },
  });
}

/**
 * Route-change tracking: every screen entry is captured as `screen_viewed`
 * with the screen it came from and how long that previous screen was open,
 * powering screen-time, bounce and drop-off reports in the ops bot.
 */
export function captureScreenView(
  screen: string,
  previousScreen: string | null,
  previousDurationSeconds: number | null,
) {
  if (!posthog) return;
  posthog.capture('screen_viewed', {
    screen,
    ...(previousScreen ? { previous_screen: previousScreen } : {}),
    ...(previousDurationSeconds !== null ? { previous_duration_seconds: previousDurationSeconds } : {}),
  });
}
