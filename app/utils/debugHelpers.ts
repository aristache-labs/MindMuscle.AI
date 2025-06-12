import * as Sentry from '@sentry/react-native';
import { startTransaction } from './sentryCompat';
import { DebugFlags, debugLogger, PERFORMANCE_CONFIG } from './debugConfig';
import logger from './logger';

// React Native global types
interface ReactNativeGlobal {
  ErrorUtils?: {
    setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
  };
}

declare const global: ReactNativeGlobal & {
  [key: string]: unknown;
};

/**
 * Enhanced debug helpers with Sentry integration for MindMuscle.AI
 * Provides comprehensive debugging, performance tracking, and error monitoring
 */

/**
 * Helper function for conditional debug logging in components
 * Example usage:
 * debug('SPLASH_SCREEN', 'Loading complete', () => `Loaded ${items.length} items`);
 *
 * This will only execute the callback if debugging is enabled for that component
 */
export function debug(
  component: keyof DebugFlags,
  message: string,
  detailsCallback?: () => string | Record<string, unknown>,
): void {
  if (logger.isDebugging(component)) {
    const details = detailsCallback ? detailsCallback() : undefined;
    if (typeof details === 'string') {
      logger.debugComponent(component, `${message}: ${details}`);
    } else if (details) {
      logger.debugComponent(component, message, { context: details });
    } else {
      logger.debugComponent(component, message);
    }
  }

  // Also use the enhanced debugLogger for Sentry integration
  const details = detailsCallback ? detailsCallback() : undefined;
  if (typeof details === 'string') {
    debugLogger.debug(component, `${message}: ${details}`);
  } else if (details && typeof details === 'object') {
    debugLogger.debug(component, message, details);
  } else {
    debugLogger.debug(component, message);
  }
}

/**
 * Performance tracking wrapper for functions
 */
export function withPerformanceTracking<T extends unknown[], R>(
  component: keyof DebugFlags,
  operationName: string,
  fn: (...args: T) => R | Promise<R>,
): (...args: T) => R | Promise<R> {
  return (...args: T): R | Promise<R> => {
    const endTiming = debugLogger.startTiming(component, operationName);

    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then((resolvedResult) => {
            endTiming();
            return resolvedResult;
          })
          .catch((error) => {
            endTiming();
            debugLogger.error(component, `${operationName} failed`, error);
            throw error;
          }) as R;
      }

      // Handle sync functions
      endTiming();
      return result;
    } catch (error) {
      endTiming();
      debugLogger.error(component, `${operationName} failed`, error as Error);
      throw error;
    }
  };
}

/**
 * Memory tracking decorator for components
 */
export function trackMemoryUsage(
  component: keyof DebugFlags,
  operationName: string,
): (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      debugLogger.trackMemory(component, `${operationName}_${propertyName}`);

      const result = originalMethod.apply(this, args);

      // Track memory after operation if it's async
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          debugLogger.trackMemory(component, `${operationName}_${propertyName}_complete`);
          return resolvedResult;
        });
      }

      debugLogger.trackMemory(component, `${operationName}_${propertyName}_complete`);
      return result;
    };

    return descriptor;
  };
}

/**
 * Enhanced component logger with Sentry integration
 */
interface ComponentLoggerOptions {
  userId?: string;
  sessionId?: string;
  additionalContext?: Record<string, unknown>;
}

/**
 * Helper function to create component-specific debug loggers with enhanced Sentry integration
 */
