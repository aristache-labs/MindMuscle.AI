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

// Block Prisma, WebSocket server modules, and problematic Node.js modules
config.resolver.blockList = [
  /\/node_modules\/prisma\//,
  /\/node_modules\/@prisma\/client\//,
  /ws\/lib\/websocket-server\.js$/,
  /ws\/lib\/server\.js$/,
  // Block specific problematic WebSocket files that import Node.js modules
  /\/node_modules\/@supabase\/realtime-js\/node_modules\/ws\/lib\/websocket\.js$/,
  /\/node_modules\/ws\/lib\/websocket\.js$/,
  /\/node_modules\/ws\/lib\/.*\.js$/,
];

// Configure polyfills and stub out Node.js modules
config.resolver.extraNodeModules = {
  ...extraNodeModules,
  // Override web-streams polyfill
  'web-streams-polyfill': require.resolve('web-streams-polyfill/ponyfill/es6'),
  // Stub out problematic Node.js modules with false to disable them
  net: false,
  tls: false,
  fs: false,
  child_process: false,
  http2: false,
  dgram: false,
  dns: false,
  // Use existing polyfills from node-libs-react-native where available
  ws: false, // Disable WebSocket entirely to prevent Node.js imports
  http: extraNodeModules.http,
  https: extraNodeModules.https,
  url: extraNodeModules.url,
  querystring: extraNodeModules.querystring,
};

// Enhanced server configuration for cross-platform debugging
config.server = {
  ...config.server,
  // Enable network debugging
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add CORS headers for cross-origin debugging (restricted to development origins)
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:8081',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8081',
        'http://192.168.1.1:8081', // Common local network range
        'http://10.0.0.1:8081', // Common local network range
      ];

      const origin = req.headers.origin;
      if (process.env.NODE_ENV === 'development' && origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (process.env.NODE_ENV === 'development') {
        // Fallback for development without specific origin (like direct IP access)
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
      }

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
  // Use port configuration only (host is not a valid Metro server option)
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
  // Removed getSourceMapUrl as it's not a valid Metro serializer option
};

// Development-specific enhancements
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Metro configured for cross-platform debugging');
  console.log(`📡 Server will listen on port: ${config.server.port}`);
  console.log('🌐 CORS enabled for network debugging');
  console.log('🗺️  Source maps optimized for debugging');
  console.log('🚫 Node.js modules disabled for React Native compatibility');
}

module.exports = config;
