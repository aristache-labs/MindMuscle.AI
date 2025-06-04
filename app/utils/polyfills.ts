/**
 * MindMuscle.AI Polyfills
 *
 * This file imports all polyfills needed for the application.
 * Import this file at the entry point of your app.
 *
 * CRITICAL: This file MUST be imported before any Sentry imports to prevent
 * warnings about multiple promise package versions.
 */

// ===== IMMEDIATE PROMISE POLYFILLS =====
// These polyfills run immediately when this file is imported
// This ensures they are available before any other code runs

// Immediately check and polyfill Promise methods
(function immediatePromisePolyfill() {
  console.log('🚀 Early Promise polyfills initializing...');

  // Force Promise.allSettled availability
  if (typeof Promise !== 'undefined') {
    if (!Promise.allSettled) {
      console.log('⚡ Emergency polyfill: Promise.allSettled');
      Promise.allSettled = function <T>(
        promises: readonly (T | PromiseLike<T>)[],
      ): Promise<PromiseSettledResult<T>[]> {
        return Promise.all(
          promises.map((promise) =>
            Promise.resolve(promise)
              .then((value) => ({ status: 'fulfilled' as const, value }))
              .catch((reason) => ({ status: 'rejected' as const, reason })),
          ),
        );
      };
    }

    if (!Promise.any) {
      console.log('⚡ Emergency polyfill: Promise.any');
      Promise.any = function <T>(promises: readonly (T | PromiseLike<T>)[]): Promise<T> {
        return new Promise((resolve, reject) => {
          const errors: unknown[] = [];
          let rejectedCount = 0;

          if (promises.length === 0) {
            // Create a simple AggregateError if it doesn't exist
            const AggregateErrorConstructor =
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (globalThis as any).AggregateError ||
              class extends Error {
                errors: unknown[];
                constructor(errors: unknown[], message?: string) {
                  super(message);
                  this.name = 'AggregateError';
                  this.errors = errors;
                }
              };
            reject(new AggregateErrorConstructor([], 'All promises were rejected'));
            return;
          }

          promises.forEach((promise, index) => {
            Promise.resolve(promise)
              .then(resolve)
              .catch((error) => {
                errors[index] = error;
                rejectedCount++;
                if (rejectedCount === promises.length) {
                  const AggregateErrorConstructor =
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (globalThis as any).AggregateError ||
                    class extends Error {
                      errors: unknown[];
                      constructor(errors: unknown[], message?: string) {
                        super(message);
                        this.name = 'AggregateError';
                        this.errors = errors;
                      }
                    };
                  reject(new AggregateErrorConstructor(errors, 'All promises were rejected'));
                }
              });
          });
        });
      };
    }

    // Set markers immediately to prevent Sentry detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Promise as any).__sentryPolyfilled = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Promise as any).__mindmusclePolyfilled = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Promise as any).__earlyPolyfilled = true;

    console.log('✅ Early Promise polyfills complete');
  }
})();

// Ensure AggregateError is available globally
if (typeof AggregateError === 'undefined') {
  console.log('⚡ Emergency polyfill: AggregateError');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).AggregateError = class AggregateError extends Error {
    errors: unknown[];

    constructor(errors: Iterable<unknown>, message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = Array.from(errors);
    }
  };
}

console.log('🎉 MindMuscle.AI polyfills loaded successfully!');

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
export const earlyPolyfillsLoaded = true;

// Default export to satisfy Expo Router
export default function Polyfills() {
  return null;
}
