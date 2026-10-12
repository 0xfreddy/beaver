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
pnpm --filter @roundups/mobile android  # first native Android build/install
# On macOS: pnpm --filter @roundups/mobile ios
pnpm dev:mobile     # reuse the installed development client; w = web preview
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

The repository includes `development`, `development-simulator`, `production`,
`android-demo`, `hackathon`, and `dapp-store` EAS profiles. If you fork:

1. Create your own EAS project (`eas init`).
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in your environment (OTA updates point at
   your project, not ours).
3. Replace the bundle IDs in `app.config.ts` (`IOS_BUNDLE_IDENTIFIER`,
   `ANDROID_PACKAGE`) — use your own identifiers instead of `com.roundups.*` or `com.beaver.app`.
4. For iOS signing, set your own `EXPO_APPLE_TEAM_ID`. No maintainer signing
   identity, signing key, or EAS project is shipped in the snapshot.

Environment variables for store builds belong in EAS secrets, never in the
repository.

## Android / Solana Mobile APK

Android 8+ (API 26) is the configured minimum. An APK can be installed directly;
the Play Store AAB cannot. For a fork's standalone sample build:

```sh
cd apps/mobile
pnpm dlx eas-cli@latest build --platform android --profile android-demo
```

This bundles the app with mock mode enabled and OTA disabled. It needs no Metro
server and makes no real transfers. EAS builds require your own EAS account,
project and signing setup. `hackathon` and `dapp-store` instead build live mainnet
APKs: configure your own Privy client, account service and client-safe RPC first.
Never put server secrets in `EXPO_PUBLIC_*` values; those ship inside the app.

Generated `ios/` and `android/` projects are intentionally excluded from source.
Expo regenerates them from the shared configuration and committed plugins.
See [Solana Mobile setup, installation and judging](solana-mobile.md).

Build-format reference: [Expo APK builds](https://docs.expo.dev/build-reference/apk/).
