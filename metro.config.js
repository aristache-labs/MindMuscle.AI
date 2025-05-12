console.log("Loading metro.config.js with WebSocket polyfills...");
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Get the project root directory - in Expo/React Native, this is typically the current directory
const projectRoot = path.resolve(process.cwd());

// Create the default Metro config
const config = getDefaultConfig(projectRoot);

// Define paths
const netShimPath = path.resolve(projectRoot, "app/utils/net-polyfill.ts");
const httpShimPath = path.resolve(projectRoot, "app/utils/http-polyfill.ts");
const httpsShimPath = path.resolve(projectRoot, "app/utils/https-polyfill.ts");
const tlsShimPath = path.resolve(projectRoot, "app/utils/tls-polyfill.ts");
const streamsPolyfillPath = path.resolve(projectRoot, "app/utils/StreamsPolyfill.ts");
const websocketPath = path.resolve(projectRoot, "app/utils/WebSocket.ts");
const rscPolyfillPath = path.resolve(projectRoot, "node_modules/expo/virtual/rsc.js");

// Block specific Node.js modules that shouldn't be used in React Native
config.resolver.blockList = [
  // Block server-side websocket modules
  /ws\/lib\/websocket-server\.js$/,
  /ws\/lib\/server\.js$/,
  /node_modules\/ws\/lib\/.*server.*\.js$/,
  // Explicitly block http-related modules in ws
  /node_modules\/ws\/lib\/http.*\.js$/,
  /node_modules\/ws\/lib\/extension.*\.js$/,
  // Other Node.js specific modules that might cause issues
  /node_modules\/http-parser-js\//,
  /node_modules\/.*\/http\//,
  /node_modules\/.*\/http2\//,
  /node_modules\/.*\/https\//,
  /node_modules\/.*\/tls\//,
  /node_modules\/.*\/net\//,
  /node_modules\/.*\/dns\//,
  /node_modules\/.*\/fs\//,
  // Block problematic polyfill paths
  /node_modules\/react-native-polyfill-globals\/src\/readable-stream\.js$/,
  /\/node_modules\/prisma\//,
  /\/node_modules\/@prisma\/client\//,
  /\/node_modules\/react-native-polyfill-globals\//,
];

// Configure extraNodeModules
config.resolver.extraNodeModules = {
  // Base node-libs-react-native polyfills
  ...require("node-libs-react-native"),

  // Custom polyfills/shims
  ws: websocketPath,
  "web-streams-polyfill": streamsPolyfillPath,
  "web-streams-polyfill/ponyfill/es6": streamsPolyfillPath,
  "expo/virtual/rsc": rscPolyfillPath,

  // Empty implementations for Node.js modules not used in React Native
  net: netShimPath,
  http: httpShimPath,
  https: httpsShimPath,
  tls: tlsShimPath,
  fs: false,
  path: false,
  dns: false,
  dgram: false,
  child_process: false,

  // Use browserify replacements for some modules
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer/"),
  events: require.resolve("events/"),
  zlib: require.resolve("browserify-zlib"),
  crypto: require.resolve("crypto-browserify"),
};

// Create aliases for cleaner imports
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  ws: websocketPath,
  "web-streams-polyfill": streamsPolyfillPath,
  "web-streams-polyfill/ponyfill/es6": streamsPolyfillPath,
  "web-streams-polyfill/dist/ponyfill.es6.js": streamsPolyfillPath,
  http: httpShimPath,
  https: httpsShimPath,
  "expo/virtual/rsc": rscPolyfillPath,
};

module.exports = config;
