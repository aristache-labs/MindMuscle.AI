/* eslint-disable complexity */
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
 * - Automatic Sentry error reporting with performance tracking
 * - Global unhandled promise rejection handler
 * - Transaction and breadcrumb tracking
 * - User context and session tracking
 * - MindMuscle.AI specific error categorization
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
declare const global: ReactNativeGlobal & Record<string, unknown>;

// MindMuscle.AI specific error categories
export type ErrorCategory =
  | 'workout'
  | 'exercise'
  | 'auth'
  | 'database'
  | 'api'
  | 'navigation'
  | 'ui'
  | 'analytics'
  | 'storage'
  | 'performance'
  | 'network'
  | 'cache'
  | 'validation'
  | 'general';

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
  /** MindMuscle.AI specific error category */
  category?: ErrorCategory;
  /** User ID for context tracking */
  userId?: string;
  /** Session ID for context tracking */
  sessionId?: string;
  /** Component name where error occurred */
  component?: string;
  /** Operation name for performance tracking */
  operation?: string;
  /** Whether to create a Sentry transaction */
  enableTransaction?: boolean;
  /** Tags to add to Sentry */
  tags?: Record<string, string>;
  /** Additional breadcrumb data */
  breadcrumbData?: Record<string, unknown>;
  /** Performance threshold in ms for slow operation alerts */
  performanceThreshold?: number;
  /** Whether to track performance metrics */
  trackPerformance?: boolean;
}

/**
 * Performance tracking data
 */
interface PerformanceData {
  startTime: number;
  endTime: number;
  duration: number;
  operation: string;
  category: ErrorCategory;
  success: boolean;
  userId?: string;
  sessionId?: string;
  component?: string;
  performanceThreshold?: number;
}

/**
 * Track performance metrics for async operations
 */
