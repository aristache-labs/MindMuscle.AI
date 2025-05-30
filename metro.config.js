/* eslint-disable prettier/prettier */
console.log("Loading metro.config.js with community polyfills from node-libs-react-native...");
const extraNodeModules = require("node-libs-react-native");
const path = require("path");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

// Get the project root directory
const projectRoot = path.resolve(process.cwd());

// Create the default Metro config
const config = getSentryExpoConfig(projectRoot);

// Ensure Metro honors package.json exports (so RN-optimized bundles are picked)
config.resolver.unstable_enablePackageExports = true;

// Add WASM support for expo-sqlite web compatibility
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'wasm'
];

// Block Prisma and other server-only modules
config.resolver.blockList = [
  /\/node_modules\/prisma\//,
  /\/node_modules\/@prisma\/client\//,
  /ws\/lib\/websocket-server\.js$/,
  /ws\/lib\/server\.js$/,
];

// Configure polyfills and stub out ws
config.resolver.extraNodeModules = {
  ...extraNodeModules,
  // Override web-streams polyfill
  "web-streams-polyfill": require.resolve("web-streams-polyfill/ponyfill/es6"),
};

module.exports = config;