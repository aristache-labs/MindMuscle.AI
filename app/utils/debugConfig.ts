/**
 * Debug Configuration
 *
 * Edit this file to enable/disable debugging for different components.
 * Set values to true to enable debugging, false to disable.
 * Enhanced with Sentry monitoring and performance tracking support.
 */

import * as Sentry from '@sentry/react-native';

export const DEBUG_CONFIG = {
  // Master switch - enables all debugging when true
  GLOBAL: false,

  // Component-specific debug flags
  SPLASH_SCREEN: false,
  SPLASH_PATCH: false,
  IMAGE_PRELOADER: false,
  NETWORK: false,
  AUTH: false,
  WORKOUT: false,
  DATA_SYNC: false,
  PERFORMANCE: false,
  API: false,

  // Add workout-specific debug flags
  WORKOUT_PLAN: false,
  WORKOUT_SESSION: false,
  EXERCISE: false,

  // Sentry and Monitoring debug flags
  SENTRY_DEBUG: false,
  ERROR_TRACKING: true,
  PERFORMANCE_MONITORING: true,
  BREADCRUMB_LOGGING: true,
  TRANSACTION_TRACKING: false,
  USER_INTERACTION_TRACKING: false,

  // Database and Storage debug flags
  DATABASE_QUERIES: false,
  CACHE_OPERATIONS: false,
  STORAGE_OPERATIONS: false,
  SYNC_OPERATIONS: false,

  // UI and Navigation debug flags
  NAVIGATION: false,
  COMPONENT_LIFECYCLE: false,
  RENDER_PERFORMANCE: false,
  GESTURE_HANDLING: false,

  // Analytics and Insights debug flags
  ANALYTICS_EVENTS: false,
  USER_BEHAVIOR: false,
  GAMIFICATION: false,
  ACHIEVEMENTS: false,

  // External Services debug flags
  FIREBASE: false,
  SUPABASE: false,
  AI_COACHING: false,
  IMAGE_PROCESSING: false,

  // Memory and Resource debug flags
  MEMORY_USAGE: false,
  ASYNC_OPERATIONS: false,
  TIMER_OPERATIONS: false,
  RESOURCE_CLEANUP: false,
};

/**
 * Sentry-specific debug configuration
 */
export const SENTRY_DEBUG_CONFIG = {
  // Enable debug mode for Sentry
  enableDebug: DEBUG_CONFIG.SENTRY_DEBUG,

  // Sample rates for different types of monitoring
  tracesSampleRate: DEBUG_CONFIG.PERFORMANCE_MONITORING ? 1.0 : 0.1,
  profilesSampleRate: DEBUG_CONFIG.PERFORMANCE_MONITORING ? 1.0 : 0.1,

  // Enable specific integrations for debugging
  enableUserInteractionTracing: DEBUG_CONFIG.USER_INTERACTION_TRACKING,
  enableAutoSessionTracking: DEBUG_CONFIG.ERROR_TRACKING,
  enableCaptureFailedRequests: DEBUG_CONFIG.NETWORK,

  // Breadcrumb configuration
  maxBreadcrumbs: DEBUG_CONFIG.BREADCRUMB_LOGGING ? 100 : 50,

  // Performance monitoring thresholds
  performanceThresholds: {
    navigation: DEBUG_CONFIG.NAVIGATION ? 500 : 1000,
    database: DEBUG_CONFIG.DATABASE_QUERIES ? 100 : 500,
    api: DEBUG_CONFIG.API ? 2000 : 5000,
    workout: DEBUG_CONFIG.WORKOUT ? 1000 : 3000,
    exercise: DEBUG_CONFIG.EXERCISE ? 500 : 2000,
  },
};

/**
 * Performance monitoring configuration
 */
export const PERFORMANCE_CONFIG = {
  // Enable performance tracking for different categories
  enableWorkoutTracking: DEBUG_CONFIG.WORKOUT || DEBUG_CONFIG.PERFORMANCE,
  enableDatabaseTracking: DEBUG_CONFIG.DATABASE_QUERIES || DEBUG_CONFIG.PERFORMANCE,
  enableNetworkTracking: DEBUG_CONFIG.NETWORK || DEBUG_CONFIG.PERFORMANCE,
  enableUITracking: DEBUG_CONFIG.COMPONENT_LIFECYCLE || DEBUG_CONFIG.PERFORMANCE,

  // Performance thresholds (in milliseconds)
  thresholds: {
    critical: 10000, // 10 seconds
    warning: 5000, // 5 seconds
    info: 1000, // 1 second
  },

  // Memory monitoring
  enableMemoryTracking: DEBUG_CONFIG.MEMORY_USAGE,
  memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
  memoryCriticalThreshold: 200 * 1024 * 1024, // 200MB
};

