/**
 * MindMuscle.AI Polyfills
 *
 * This file imports all polyfills needed for the application.
 * Import this file at the entry point of your app.
 */
import { Buffer } from 'buffer';

// WHATWG streams:
import 'web-streams-polyfill/ponyfill/es6';
// React Native URL polyfill
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Buffer for binary data handling
global.Buffer = Buffer;

// Web Streams Polyfill
import 'web-streams-polyfill';

// Ensure fetch is available (should be built into React Native)
if (!global.fetch) {
  console.warn('Fetch API not available, using polyfill');
  // Note: node-fetch is not available in React Native, this is just a fallback check
}

// Empty polyfills for Node.js modules that aren't available in React Native
// These are used by Metro config to stub out problematic imports
export const Socket = class Socket {};
export const Server = class Server {};
export const createConnection = () => null;
export const createServer = () => null;
export const connect = () => null;
export const isIP = () => false;
export const isIPv4 = () => false;
export const isIPv6 = () => false;

// TLS stubs
export const TLSSocket = class TLSSocket {};
export const createSecureContext = () => null;

// File system stubs
export const readFile = () => null;
export const writeFile = () => null;
export const existsSync = () => false;

// Child process stubs
export const spawn = () => null;
export const exec = () => null;

// HTTP2 stubs
export const createSecureServer = () => null;
export const createHttp2Server = () => null;

// DNS stubs
export const lookup = () => null;
export const resolve = () => null;

// DGRAM stubs
export const createSocket = () => null;

// Export to ensure the file is not tree-shaken
export const polyfillsLoaded = true;

// Default export to satisfy Expo Router
export default function Polyfills() {
  return null;
}
