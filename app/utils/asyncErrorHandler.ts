/**
 * Async Error Handler Utility
 *
 * This utility provides comprehensive error handling for async operations
 * to prevent unhandled promise rejections throughout the MindMuscle.AI app.
 *
 * Key features:
 * - Safe execution of async functions with automatic error handling
 * - Fire-and-forget operations that won't cause unhandled rejections
 * - Retry mechanisms with exponential backoff
 * - Timeout handling for long-running operations
 * - Automatic Sentry error reporting
 * - Global unhandled promise rejection handler
 *
 * Usage:
 * ```typescript
 * import { safeAsync, safeAsyncFireAndForget } from '../utils/asyncErrorHandler';
 *
 * // Safe async operation with fallback
 * const result = await safeAsync(
 *   () => riskyAsyncOperation(),
 *   { fallback: 'default_value', errorPrefix: 'Operation failed' }
 * );
 *
 * // Fire and forget operation
 * safeAsyncFireAndForget(
 *   () => backgroundTask(),
 *   { errorPrefix: 'Background task failed' }
 * );
 * ```
 */

import * as Sentry from '@sentry/react-native';

/**
 * Utility to safely execute async operations and prevent unhandled promise rejections
 */

// Type definitions for React Native global objects
interface ReactNativeGlobal {
  ErrorUtils?: {
    setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
  };
  onunhandledrejection?: ((event: PromiseRejectionEvent) => void) | null;
}

// Extend the global object with React Native specific properties
declare const global: ReactNativeGlobal & typeof globalThis;

export interface AsyncErrorHandlerOptions {
  /** Context information for debugging */
  context?: Record<string, unknown>;
  /** Whether to log errors to console in development */
  logToConsole?: boolean;
  /** Whether to report errors to Sentry */
  reportToSentry?: boolean;
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Whether to rethrow the error after handling */
  rethrow?: boolean;
  /** Fallback value to return on error */
  fallback?: unknown;
}

/**
 * Safely execute an async function with comprehensive error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options: AsyncErrorHandlerOptions = {},
): Promise<T | undefined> {
  const {
    context = {},
    logToConsole = __DEV__,
    reportToSentry = true,
    errorPrefix = 'Async operation failed',
    rethrow = false,
    fallback,
  } = options;

  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${errorPrefix}: ${errorMessage}`;

    // Log to console in development
    if (logToConsole) {
      console.error(fullMessage, { error, context });
    }

    // Report to Sentry
    if (reportToSentry) {
      try {
        Sentry.captureException(error instanceof Error ? error : new Error(errorMessage), {
          contexts: {
            async_operation: {
              error_prefix: errorPrefix,
              context,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (sentryError) {
        // Prevent Sentry errors from causing more issues
        if (logToConsole) {
          console.warn('Failed to report error to Sentry:', sentryError);
        }
      }
    }

    // Return fallback value if provided
    if (fallback !== undefined) {
      return fallback as T;
    }

    // Rethrow if requested
    if (rethrow) {
      throw error;
    }

    return undefined;
  }
}

/**
 * Safely execute an async function without waiting for the result
 * Useful for fire-and-forget operations
 */
export function safeAsyncFireAndForget(
  fn: () => Promise<unknown>,
  options: AsyncErrorHandlerOptions = {},
): void {
  safeAsync(fn, {
    ...options,
    rethrow: false, // Never rethrow for fire-and-forget
  }).catch((error) => {
    // This should never happen due to safeAsync handling, but just in case
    if (options.logToConsole !== false) {
      console.error('Unhandled error in fire-and-forget operation:', error);
    }
  });
}

/**
 * Wrap a promise to ensure it's handled safely
 */
export function safePromise<T>(
  promise: Promise<T>,
  options: AsyncErrorHandlerOptions = {},
): Promise<T | undefined> {
  return safeAsync(() => promise, options);
}

/**
 * Create a safe version of an async function
 */
export function makeSafeAsync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  defaultOptions: AsyncErrorHandlerOptions = {},
) {
  return async (...args: TArgs): Promise<TReturn | undefined> => {
    return safeAsync(() => fn(...args), defaultOptions);
  };
}

/**
 * Utility for handling multiple async operations safely
 */
