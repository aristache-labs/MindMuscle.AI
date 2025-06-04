/**
 * Early Promise Polyfills for Sentry Compatibility
 *
 * This file MUST be imported before any Sentry imports to prevent
 * warnings about multiple promise package versions.
 */

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

export const earlyPolyfillsLoaded = true;