/**
 * Type definition for debug flags
 */
export type DebugFlags = typeof DEBUG_CONFIG;

/**
 * Enhanced debug logger with Sentry integration
 */
export class DebugLogger {
  private static instance: DebugLogger;
  private isProduction = process.env.NODE_ENV === 'production';

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  /**
   * Log debug message with Sentry breadcrumb
   */
  debug(category: keyof DebugFlags, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(category)) return;

    const logData = {
      category,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };

    // Console log in development
    if (!this.isProduction || DEBUG_CONFIG.GLOBAL) {
      console.log(`[DEBUG:${category}]`, message, data);
    }

    // Add Sentry breadcrumb
    if (DEBUG_CONFIG.BREADCRUMB_LOGGING) {
      Sentry.addBreadcrumb({
        category: `debug_${category.toLowerCase()}`,
        message,
        level: 'debug',
        data: logData,
      });
    }
  }

  /**
   * Log info message with Sentry breadcrumb
   */
  info(category: keyof DebugFlags, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(category)) return;

    const logData = {
      category,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };

    console.info(`[INFO:${category}]`, message, data);

    if (DEBUG_CONFIG.BREADCRUMB_LOGGING) {
      Sentry.addBreadcrumb({
        category: `info_${category.toLowerCase()}`,
        message,
        level: 'info',
        data: logData,
      });
    }
  }

  /**
   * Log warning with Sentry capture
   */
  warn(category: keyof DebugFlags, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(category)) return;

    const logData = {
      category,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };

    console.warn(`[WARN:${category}]`, message, data);

    if (DEBUG_CONFIG.ERROR_TRACKING) {
      Sentry.withScope((scope) => {
        scope.setTag('debug_category', category);
        scope.setLevel('warning');
        scope.setContext('debug_warning', logData);
        Sentry.captureMessage(`Debug Warning: ${message}`, 'warning');
      });
    }
  }

  /**
   * Log error with Sentry capture
   */
  error(
    category: keyof DebugFlags,
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(category)) return;

    const logData = {
      category,
      message,
      timestamp: new Date().toISOString(),
      error_message: error?.message,
      error_stack: error?.stack,
      ...data,
    };

    console.error(`[ERROR:${category}]`, message, error, data);

    if (DEBUG_CONFIG.ERROR_TRACKING) {
      Sentry.withScope((scope) => {
        scope.setTag('debug_category', category);
        scope.setLevel('error');
        scope.setContext('debug_error', logData);

        if (error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(`Debug Error: ${message}`, 'error');
        }
      });
    }
  }

  /**
   * Start performance timing
   */
  startTiming(category: keyof DebugFlags, operation: string): () => void {
    if (!this.shouldLog(category) && !DEBUG_CONFIG.PERFORMANCE) return () => {};

    const startTime = Date.now();

    this.debug(category, `Starting ${operation}`, {
      operation,
      start_time: startTime,
      timing_phase: 'start',
    });

    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const threshold = PERFORMANCE_CONFIG.thresholds;

      let level: 'info' | 'warning' | 'error' = 'info';
      if (duration > threshold.critical) level = 'error';
      else if (duration > threshold.warning) level = 'warning';

      const timingData = {
        operation,
        duration,
        start_time: startTime,
        end_time: endTime,
        timing_phase: 'end',
        performance_level: level,
      };

      if (level === 'error') {
        this.error(
          category,
          `Slow operation detected: ${operation} took ${duration}ms`,
          undefined,
          timingData,
        );
      } else if (level === 'warning') {
        this.warn(
          category,
          `Operation slower than expected: ${operation} took ${duration}ms`,
          timingData,
        );
      } else {
        this.debug(category, `Completed ${operation} in ${duration}ms`, timingData);
      }

      // Track performance in Sentry
      if (DEBUG_CONFIG.PERFORMANCE_MONITORING) {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `${operation} completed in ${duration}ms`,
          level: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
          data: timingData,
        });

        // Report slow operations
        if (duration > threshold.warning) {
          Sentry.withScope((scope) => {
            scope.setTag('performance_issue', 'slow_operation');
            scope.setTag('operation', operation);
            scope.setTag('category', category);
            scope.setLevel(level === 'error' ? 'error' : 'warning');
            scope.setContext('performance_context', timingData);

            Sentry.captureMessage(
              `Performance Issue: ${operation} took ${duration}ms`,
              level === 'error' ? 'error' : 'warning',
            );
          });
        }
      }
    };
  }

  /**
   * Track memory usage
   */
  trackMemory(category: keyof DebugFlags, operation: string): void {
    if (!DEBUG_CONFIG.MEMORY_USAGE && !this.shouldLog(category)) return;

    // React Native doesn't have performance.memory, but we can track other metrics
    const memoryData = {
      operation,
      timestamp: new Date().toISOString(),
      // Add memory tracking metrics when available
    };

    this.debug(category, `Memory tracking for ${operation}`, memoryData);

    if (DEBUG_CONFIG.PERFORMANCE_MONITORING) {
      Sentry.addBreadcrumb({
        category: 'memory',
        message: `Memory tracking: ${operation}`,
        level: 'info',
        data: memoryData,
      });
    }
  }

  /**
   * Check if logging is enabled for category
   */
  private shouldLog(category: keyof DebugFlags): boolean {
    return DEBUG_CONFIG.GLOBAL || DEBUG_CONFIG[category];
  }
}

