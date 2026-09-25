#!/bin/bash
# Builds a Release app for the iOS simulator and packages it for Revyl.
# Used by .revyl/config.yaml (profile: revyl). Avoids EAS/fastlane entirely.
#
# Simulator builds are ad-hoc signed without keychain entitlements; the app's
# auth provider swaps Privy's secure storage for AsyncStorage in mock-eligible
# builds (see src/providers/auth-provider.tsx) so it must be built with
# EXPO_PUBLIC_MOCK_DATA_ENABLED=true (apps/mobile/.env defaults to it).
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"

# Regenerate the native project so the current .env (staging API, mock data,
# devnet, Apple sign-in) is baked into the build.
npx expo prebuild --platform ios --clean

xcodebuild \
  -workspace ios/Beaver.xcworkspace \
  -scheme Beaver \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build \
  build

mkdir -p build
rm -f build/app.tar.gz
tar -czf build/app.tar.gz -C ios/build/Build/Products/Release-iphonesimulator Beaver.app
echo "Revyl iOS simulator build ready: build/app.tar.gz"
