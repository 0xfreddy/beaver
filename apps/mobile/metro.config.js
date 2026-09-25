// Expo loads Metro configuration as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Privy's documented compatibility fixes for wallet SDK dependencies.
  if (moduleName === 'isows' || moduleName.startsWith('zustand')) {
    const compat = { ...context, unstable_enablePackageExports: false };
    return context.resolveRequest(compat, moduleName, platform);
  }
  if (moduleName === 'jose') {
    const compat = { ...context, unstable_conditionNames: ['browser'] };
    return context.resolveRequest(compat, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
