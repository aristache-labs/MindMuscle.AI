module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      ['module-resolver', {
        alias: {
          'buffer': 'buffer',
          'web-streams-polyfill/ponyfill/es6': 'web-streams-polyfill/dist/ponyfill.es6.js',
          '@prisma/client': '@prisma/client/runtime/index',
        },
      }],
    ],
  };
}; 