function trackPerformance(data: PerformanceData): void {
  const { duration, operation, category, success, performanceThreshold = 5000 } = data;

  // Add performance breadcrumb
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${operation} completed in ${duration}ms`,
    level: duration > performanceThreshold ? 'warning' : 'info',
    data: {
      duration,
      operation,
      category,
      success,
      is_slow: duration > performanceThreshold,
      threshold: performanceThreshold,
    },
  });

  // Report slow operations
  if (duration > performanceThreshold) {
    Sentry.withScope((scope) => {
      scope.setTag('performance_issue', 'slow_operation');
      scope.setTag('operation', operation);
      scope.setTag('category', category);
      scope.setLevel('warning');
      scope.setContext('performance_context', {
        duration,
        threshold: performanceThreshold,
        operation,
        category,
        success,
        timestamp: new Date().toISOString(),
      });

      Sentry.captureMessage(`Slow operation detected: ${operation} took ${duration}ms`, 'warning');
    });
  }

  // Track performance metrics (React Native doesn't have window.performance)
  // This is a placeholder for future React Native performance API integration
}

/**
 * Add contextual breadcrumb for async operations
 */
function addAsyncBreadcrumb(
  operation: string,
  category: ErrorCategory,
  success: boolean,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: `async_${category}`,
    message: `${operation} ${success ? 'completed' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: {
      operation,
      category,
      success,
      timestamp: new Date().toISOString(),
      ...data,
    },
  });
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
    logToConsole = true, // Default to true for debugging
    reportToSentry = true,
    errorPrefix = 'Async operation failed',
    rethrow = false,
    fallback,
    category = 'general',
    userId,
    sessionId,
    component,
    operation = 'async_operation',
    enableTransaction = false,
    tags = {},
    breadcrumbData = {},
    performanceThreshold = 5000,
    trackPerformance: shouldTrackPerformance = true,
  } = options;

  const startTime = Date.now();
  let transaction:
    | {
        setStatus: (status: string) => void;
        setData: (key: string, value: string | number | boolean) => void;
        finish: () => void;
      }
    | undefined;

  // Start Sentry transaction if enabled
  if (enableTransaction) {
    // Import the compatibility layer dynamically to avoid circular imports
    const { startTransaction } = await import('./sentryCompat');
    transaction = startTransaction({
      name: operation,
      op: `async_${category}`,
      tags: {
        category,
        component: component || 'unknown',
        ...tags,
      },
    });
  }

  // Add start breadcrumb
  addAsyncBreadcrumb(operation, category, true, {
    phase: 'start',
    component,
    ...breadcrumbData,
  });

  try {
    // Set user context if provided
    if (userId || sessionId) {
      Sentry.withScope((scope) => {
        if (userId) scope.setUser({ id: userId });
        if (sessionId) scope.setTag('session_id', sessionId);
        if (component) scope.setTag('component', component);
        scope.setTag('category', category);
        Object.entries(tags).forEach(([key, value]) => scope.setTag(key, value));
      });
    }

    const result = await fn();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Track successful performance
    if (shouldTrackPerformance) {
      trackPerformance({
        startTime,
        endTime,
        duration,
        operation,
        category,
        success: true,
        userId,
        sessionId,
        component,
        performanceThreshold,
      });
    }

    // Add success breadcrumb
    addAsyncBreadcrumb(operation, category, true, {
      phase: 'success',
      duration,
      component,
      ...breadcrumbData,
    });

    // Finish transaction successfully
    if (transaction) {
      transaction.setStatus('ok');
      transaction.setData('duration', duration);
      transaction.setData('success', true);
      transaction.finish();
    }

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${errorPrefix}: ${errorMessage}`;

    // Track failed performance
    if (shouldTrackPerformance) {
      trackPerformance({
        startTime,
        endTime,
        duration,
        operation,
        category,
        success: false,
        userId,
        sessionId,
        component,
        performanceThreshold,
      });
    }

    // Add error breadcrumb
    addAsyncBreadcrumb(operation, category, false, {
      phase: 'error',
      duration,
      error_message: errorMessage,
      component,
      ...breadcrumbData,
    });

    // Log to console in development
    if (logToConsole) {
      console.error(fullMessage, {
        error,
        context,
        category,
        component,
        operation,
        duration,
        userId,
        sessionId,
      });
    }

    // Report to Sentry
    if (reportToSentry) {
      try {
        Sentry.withScope((scope) => {
          // Set error context
          scope.setContext('async_operation', {
            error_prefix: errorPrefix,
            operation,
            category,
            component,
            duration,
            context,
            timestamp: new Date().toISOString(),
          });

          // Set user context
          if (userId) scope.setUser({ id: userId });
          if (sessionId) scope.setTag('session_id', sessionId);

          // Set tags
          scope.setTag('error_category', category);
          scope.setTag('operation', operation);
          if (component) scope.setTag('component', component);
          scope.setTag('duration_ms', duration.toString());
          Object.entries(tags).forEach(([key, value]) => scope.setTag(key, value));

          // Set appropriate error level based on category
          const errorLevel = getErrorLevel(category, error);
          scope.setLevel(errorLevel);

          // Capture the exception
          Sentry.captureException(error instanceof Error ? error : new Error(errorMessage));
        });
      } catch (sentryError) {
        // Prevent Sentry errors from causing more issues
        if (logToConsole) {
          console.warn('Failed to report error to Sentry:', sentryError);
        }
      }
    }

    // Finish transaction with error
    if (transaction) {
      transaction.setStatus('internal_error');
      transaction.setData('duration', duration);
      transaction.setData('success', false);
      transaction.setData('error_message', errorMessage);
      transaction.finish();
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
 * Determine appropriate error level based on category and error type
 */
function getErrorLevel(
  category: ErrorCategory,
  error: unknown,
): 'fatal' | 'error' | 'warning' | 'info' | 'debug' {
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Critical errors that require immediate attention
  if (
    category === 'auth' ||
    category === 'database' ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('critical')
  ) {
    return 'error';
  }

  // Navigation and UI errors are usually less critical
  if (category === 'navigation' || category === 'ui') {
    return 'warning';
  }

  // Performance issues
  if (category === 'performance' || category === 'cache') {
    return 'info';
  }

  // Default level
  return 'error';
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
    enableTransaction: false, // Disable transactions for fire-and-forget
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
          operation: `${safeOptions.operation || 'batch_operation'}_${index}`,
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
          operation: `${safeOptions.operation || 'batch_operation'}_${results.length + index}`,
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
      const result = await safeAsync(fn, {
        ...safeOptions,
        operation: `${safeOptions.operation || 'retry_operation'}_attempt_${attempt + 1}`,
        context: {
          ...safeOptions.context,
          attempt: attempt + 1,
          maxRetries,
          delay: attempt > 0 ? delay / backoffMultiplier : 0,
        },
        reportToSentry: attempt === maxRetries, // Only report on final failure
      });

      // If successful, return result
      if (result !== undefined) {
        // Add success breadcrumb for retry operations
        if (attempt > 0) {
          Sentry.addBreadcrumb({
            category: 'retry',
            message: `Retry operation succeeded on attempt ${attempt + 1}`,
            level: 'info',
            data: {
              attempt: attempt + 1,
              maxRetries,
              operation: safeOptions.operation || 'retry_operation',
              totalDelay:
                (initialDelay * (Math.pow(backoffMultiplier, attempt) - 1)) /
                (backoffMultiplier - 1),
            },
          });
        }
        return result;
      }

      // If safeAsync returned undefined, treat as error for retry logic
      throw new Error('Operation returned undefined');
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

      // Add retry breadcrumb
      Sentry.addBreadcrumb({
        category: 'retry',
        message: `Retry attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`,
        level: 'warning',
        data: {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error_message: error instanceof Error ? error.message : String(error),
          operation: safeOptions.operation || 'retry_operation',
        },
      });

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
    operation: `${safeOptions.operation || 'retry_operation'}_final_failure`,
    reportToSentry: true, // Always report final failures
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
    operation: `${options.operation || 'timeout_operation'}_${timeoutMs}ms`,
    context: { ...options.context, timeoutMs },
    tags: { ...options.tags, timeout_ms: timeoutMs.toString() },
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

    // Check if it's a network error
    const isNetworkError =
      error.message.includes('Network') ||
      error.message.includes('fetch') ||
      error.message.includes('timeout') ||
      error.message.includes('connection');

    // Check if it's a database error
    const isDatabaseError =
      error.message.includes('database') ||
      error.message.includes('SQL') ||
      error.message.includes('sqlite') ||
      error.message.includes('query');

    // Determine error category
    let errorCategory: ErrorCategory = 'general';
    if (isNavigationError) errorCategory = 'navigation';
    else if (isNetworkError) errorCategory = 'network';
    else if (isDatabaseError) errorCategory = 'database';

    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'unhandled_promise_rejection');
      scope.setTag('error_category', errorCategory);

      if (isNavigationError) {
        scope.setTag('navigation_error_type', 'route_not_found');
        scope.setLevel('warning'); // Navigation errors are usually not fatal
      } else if (isNetworkError) {
        scope.setTag('network_error_type', 'connection_failed');
        scope.setLevel('error');
      } else if (isDatabaseError) {
        scope.setTag('database_error_type', 'query_failed');
        scope.setLevel('error');
      } else {
        scope.setLevel('error');
      }

      scope.setContext('promise_rejection_context', {
        error_message: error.message,
        error_stack: error.stack,
        error_category: errorCategory,
        is_navigation_error: isNavigationError,
        is_network_error: isNetworkError,
        is_database_error: isDatabaseError,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for unhandled rejection
      scope.addBreadcrumb({
        category: 'error',
        message: `Unhandled promise rejection: ${error.message}`,
        level: 'error',
        data: {
          error_category: errorCategory,
          is_navigation_error: isNavigationError,
          is_network_error: isNetworkError,
          is_database_error: isDatabaseError,
        },
      });

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

      // Determine error category based on stack trace
      const stack = error.stack || '';
      let errorCategory: ErrorCategory = 'general';

      if (stack.includes('navigation') || stack.includes('Navigator')) {
        errorCategory = 'navigation';
      } else if (stack.includes('workout') || stack.includes('exercise')) {
        errorCategory = 'workout';
      } else if (stack.includes('auth') || stack.includes('login')) {
        errorCategory = 'auth';
      } else if (stack.includes('database') || stack.includes('sql')) {
        errorCategory = 'database';
      } else if (stack.includes('network') || stack.includes('fetch')) {
        errorCategory = 'network';
      } else if (stack.includes('render') || stack.includes('component')) {
        errorCategory = 'ui';
      }

      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'javascript_error');
        scope.setTag('error_category', errorCategory);
        scope.setTag('is_fatal', isFatal ? 'true' : 'false');
        scope.setLevel(isFatal ? 'fatal' : 'error');

        scope.setContext('javascript_error_context', {
          error_message: error.message,
          error_stack: error.stack,
          error_category: errorCategory,
          is_fatal: isFatal,
          timestamp: new Date().toISOString(),
        });

        // Add breadcrumb for JavaScript error
        scope.addBreadcrumb({
          category: 'error',
          message: `JavaScript error: ${error.message}`,
          level: isFatal ? 'fatal' : 'error',
          data: {
            error_category: errorCategory,
            is_fatal: isFatal,
            error_name: error.name,
          },
        });

        Sentry.captureException(error);
      });
    });
  }

  console.log('✅ Global async error handlers setup complete with enhanced monitoring');
}

/**
 * Helper function to create error handler options for specific categories
 */
export function createErrorHandlerOptions(
  category: ErrorCategory,
  component?: string,
  operation?: string,
  additionalOptions?: Partial<AsyncErrorHandlerOptions>,
): AsyncErrorHandlerOptions {
  return {
    category,
    component,
    operation: operation || `${category}_operation`,
    enableTransaction: true,
    trackPerformance: true,
    tags: {
      category,
      ...(component && { component }),
    },
    ...additionalOptions,
  };
}

/**
 * Pre-configured error handlers for common MindMuscle.AI operations
 */
export const MindMuscleErrorHandlers = {
  workout: (component?: string, operation?: string) =>
    createErrorHandlerOptions('workout', component, operation, {
      performanceThreshold: 3000,
      errorPrefix: 'Workout operation failed',
    }),

  exercise: (component?: string, operation?: string) =>
    createErrorHandlerOptions('exercise', component, operation, {
      performanceThreshold: 2000,
      errorPrefix: 'Exercise operation failed',
    }),

  auth: (component?: string, operation?: string) =>
    createErrorHandlerOptions('auth', component, operation, {
      performanceThreshold: 5000,
      errorPrefix: 'Authentication operation failed',
    }),

  database: (component?: string, operation?: string) =>
    createErrorHandlerOptions('database', component, operation, {
      performanceThreshold: 1000,
      errorPrefix: 'Database operation failed',
    }),

  api: (component?: string, operation?: string) =>
    createErrorHandlerOptions('api', component, operation, {
      performanceThreshold: 10000,
      errorPrefix: 'API operation failed',
    }),

  navigation: (component?: string, operation?: string) =>
    createErrorHandlerOptions('navigation', component, operation, {
      performanceThreshold: 1000,
      errorPrefix: 'Navigation operation failed',
    }),

  cache: (component?: string, operation?: string) =>
    createErrorHandlerOptions('cache', component, operation, {
      performanceThreshold: 500,
      errorPrefix: 'Cache operation failed',
    }),
};

export default {
  safeAsync,
  safeAsyncFireAndForget,
  safePromise,
  makeSafeAsync,
  safeAsyncAll,
  safeAsyncWithRetry,
  safeAsyncWithTimeout,
  setupGlobalAsyncErrorHandler,
  createErrorHandlerOptions,
  MindMuscleErrorHandlers,
};
