/**
 * Global TypeScript declarations for third-party modules without type definitions
 */

// Declaration for react-native-polyfill-globals
declare module 'react-native-polyfill-globals' {
  export function polyfillGlobals(): void;
  export default polyfillGlobals;
}

// Other module declarations as needed
declare module 'web-streams-polyfill';

// Default export to satisfy Expo Router
export default function GlobalTypes() {
  return null;
} 