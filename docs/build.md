# Building Beaver

## Prerequisites

- Node ≥ 22.13 and pnpm 11 (`corepack enable` provides the pinned version)
- iOS: macOS with Xcode and CocoaPods via Bundler (see the Expo guide)
- Android: Android Studio with the SDK and an emulator
- Web: nothing beyond Node

## Install and run

```sh
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile     # Expo dev client; i = iOS simulator, a = Android, w = web
```

The app starts in **mock mode** — a built-in engine backed by AsyncStorage
serves a complete sample account (purchases, roundups, portfolio, friends,
leaderboard, withdrawals). No backend, Privy app, or API keys are needed.

Sign-in in mock mode is simulated. To exercise the live HTTP path, set
`EXPO_PUBLIC_MOCK_DATA_ENABLED=false` and point `EXPO_PUBLIC_API_URL` at a
reachable account service.

## JDK note for Android

Use JDK 17 (`JAVA_HOME` pointing at a zulu-17 install). Other JDK versions
fail during the Android build.

## Native rebuilds

Changes to `app.config.ts`, native dependencies, or patches
(`patches/*.patch`) require regenerating the native projects and rebuilding
the dev client. Web-only contributors never need this.

## Building with EAS (forks)

The repository is EAS-ready with three profiles: `development`,
`development-simulator`, and `production`. If you fork:

1. Create your own EAS project (`eas init`).
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in your environment (OTA updates point at
   your project, not ours).
3. Replace the bundle IDs in `app.config.ts` (`IOS_BUNDLE_IDENTIFIER`,
   `ANDROID_PACKAGE`) — do not ship builds under `com.roundups.*`.

Environment variables for store builds belong in EAS secrets, never in the
repository.
