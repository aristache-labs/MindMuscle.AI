// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

module.exports = (() => {
  // 1. Load Expo’s default Metro config
  const config = getDefaultConfig(__dirname);

  // 2. Add your custom assetExts
  const { assetExts } = config.resolver;
  config.resolver = {
    ...config.resolver,
    assetExts: [...assetExts, 'png'],
  };

  // 3. Wrap it with Sentry’s Metro plugin to enable source-map Debug IDs
  return withSentryConfig(config);
})();