/**
 * Convenience functions for common debug operations
 */
export const debugLogger = DebugLogger.getInstance();

export const debugWorkout = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('WORKOUT', message, data);

export const debugExercise = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('EXERCISE', message, data);

export const debugAuth = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('AUTH', message, data);

export const debugNetwork = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('NETWORK', message, data);

export const debugDatabase = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('DATABASE_QUERIES', message, data);

export const debugPerformance = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('PERFORMANCE', message, data);

export const debugNavigation = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('NAVIGATION', message, data);

export const debugAnalytics = (message: string, data?: Record<string, unknown>) =>
  debugLogger.debug('ANALYTICS_EVENTS', message, data);

/**
 * Performance timing helpers
 */
export const timeWorkout = (operation: string) => debugLogger.startTiming('WORKOUT', operation);

export const timeExercise = (operation: string) => debugLogger.startTiming('EXERCISE', operation);

export const timeDatabase = (operation: string) =>
  debugLogger.startTiming('DATABASE_QUERIES', operation);

export const timeNetwork = (operation: string) => debugLogger.startTiming('NETWORK', operation);

export const timeNavigation = (operation: string) =>
  debugLogger.startTiming('NAVIGATION', operation);

/**
 * Initialize debug configuration with Sentry
 */
export function initializeDebugConfig(): void {
  // Configure Sentry based on debug settings
  if (DEBUG_CONFIG.SENTRY_DEBUG) {
    console.log('🐛 Debug mode enabled for Sentry');

    // Add debug breadcrumb
    Sentry.addBreadcrumb({
      category: 'debug',
      message: 'Debug configuration initialized',
      level: 'info',
      data: {
        config: DEBUG_CONFIG,
        sentry_config: SENTRY_DEBUG_CONFIG,
        performance_config: PERFORMANCE_CONFIG,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Log active debug flags
  const activeFlags = Object.entries(DEBUG_CONFIG)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  if (activeFlags.length > 0) {
    debugLogger.info('GLOBAL', 'Active debug flags', {
      active_flags: activeFlags,
      total_flags: activeFlags.length,
    });
  }

  // Set up performance monitoring
  if (DEBUG_CONFIG.PERFORMANCE_MONITORING) {
    debugLogger.info('PERFORMANCE', 'Performance monitoring enabled', {
      thresholds: PERFORMANCE_CONFIG.thresholds,
      tracking_enabled: PERFORMANCE_CONFIG,
    });
  }

  console.log('✅ Debug configuration initialized');
}

// Default export to satisfy Expo Router
export default function DebugConfig() {
  return null;
}