export function createComponentLogger(
  component: keyof DebugFlags,
  options: ComponentLoggerOptions = {},
) {
  const { userId, sessionId, additionalContext = {} } = options;

  return {
    debug: (
      message: string,
      detailsCallback?: () => string | Record<string, unknown>,
      sentryData?: Record<string, unknown>,
    ) => {
      debug(component, message, detailsCallback);

      // Add Sentry breadcrumb for debug messages
      if (sentryData) {
        debugLogger.debug(component, message, {
          ...sentryData,
          ...additionalContext,
          userId,
          sessionId,
        });
      }
    },

    info: (
      message: string,
      options?: { context?: Record<string, unknown>; sentryContext?: Record<string, unknown> },
    ) => {
      logger.info(`[${String(component)}] ${message}`, options);

      // Enhanced Sentry logging
      debugLogger.info(component, message, {
        ...options?.context,
        ...options?.sentryContext,
        ...additionalContext,
        userId,
        sessionId,
      });
    },

    log: (message: string, data?: unknown, sentryData?: Record<string, unknown>) => {
      // Simple case - just log the message
      if (data === undefined) {
        logger.info(`[${String(component)}] ${message}`);
        debugLogger.info(component, message, { ...additionalContext, userId, sessionId });
        return;
      }

      // Enhanced logging with Sentry integration
      const contextData = {
        details: typeof data === 'object' ? JSON.stringify(data) : String(data),
        ...sentryData,
        ...additionalContext,
        userId,
        sessionId,
      };

      // If data is a valid options object with context property
      if (
        data &&
        typeof data === 'object' &&
        data !== null &&
        'context' in data &&
        data.context &&
        typeof data.context === 'object'
      ) {
        logger.info(`[${String(component)}] ${message}`, {
          context: data.context as Record<string, unknown>,
        });
        debugLogger.info(component, message, {
          ...data.context,
          ...sentryData,
          ...additionalContext,
          userId,
          sessionId,
        });
      } else {
        logger.info(`[${String(component)}] ${message}`, { context: contextData });
        debugLogger.info(component, message, contextData);
      }
    },

    warn: (message: string, error?: unknown, sentryContext?: Record<string, unknown>) => {
      const warningContext = {
        ...sentryContext,
        ...additionalContext,
        userId,
        sessionId,
      };

      if (error instanceof Error) {
        logger.warn(`[${String(component)}] ${message}`, {
          context: {
            message: error.message,
            stack: error.stack,
            ...warningContext,
          },
        });
        debugLogger.warn(component, message, {
          error_message: error.message,
          error_stack: error.stack,
          ...warningContext,
        });
      } else {
        logger.warn(`[${String(component)}] ${message}`, {
          context: { error: String(error), ...warningContext },
        });
        debugLogger.warn(component, message, {
          error: String(error),
          ...warningContext,
        });
      }
    },

    error: (
      message: string,
      error?: unknown,
      options?: { context?: Record<string, unknown>; sentryTags?: Record<string, string> },
    ) => {
      const errorContext = {
        ...options?.context,
        ...additionalContext,
        userId,
        sessionId,
      };

      if (error instanceof Error) {
        logger.error(`[${String(component)}] ${message}`, error, { context: errorContext });

        // Enhanced Sentry error reporting
        debugLogger.error(component, message, error, {
          ...errorContext,
          sentry_tags: options?.sentryTags,
        });
      } else if (error !== undefined) {
        const errorObj = new Error(
          typeof error === 'object' ? JSON.stringify(error) : String(error),
        );
        logger.error(`[${String(component)}] ${message}`, errorObj, { context: errorContext });
        debugLogger.error(component, message, errorObj, errorContext);
      } else {
        logger.error(`[${String(component)}] ${message}`, undefined, { context: errorContext });
        debugLogger.error(component, message, undefined, errorContext);
      }
    },

    // Performance tracking methods
    startTiming: (operationName: string) => {
      return debugLogger.startTiming(component, operationName);
    },

    // Memory tracking
    trackMemory: (operationName: string) => {
      debugLogger.trackMemory(component, operationName);
    },

    // Sentry transaction support (using compatibility layer)
    startTransaction: (transactionName: string, tags?: Record<string, string>) => {
      return startTransaction({
        name: `${String(component)}_${transactionName}`,
        op: component.toLowerCase(),
        tags: {
          component: String(component),
          ...tags,
          ...(userId && { user_id: userId }),
          ...(sessionId && { session_id: sessionId }),
        },
      });
    },

    // Add breadcrumb
    addBreadcrumb: (
      breadcrumbMessage: string,
      level: 'debug' | 'info' | 'warning' | 'error' = 'info',
      data?: Record<string, unknown>,
    ) => {
      Sentry.addBreadcrumb({
        category: String(component).toLowerCase(),
        message: breadcrumbMessage,
        level,
        data: {
          ...data,
          ...additionalContext,
          userId,
          sessionId,
          timestamp: new Date().toISOString(),
        },
      });
    },

    // Capture custom event
    captureEvent: (
      eventMessage: string,
      level: 'info' | 'warning' | 'error' = 'info',
      extra?: Record<string, unknown>,
    ) => {
      Sentry.withScope((scope) => {
        scope.setTag('component', String(component));
        scope.setLevel(level);

        if (userId) scope.setUser({ id: userId });
        if (sessionId) scope.setTag('session_id', sessionId);

        scope.setContext('component_context', {
          component: String(component),
          ...additionalContext,
          ...extra,
        });

        Sentry.captureMessage(`[${String(component)}] ${eventMessage}`, level);
      });
    },

    // Check if debugging is enabled for this component
    isDebugging: () => logger.isDebugging(component),
  };
}