export async function safeAsyncAll<T>(
  operations: Array<() => Promise<T>>,
  options: AsyncErrorHandlerOptions & {
    /** Whether to continue if one operation fails */
    continueOnError?: boolean;
    /** Maximum number of concurrent operations */
    concurrency?: number;
  } = {},
): Promise<Array<T | undefined>> {
  const { continueOnError = true, concurrency = 5, ...safeOptions } = options;

  if (!continueOnError) {
    // If we shouldn't continue on error, use Promise.all with safe wrapper
    return Promise.all(
      operations.map((op, index) =>
        safeAsync(op, {
          ...safeOptions,
          context: { ...safeOptions.context, operationIndex: index },
        }),
      ),
    );
  }

  // Handle operations with concurrency control
  const results: Array<T | undefined> = [];
  const chunks: Array<Array<() => Promise<T>>> = [];

  // Split operations into chunks based on concurrency
  for (let i = 0; i < operations.length; i += concurrency) {
    chunks.push(operations.slice(i, i + concurrency));
  }

  // Process each chunk
  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map((op, index) =>
        safeAsync(op, {
          ...safeOptions,
          context: { ...safeOptions.context, operationIndex: results.length + index },
        }),
      ),
    );

    // Extract results from settled promises
    results.push(
      ...chunkResults.map((result) => (result.status === 'fulfilled' ? result.value : undefined)),
    );
  }

  return results;
}

/**
 * Utility for retrying async operations with exponential backoff
 */
export async function safeAsyncWithRetry<T>(
  fn: () => Promise<T>,
  options: AsyncErrorHandlerOptions & {
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Initial delay in milliseconds */
    initialDelay?: number;
    /** Backoff multiplier */
    backoffMultiplier?: number;
    /** Maximum delay in milliseconds */
    maxDelay?: number;
    /** Function to determine if error should trigger retry */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {},
): Promise<T | undefined> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000,
    shouldRetry = () => true,
    ...safeOptions
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        break;
      }

      // Log retry attempt
      if (safeOptions.logToConsole !== false) {
        console.warn(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`,
          error instanceof Error ? error.message : String(error),
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next attempt
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  // Handle the final error
  return safeAsync(() => Promise.reject(lastError), {
    ...safeOptions,
    errorPrefix: `${safeOptions.errorPrefix || 'Async operation'} failed after ${maxRetries} retries`,
  });
}

/**
 * Utility for timing out async operations
 */
export async function safeAsyncWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: AsyncErrorHandlerOptions = {},
): Promise<T | undefined> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return safeAsync(() => Promise.race([fn(), timeoutPromise]), {
    ...options,
    errorPrefix: `${options.errorPrefix || 'Async operation'} (with ${timeoutMs}ms timeout)`,
  });
}

/**
 * Global error handler for unhandled promise rejections
 * This should be called early in the app lifecycle
 */
export function setupGlobalAsyncErrorHandler(): void {
  // Handle unhandled promise rejections
  const originalHandler = global.onunhandledrejection;

  global.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    console.error('Unhandled promise rejection:', error);

    // Check if it's a navigation error
    const isNavigationError =
      error.message.includes('was not handled by any navigator') ||
      error.message.includes('Do you have a route named') ||
      error.message.includes('REPLACE') ||
      error.message.includes('NAVIGATE');

    Sentry.withScope((scope) => {
      scope.setTag(
        'error_type',
        isNavigationError ? 'navigation_error' : 'unhandled_promise_rejection',
      );
      scope.setContext('promise_rejection_context', {
        error_message: error.message,
        error_stack: error.stack,
        is_navigation_error: isNavigationError,
        timestamp: new Date().toISOString(),
      });

      if (isNavigationError) {
        scope.setTag('navigation_error_type', 'route_not_found');
        scope.setLevel('warning'); // Navigation errors are usually not fatal
      } else {
        scope.setLevel('error');
      }

      Sentry.captureException(error);
    });

    // Call original handler if it exists
    if (originalHandler) {
      try {
        originalHandler(event);
      } catch (handlerError) {
        console.error('Error in original unhandled rejection handler:', handlerError);
      }
    }

    // Prevent the default behavior (logging to console) since we're handling it
    event.preventDefault();
  };

  // Handle JavaScript errors (React Native specific)
  if (global.ErrorUtils?.setGlobalHandler) {
    global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error('Global JavaScript error:', error);

      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'javascript_error');
        scope.setTag('is_fatal', isFatal ? 'true' : 'false');
        scope.setLevel(isFatal ? 'fatal' : 'error');
        scope.setContext('javascript_error_context', {
          error_message: error.message,
          error_stack: error.stack,
          is_fatal: isFatal,
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });
    });
  }

  console.log('✅ Global async error handlers setup complete');
}

export default {
  safeAsync,
  safeAsyncFireAndForget,
  safePromise,
  makeSafeAsync,
  safeAsyncAll,
  safeAsyncWithRetry,
  safeAsyncWithTimeout,
  setupGlobalAsyncErrorHandler,
};
