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

import 'reactotron-react-native';

declare global {
  interface Console {
    tron?: {
      log: (...args: any[]) => void;
      warn: (...args: any[]) => void;
      error: (...args: any[]) => void;
      debug: (...args: any[]) => void;
      display: (options?: any) => void;
      api: (endpoint: string, method: string, body: any, response: any) => void;
      render: (componentName: string, props?: any, state?: any) => void;
      performance: (operationName: string, duration: number, details?: any) => void;
      state: (contextName: string, contextValue: any) => void;
      success: (message: string, details?: any) => void;
      logImportant: (...args: any[]) => void;
    };
  }
}

// This ensures the file is treated as a module.
export {};