/**
 * Create context-aware logger with user and session information
 */
export function createContextLogger(
  component: keyof DebugFlags,
  userId?: string,
  sessionId?: string,
  workoutId?: string,
  exerciseId?: string,
) {
  return createComponentLogger(component, {
    userId,
    sessionId,
    additionalContext: {
      ...(workoutId && { workout_id: workoutId }),
      ...(exerciseId && { exercise_id: exerciseId }),
    },
  });
}

/**
 * Workout-specific logger factory
 */
export function createWorkoutLogger(
  workoutId: string,
  userId?: string,
  sessionId?: string,
  planId?: string,
) {
  return createComponentLogger('WORKOUT', {
    userId,
    sessionId,
    additionalContext: {
      workout_id: workoutId,
      ...(planId && { plan_id: planId }),
    },
  });
}

/**
 * Exercise-specific logger factory
 */
export function createExerciseLogger(
  exerciseId: string,
  exerciseName: string,
  userId?: string,
  sessionId?: string,
  workoutId?: string,
) {
  return createComponentLogger('EXERCISE', {
    userId,
    sessionId,
    additionalContext: {
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      ...(workoutId && { workout_id: workoutId }),
    },
  });
}

/**
 * Performance benchmark utility
 */
export class PerformanceBenchmark {
  private startTime: number;
  private component: keyof DebugFlags;
  private operation: string;
  private endTiming: (() => void) | null = null;

  constructor(component: keyof DebugFlags, operation: string) {
    this.component = component;
    this.operation = operation;
    this.startTime = Date.now();
    this.endTiming = debugLogger.startTiming(component, operation);
  }

  /**
   * Add checkpoint during operation
   */
  checkpoint(checkpointName: string, data?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;
    debugLogger.debug(this.component, `Checkpoint ${checkpointName} at ${duration}ms`, {
      operation: this.operation,
      checkpoint: checkpointName,
      duration,
      ...data,
    });
  }

  /**
   * End performance tracking
   */
  end(data?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime;

    if (this.endTiming) {
      this.endTiming();
      this.endTiming = null;
    }

    debugLogger.debug(this.component, `Completed ${this.operation}`, {
      total_duration: duration,
      ...data,
    });

    return duration;
  }

  /**
   * End with error
   */
  endWithError(error: Error, data?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime;

    if (this.endTiming) {
      this.endTiming();
      this.endTiming = null;
    }

    debugLogger.error(this.component, `Failed ${this.operation}`, error, {
      total_duration: duration,
      ...data,
    });

    return duration;
  }
}

/**
 * Enhanced pre-created loggers with Sentry integration
 */
