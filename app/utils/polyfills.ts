/**
 * MindMuscle.AI Polyfills
 *
 * This file imports all polyfills needed for the application.
 * Import this file at the entry point of your app.
 *
 * CRITICAL: This file MUST be imported before any Sentry imports to prevent
 * warnings about multiple promise package versions.
 */

// Global type declarations
declare const globalThis: typeof global;

// Note: Sentry import is delayed until after polyfills to prevent conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;

// ===== IMMEDIATE PROMISE POLYFILLS =====
// These polyfills run immediately when this file is imported
// This ensures they are available before any other code runs

// Immediately check and polyfill Promise methods
(function immediatePromisePolyfill() {
  const startTime = Date.now();
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

    const loadTime = Date.now() - startTime;
    console.log(`✅ Early Promise polyfills complete in ${loadTime}ms`);

    // Store polyfill metrics for later Sentry reporting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__polyfillMetrics = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((globalThis as any).__polyfillMetrics || {}),
      promisePolyfillTime: loadTime,
      promiseAllSettledPolyfilled: !Promise.allSettled,
      promiseAnyPolyfilled: !Promise.any,
      timestamp: Date.now(),
    };
  }
})();

// Ensure AggregateError is available globally
if (typeof AggregateError === 'undefined') {
  console.log('⚡ Emergency polyfill: AggregateError');

  // Store polyfill usage for Sentry reporting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__polyfillMetrics = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((globalThis as any).__polyfillMetrics || {}),
    aggregateErrorPolyfilled: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).AggregateError = class AggregateError extends Error {
    errors: unknown[];

    constructor(errors: Iterable<unknown>, message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = Array.from(errors);
    }
  };
} else {
  // Store that AggregateError was already available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__polyfillMetrics = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((globalThis as any).__polyfillMetrics || {}),
    aggregateErrorNative: true,
  };
}

console.log('🎉 MindMuscle.AI polyfills loaded successfully!');

// Helper function to safely report to Sentry
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reportToSentry(action: (sentry: any) => void) {
  if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
    try {
      action(Sentry);
    } catch (error) {
      console.warn('Failed to report to Sentry:', error);
    }
  }
}

// Initialize Sentry after polyfills are complete
async function initializeSentryAfterPolyfills() {
  try {
    // Dynamically import Sentry after polyfills
    Sentry = await import('@sentry/react-native');

    // Report polyfill metrics to Sentry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = (globalThis as any).__polyfillMetrics;
    if (metrics) {
      reportToSentry((sentry) => {
        sentry.addBreadcrumb({
          message: 'Polyfills initialization completed',
          category: 'polyfills',
          data: metrics,
          level: 'info',
        });

        // Set tags for polyfill usage
        sentry.setTag('polyfills.promise_all_settled', metrics.promiseAllSettledPolyfilled);
        sentry.setTag('polyfills.promise_any', metrics.promiseAnyPolyfilled);
        sentry.setTag('polyfills.load_time', `${metrics.promisePolyfillTime}ms`);

        // Report fetch availability
        if (metrics.fetchMissing) {
          sentry.setTag('polyfills.fetch_missing', true);
        }
        if (metrics.fetchAvailable) {
          sentry.setTag('polyfills.fetch_available', true);
        }

        // Report AggregateError status
        if (metrics.aggregateErrorPolyfilled) {
          sentry.setTag('polyfills.aggregate_error_polyfilled', true);
        }
        if (metrics.aggregateErrorNative) {
          sentry.setTag('polyfills.aggregate_error_native', true);
        }
      });
    }
  } catch (error) {
    console.warn('Failed to initialize Sentry after polyfills:', error);
  }
}

// Initialize Sentry asynchronously without blocking polyfill loading
initializeSentryAfterPolyfills().catch((error) => {
  console.warn('Sentry initialization failed:', error);
});

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

  // Store for later Sentry reporting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__polyfillMetrics = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((globalThis as any).__polyfillMetrics || {}),
    fetchMissing: true,
  };

  reportToSentry((sentry) => {
    sentry.addBreadcrumb({
      message: 'Fetch API not available',
      category: 'polyfills',
      level: 'warning',
    });
    sentry.setTag('polyfills.fetch_missing', true);
  });
} else {
  // Store for later Sentry reporting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__polyfillMetrics = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((globalThis as any).__polyfillMetrics || {}),
    fetchAvailable: true,
  };

  reportToSentry((sentry) => {
    sentry.addBreadcrumb({
      message: 'Fetch API available',
      category: 'polyfills',
      level: 'info',
    });
    sentry.setTag('polyfills.fetch_available', true);
  });
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

// Export comprehensive polyfill status for monitoring
export function getPolyfillStatus() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics = (globalThis as any).__polyfillMetrics || {};
  return {
    loaded: true,
    earlyPolyfillsLoaded: true,
    metrics,
    sentryInitialized: Sentry !== null,
  };
}

// Function to report any polyfill errors that occur after initialization
export function reportPolyfillError(error: Error, context: string) {
  reportToSentry((sentry) => {
    sentry.captureException(error, {
      tags: {
        component: 'polyfills',
        context,
      },
      contexts: {
        polyfills: getPolyfillStatus(),
      },
    });
  });
}

// Export to ensure the file is not tree-shaken
export const polyfillsLoaded = true;
export const earlyPolyfillsLoaded = true;

// Default export to satisfy Expo Router
export default function Polyfills() {
  return null;
}
