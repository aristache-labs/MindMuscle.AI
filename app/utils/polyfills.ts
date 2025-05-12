/**
 * Polyfills for React Native compatibility
 * This file should be imported early in the app bootstrap process
 */

// URL polyfill
import 'react-native-url-polyfill/auto';

// Buffer polyfill
import { Buffer } from 'buffer';
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}

// Custom WebSocket implementation to replace ws
import wsModule, { WebSocket } from './WebSocket';
if (typeof global !== 'undefined') {
  // Make our custom implementation available
  (global as any).wsCustomImpl = wsModule;
}

// Web streams polyfill - import directly from the package
import * as webStreamsPolyfill from './StreamsPolyfill';

// Add ReadableStream to global scope if needed
if (typeof global !== 'undefined' && !global.ReadableStream) {
  // Use type assertions to avoid TypeScript errors
  (global as any).ReadableStream = webStreamsPolyfill.ReadableStream;
  (global as any).WritableStream = webStreamsPolyfill.WritableStream;
  (global as any).TransformStream = webStreamsPolyfill.TransformStream;
}

// Import http-shim to ensure it's available
import * as httpShim from './http-shim.js';
if (typeof global !== 'undefined') {
  (global as any).httpShim = httpShim;
}

// Import https-shim to ensure it's available
import * as httpsShim from './https-shim.js';
if (typeof global !== 'undefined') {
  (global as any).httpsShim = httpsShim;
}

// Console message for debugging
console.log('React Native polyfills initialized with custom WebSocket, HTTP, and HTTPS shims');

// Define a default export to satisfy Expo Router
export default {
  init: () => {
    console.log('React Native polyfills initialized with custom WebSocket, HTTP, and HTTPS shims');
  }
}; 