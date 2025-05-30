/* eslint-disable prettier/prettier */
console.log('Loading metro.config.js with community polyfills from node-libs-react-native...');
const extraNodeModules = require('node-libs-react-native');
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Get the project root directory
const projectRoot = path.resolve(process.cwd());

// Create the default Metro config
const config = getSentryExpoConfig(projectRoot);

// Ensure Metro honors package.json exports (so RN-optimized bundles are picked)
config.resolver.unstable_enablePackageExports = true;

// Add WASM support for expo-sqlite web compatibility
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

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
  'web-streams-polyfill': require.resolve('web-streams-polyfill/ponyfill/es6'),
};

// Enhanced server configuration for cross-platform debugging
config.server = {
  ...config.server,
  // Enable network debugging
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add CORS headers for cross-origin debugging
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Log requests for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Metro] ${req.method} ${req.url} from ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`,
        );
      }

      return middleware(req, res, next);
    };
  },
  // Listen on all interfaces for LAN debugging
  host: process.env.REACT_NATIVE_PACKAGER_HOSTNAME || '0.0.0.0',
  port: parseInt(process.env.RCT_METRO_PORT) || 8081,
};

// Enhanced transformer for better debugging
config.transformer = {
  ...config.transformer,
  // Enable inline source maps for better debugging
  inlineRequires: false,
  // Better source map support
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Enhanced serializer for debugging and source maps
config.serializer = {
  ...config.serializer,
  // Ensure source maps are generated for Sentry
  createModuleIdFactory: config.serializer.createModuleIdFactory,
  // Keep source maps for better debugging and Sentry error reporting
  getSourceMapUrl: config.serializer.getSourceMapUrl,
};

// Development-specific enhancements
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Metro configured for cross-platform debugging');
  console.log(`📡 Server will listen on: ${config.server.host}:${config.server.port}`);
  console.log('🌐 CORS enabled for network debugging');
  console.log('🗺️  Source maps optimized for debugging');
}

module.exports = config;