export const loggers = {
  splashScreen: createComponentLogger('SPLASH_SCREEN'),
  imagePreloader: createComponentLogger('IMAGE_PRELOADER'),
  network: createComponentLogger('NETWORK'),
  auth: createComponentLogger('AUTH'),
  workout: createComponentLogger('WORKOUT'),
  exercise: createComponentLogger('EXERCISE'),
  dataSync: createComponentLogger('DATA_SYNC'),
  performance: createComponentLogger('PERFORMANCE'),
  api: createComponentLogger('API'),
  database: createComponentLogger('DATABASE_QUERIES'),
  navigation: createComponentLogger('NAVIGATION'),
  analytics: createComponentLogger('ANALYTICS_EVENTS'),
  gamification: createComponentLogger('GAMIFICATION'),
  firebase: createComponentLogger('FIREBASE'),
  supabase: createComponentLogger('SUPABASE'),
  aiCoaching: createComponentLogger('AI_COACHING'),
  cache: createComponentLogger('CACHE_OPERATIONS'),
  storage: createComponentLogger('STORAGE_OPERATIONS'),
};

/**
 * Debugging utilities for specific MindMuscle.AI operations
 */
export const MindMuscleDebugUtils = {
  /**
   * Track workout session lifecycle
   */
  trackWorkoutSession: (
    sessionId: string,
    phase: 'start' | 'exercise_start' | 'exercise_complete' | 'rest' | 'complete' | 'cancelled',
    data?: Record<string, unknown>,
  ) => {
    const logger = createWorkoutLogger(sessionId);
    logger.info(`Workout session ${phase}`, { context: { phase, session_id: sessionId, ...data } });
    logger.addBreadcrumb(`Workout ${phase}`, 'info', { phase, ...data });
  },

  /**
   * Track exercise performance
   */
  trackExercisePerformance: (
    exerciseId: string,
    exerciseName: string,
    performance: {
      sets: number;
      reps: number;
      weight: number;
      duration: number;
      restTime?: number;
    },
  ) => {
    const logger = createExerciseLogger(exerciseId, exerciseName);
    logger.info('Exercise performance tracked', {
      context: { exercise_performance: performance },
    });

    // Check for performance improvements
    const isPersonalRecord = performance.weight > 0; // Simplified check
    if (isPersonalRecord) {
      logger.captureEvent('Personal record achieved', 'info', {
        exercise_performance: performance,
      });
    }
  },

  /**
   * Track navigation flow
   */
  trackNavigation: (fromRoute: string, toRoute: string, duration?: number, userId?: string) => {
    const logger = createComponentLogger('NAVIGATION', { userId });
    logger.info(`Navigation: ${fromRoute} → ${toRoute}`, {
      context: { from_route: fromRoute, to_route: toRoute, duration },
    });
    logger.addBreadcrumb(`Navigate to ${toRoute}`, 'info', {
      from_route: fromRoute,
      to_route: toRoute,
      duration,
    });
  },

  /**
   * Track API operations
   */
  trackAPIOperation: (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    duration: number,
    statusCode: number,
    success: boolean,
  ) => {
    const logger = loggers.api;

    logger.info(`API ${method} ${endpoint}`, {
      context: { method, endpoint, duration, status_code: statusCode, success },
    });

    if (!success || duration > PERFORMANCE_CONFIG.thresholds.warning) {
      logger.warn(`API operation issue`, undefined, {
        method,
        endpoint,
        duration,
        status_code: statusCode,
        success,
        issue_type: !success ? 'failure' : 'slow_response',
      });
    }
  },
};

/**
 * Global error boundary helper
 */
export function setupDebugErrorBoundary(): void {
  // Set up global error handler for debugging (React Native specific)
  if (typeof global !== 'undefined' && global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler?.();

    if (global.ErrorUtils.setGlobalHandler) {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        debugLogger.error('GLOBAL', 'Global error caught', error, {
          is_fatal: isFatal,
          error_boundary: 'debug_helpers',
        });

        // Call original handler
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }
  }

  console.log('✅ Debug error boundary setup complete');
}

// Default export to satisfy Expo Router
export default function DebugHelpers() {
  return null;
}
