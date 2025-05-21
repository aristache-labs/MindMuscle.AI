/**
 * MindMuscle.AI Polyfills
 * 
 * This file imports all polyfills needed for the application.
 * Import this file at the entry point of your app.
 */

// WHATWG streams:
import 'web-streams-polyfill/ponyfill/es6';
// React Native URL polyfill
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

// Buffer for binary data handling
global.Buffer = require('buffer').Buffer;

// Web Streams Polyfill
import 'web-streams-polyfill';

// Ensure fetch is available (should be built into React Native)
if (!global.fetch) {
  console.warn('Fetch API not available, using polyfill');
  global.fetch = require('node-fetch');
}

// Export to ensure the file is not tree-shaken
export const polyfillsLoaded = true; 