const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { assetExts } = config.resolver;
  
  return {
    ...config,
    resolver: {
      ...config.resolver,
      assetExts: [...assetExts, 'png']
    }
  };
})(); 