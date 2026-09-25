import type { ExpoConfig } from 'expo/config';
import { withXcodeProject, type ConfigPlugin } from 'expo/config-plugins';

const withQuotedReactNativeBundleScript: ConfigPlugin = (expoConfig) =>
  withXcodeProject(expoConfig, (config) => {
    const phases = config.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    const scriptExpression =
      "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'";
    const escapedQuote = '\\' + '"';
    const unquotedScript = `\`${escapedQuote}$NODE_BINARY${escapedQuote} --print ${escapedQuote}${scriptExpression}${escapedQuote}\``;
    const quotedScript = `${escapedQuote}$(${escapedQuote}$NODE_BINARY${escapedQuote} --print ${escapedQuote}${scriptExpression}${escapedQuote})${escapedQuote}`;

    for (const phase of Object.values(phases)) {
      if (typeof phase !== 'object' || phase === null || !('shellScript' in phase)) continue;
      if (typeof phase.shellScript !== 'string') continue;
      phase.shellScript = phase.shellScript.replace(unquotedScript, quotedScript);
    }

    return config;
  });

const environment = process.env.APP_ENV ?? 'development';
if (!['development', 'staging', 'production'].includes(environment))
  throw new Error('Invalid APP_ENV');
const suffix = environment === 'production' ? '' : `.${environment}`;
// Home-screen label and Expo project name per environment so installed variants are distinguishable.
const appName =
  environment === 'production' ? 'Beaver' : `Beaver ${environment === 'staging' ? 'Staging' : 'Dev'}`;
// Reapplied on every prebuild; ios/ is regenerated when switching APP_ENV, so
// signing must live here rather than in hand-edited Xcode project settings.
const teamId = process.env.EXPO_APPLE_TEAM_ID?.trim() || '5P865KN77M';

const withDevelopmentTeam: ConfigPlugin = (expoConfig) =>
  withXcodeProject(expoConfig, (config) => {
    const configurations = config.modResults.hash.project.objects.XCBuildConfiguration;
    for (const entry of Object.values(configurations ?? {})) {
      if (typeof entry !== 'object' || entry === null) continue;
      if (!('buildSettings' in entry) || typeof entry.buildSettings !== 'object') continue;
      const buildConfiguration = entry as {
        name?: unknown;
        buildSettings: Record<string, unknown>;
      };
      if (buildConfiguration.name !== 'Debug' && buildConfiguration.name !== 'Release') continue;
      buildConfiguration.buildSettings.DEVELOPMENT_TEAM = teamId;
    }
    return config;
  });
const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || '';
const appleSignInEnabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';
const mockDataEnabled =
  environment !== 'production' && process.env.EXPO_PUBLIC_MOCK_DATA_ENABLED !== 'false';
// Deliberately separate from the global sample-data switch: this permits the
// BVR2/App Review synthetic identities without weakening storage for real users.
const internalAccessEnabled = process.env.EXPO_PUBLIC_INTERNAL_ACCESS_ENABLED === 'true';

const inviteOrigin = process.env.EXPO_PUBLIC_INVITE_ORIGIN;
if (
  inviteOrigin &&
  (new URL(inviteOrigin).protocol !== 'https:' || new URL(inviteOrigin).origin !== inviteOrigin)
)
  throw new Error('Invite origin must be an HTTPS origin');
const config: ExpoConfig = {
  name: appName,
  slug: 'beaver',
  version: '0.1.0',
  icon: './assets/icon.png',
  scheme: `roundups${environment === 'production' ? '' : `-${environment}`}`,
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: `${process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.roundups.app'}${suffix}`,
    buildNumber: process.env.IOS_BUILD_NUMBER?.trim() || '19',
    supportsTablet: false,
    ...(inviteOrigin ? { associatedDomains: [`applinks:${new URL(inviteOrigin).host}`] } : {}),
    ...(appleSignInEnabled ? { usesAppleSignIn: true } : {}),
    infoPlist: {
      CFBundleDisplayName: appName,
      UIViewControllerBasedStatusBarAppearance: true,
      ITSAppUsesNonExemptEncryption: false,
      NSFaceIDUsageDescription: 'Use Face ID to unlock Beaver and approve withdrawals.',
    },
  },
  android: {
    ...(inviteOrigin
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              category: ['BROWSABLE', 'DEFAULT'],
              data: [{ scheme: 'https', host: new URL(inviteOrigin).host, pathPrefix: '/invite' }],
            },
          ],
        }
      : {}),
    package: `${process.env.ANDROID_PACKAGE ?? 'com.roundups.app'}${suffix}`,
  },
  web: { output: 'single', name: appName },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      { ios: { deploymentTarget: '16.4', enableSceneSupport: true }, android: { minSdkVersion: 26 } },
    ],
    'expo-dev-client',
    'expo-notifications',
    'expo-font',
    ['expo-image-picker', { photosPermission: 'Choose a receipt photo for your manual purchases.', cameraPermission: 'Take receipt photos for your manual purchases.', microphonePermission: false }],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Use Face ID to unlock Beaver and approve withdrawals.' },
    ],
    ...(appleSignInEnabled ? ['expo-apple-authentication'] : []),
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-blank.png',
        imageWidth: 1,
        backgroundColor: '#000000',
        dark: { image: './assets/splash-blank.png', backgroundColor: '#000000' },
      },
    ],
  ],
  runtimeVersion: { policy: 'fingerprint' },
  updates: { url: `https://u.expo.dev/${projectId}` },
  extra: { eas: { projectId }, environment, mockDataEnabled, internalAccessEnabled },
};
export default withDevelopmentTeam(withQuotedReactNativeBundleScript(config));
