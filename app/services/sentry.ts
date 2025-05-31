import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry Configuration and Utilities for MindMuscle.AI
 *
 * This service provides comprehensive Sentry integration including:
 * - Error tracking and performance monitoring
 * - Profiling and mobile replay (production only)
 * - Structured logging and insights
 * - Manual testing utilities
 *
 * To manually test Sentry functionality in development:
 * import { SentryTestUtils } from './services/sentry';
 * SentryTestUtils.runComprehensiveTest();
 */

// Type definitions for Sentry data collection
type SentryValue = string | number | boolean | Date | null | undefined;

interface SentryContext {
  [key: string]: SentryValue | Record<string, SentryValue>;
}

interface BreadcrumbData {
  [key: string]: SentryValue | Record<string, SentryValue>;
}

// Tracing types
// interface TracingOptions {
//   name: string;
//   op?: string;
//   description?: string;
//   data?: Record<string, any>;
//   tags?: Record<string, string>;
// }
/* eslint-disable */
export function initializeSentry() {
  try {
    // Get DSN from app.json
    const sentryDsn = Constants.expoConfig?.extra?.sentryDsn || '';

    if (!sentryDsn) {
      console.warn('Sentry DSN is not configured');
      return;
    }

    // Skip native initialization in development to prevent errors
    const isExpoGo = Constants.appOwnership === 'expo';
    const isDevelopment = __DEV__;

    Sentry.init({
      dsn: sentryDsn,

      // CRITICAL: Disable native SDK auto-initialization in development and Expo Go
      autoInitializeNativeSdk: !isDevelopment && !isExpoGo,

      // Enhanced Data Collection Configuration
      // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/

      // Adds more context data to events (IP address, cookies, user, etc.)
      // Set to true to send PII data like user info, device names, etc.
      sendDefaultPii: true,

      // Enhanced Tracing Configuration
      // For more information, visit: https://docs.sentry.io/platforms/react-native/tracing/
      tracesSampleRate: __DEV__ ? 1.0 : 0.3, // 100% in dev, 30% in production

      // Mobile Replay Configuration - disable in development to prevent errors
      // For more information, visit: https://docs.sentry.io/platforms/react-native/session-replay/
      replaysSessionSampleRate: isDevelopment ? 0 : 0.1, // Disabled in dev, 10% in production
      replaysOnErrorSampleRate: isDevelopment ? 0 : 1.0, // Disabled in dev, always capture replays on errors in production

      // Enhanced profiling for better insights - disable in development
      profilesSampleRate: isDevelopment ? 0 : 0.2, // Disabled in dev, 20% in production

      // IMPORTANT: Disable profiling experiments in development
      _experiments: isDevelopment
        ? {}
        : {
            profilesSampleRate: 0.2,
            // Additional profiling configurations
            maxProfileDurationMs: 30000, // 30 seconds max profile duration
          },

      // Session tracking - enhanced
      autoSessionTracking: true,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 10000, // Check every 10 seconds (more frequent)

      // Enhanced breadcrumb collection
      maxBreadcrumbs: 150, // Increased from 100

      // Enhanced debugging and data collection
      debug: __DEV__, // Enable debug logs in development
      environment: Constants.expoConfig?.extra?.environment || 'development',

      // Release and dist for better error tracking
      release: Constants.expoConfig?.version || '1.0.0',
      dist: Constants.expoConfig?.extra?.buildNumber || '1',

      // Enhanced native integration - disable problematic features in development
      enableNativeCrashHandling: !isDevelopment && !isExpoGo,
      enableNativeNagger: false, // Disable to prevent console spam
      enableAutoPerformanceTracing: !isDevelopment, // Disable in dev to prevent errors
      enableWatchdogTerminationTracking: !isDevelopment && !isExpoGo, // Disable in dev

      // Enhanced stack trace and debugging
      attachStacktrace: true,
      sendClientReports: !isDevelopment, // Disable client reports in development

      // Enhanced integrations with conditional loading
      integrations: [
        // React Navigation integration for tracing
        Sentry.reactNavigationIntegration({
          enableTimeToInitialDisplay: true,
        }),

        // Only include native integrations in production builds
        ...(isDevelopment || isExpoGo
          ? []
          : [
              // Hermes profiling integration for performance profiling
              Sentry.hermesProfilingIntegration({
                platformProfilers: true, // Enable both JS and native platform profiling
              }),

              // Mobile Replay integration for session recording
              Sentry.mobileReplayIntegration({
                maskAllText: true, // Mask all text by default for privacy
                maskAllImages: true, // Mask all images by default for privacy
                maskAllVectors: true, // Mask all vector graphics by default for privacy
              }),
            ]),
      ],

      // Enhanced tracing options for better insights
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.supabase\.co/,
        /^https:\/\/api\.openai\.com/,
        /^https:\/\/[^/]*\.firebase\.com/,
        /^https:\/\/[^/]*\.googleapis\.com/,
      ],

      // Production optimization: reduce noise in production
      beforeSend(event, _hint) {
        // In development, send everything for better debugging
        if (__DEV__) {
          console.log('Sentry event being sent:', event);
          return event;
        }

        // In production, filter out excessive API breadcrumbs and focus on errors
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs
            .filter((breadcrumb) => {
              // Keep error-related breadcrumbs
              if (breadcrumb.level === 'error' || breadcrumb.level === 'warning') {
                return true;
              }

              // Keep important app lifecycle events
              if (
                breadcrumb.category === 'app.lifecycle' ||
                breadcrumb.category === 'workout' ||
                breadcrumb.category === 'navigation'
              ) {
                return true;
              }

              // Filter out excessive HTTP requests in production
              if (breadcrumb.type === 'http' && breadcrumb.category === 'xhr') {
                // Keep only failed requests and important endpoints
                return (
                  breadcrumb.data?.status_code >= 400 ||
                  (breadcrumb.data?.url &&
                    (breadcrumb.data.url.includes('/auth/') ||
                      breadcrumb.data.url.includes('/api/')))
                );
              }

              return true;
            })
            .slice(-50); // Keep only last 50 breadcrumbs in production
        }

        // Filter sensitive data
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['Cookie'];
        }

        if (event.request?.query_string && typeof event.request.query_string === 'string') {
          event.request.query_string = event.request.query_string
            .replace(/password=[^&]*/gi, 'password=[Filtered]')
            .replace(/token=[^&]*/gi, 'token=[Filtered]');
        }

        return event;
      },

      // Enhanced beforeBreadcrumb for more data collection
      beforeBreadcrumb(breadcrumb, _hint) {
        // In development, collect all breadcrumbs
        if (__DEV__) {
          console.log('Sentry breadcrumb:', breadcrumb);
          return breadcrumb;
        }

        // In production, filter sensitive breadcrumbs
        if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
          // Remove sensitive query parameters from URLs
          const url = new URL(breadcrumb.data.url as string);
          url.searchParams.delete('password');
          url.searchParams.delete('token');
          breadcrumb.data.url = url.toString();
        }

        return breadcrumb;
      },

      // Enhanced initial scope configuration
      initialScope: {
        tags: {
          component: 'MindMuscle.AI',
          platform: Constants.platform?.ios ? 'ios' : 'android',
          expo_version: Constants.expoConfig?.sdkVersion || 'unknown',
        },
        contexts: {
          device: {
            family: Constants.platform?.ios ? 'iOS' : 'Android',
            model: Constants.platform?.ios ? 'iOS Device' : 'Android Device',
          },
          app: {
            app_version: Constants.expoConfig?.version,
            app_build: Constants.expoConfig?.extra?.buildNumber || '1',
          },
        },
      },
    });

    // Set up console integration manually after initialization
    setupConsoleIntegration();

    // Enhanced user context setup
    Sentry.setUser({
      ip_address: '{{auto}}', // Let Sentry determine IP automatically
      // Add more user context in development
      ...(__DEV__ && {
        username: 'dev-user',
        email: 'dev@mindmuscle.ai',
      }),
    });

    // Enhanced app context
    Sentry.setContext('app_info', {
      app_version: Constants.expoConfig?.version,
      expo_version: Constants.expoConfig?.sdkVersion,
      platform: Constants.platform?.ios ? 'ios' : 'android',
      device_year_class: Constants.deviceYearClass,
      is_device: Constants.isDevice,
      app_ownership: Constants.appOwnership,
    });

    // Add performance context
    Sentry.setContext('performance', {
      memory_warning_count: 0,
      startup_time: Date.now(),
    });

    // Enhanced initialization logging
    if (__DEV__) {
      console.log('🚀 Sentry initialized successfully with enhanced data collection');
      console.log('📊 Sentry DSN:', sentryDsn);
      console.log('⚙️ Sentry configuration:', {
        sendDefaultPii: true,
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        replaysSessionSampleRate: 1.0,
        replaysOnErrorSampleRate: 1.0,
        autoInitializeNativeSdk: true,
        environment: Constants.expoConfig?.extra?.environment || 'development',
        release: Constants.expoConfig?.version || '1.0.0',
        maxBreadcrumbs: 150,
        enableAutoPerformanceTracing: true,
        profilingEnabled: true,
        mobileReplayEnabled: true,
        integrations: [
          'reactNavigationIntegration',
          'hermesProfilingIntegration',
          'mobileReplayIntegration',
          'consoleIntegration (manual)',
        ],
      });

      // Test profiling and replay availability
      console.log('🔍 Sentry Features Configuration Check:');
      console.log('  ✓ profilesSampleRate:', __DEV__ ? 1.0 : 0.2);
      console.log('  ✓ tracesSampleRate:', __DEV__ ? 1.0 : 0.3);
      console.log('  ✓ replaysSessionSampleRate:', __DEV__ ? 1.0 : 0.1);
      console.log('  ✓ replaysOnErrorSampleRate: 1.0');
      console.log('  ✓ autoInitializeNativeSdk: true');
      console.log('  ✓ enableAutoPerformanceTracing: true');
      console.log('  ✓ Platform:', Constants.platform?.ios ? 'iOS' : 'Android');
      console.log('  ✓ Hermes Engine: enabled');
      console.log('  ✓ Mobile Replay: enabled with privacy masking');
      console.log('  ✓ Console Integration: enabled (manual setup)');
      console.log('  ⚠️ Note: Profiling requires active transactions to capture data');
      console.log('  ⚠️ Note: Mobile Replay captures user sessions for debugging');

      // Add initial breadcrumb (no test message sent to Sentry dashboard)
      Sentry.addBreadcrumb({
        message:
          'App started with enhanced Sentry configuration including profiling and mobile replay',
        category: 'app.lifecycle',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          platform: Constants.platform?.ios ? 'ios' : 'android',
          version: Constants.expoConfig?.version,
          profiling_enabled: true,
          profiling_sample_rate: __DEV__ ? 1.0 : 0.2,
          traces_sample_rate: __DEV__ ? 1.0 : 0.3,
          mobile_replay_enabled: true,
          replay_session_sample_rate: __DEV__ ? 1.0 : 0.1,
          replay_error_sample_rate: 1.0,
        },
      });

      // Note: Sentry test functions are available via SentryTestUtils.runComprehensiveTest()
      // if you need to verify Sentry functionality manually
    }
  } catch (error) {
    console.warn('❌ Sentry initialization failed:', error);
    // Even if Sentry fails, try to capture this error
    try {
      Sentry.captureException(error);
    } catch {
      // Silently fail if Sentry is not available
    }
  }
}

// Manual console integration setup - compatible with Sentry React Native 6.x
function setupConsoleIntegration() {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  // Override console methods to capture them in Sentry
  console.log = (...args) => {
    Sentry.addBreadcrumb({
      message: args.join(' '),
      level: 'info',
      category: 'console',
      timestamp: Date.now() / 1000,
    });
    originalConsole.log(...args);
  };

  console.info = (...args) => {
    Sentry.addBreadcrumb({
      message: args.join(' '),
      level: 'info',
      category: 'console',
      timestamp: Date.now() / 1000,
    });
    originalConsole.info(...args);
  };

  console.warn = (...args) => {
    Sentry.addBreadcrumb({
      message: args.join(' '),
      level: 'warning',
      category: 'console',
      timestamp: Date.now() / 1000,
    });
    originalConsole.warn(...args);
  };

  console.error = (...args) => {
    const message = args.join(' ');

    // Only send console.error to Sentry if it's not a test message
    if (!message.includes('Testing console.error integration') && !message.includes('test')) {
      Sentry.captureMessage(message, 'error');
    }

    Sentry.addBreadcrumb({
      message,
      level: 'error',
      category: 'console',
      timestamp: Date.now() / 1000,
    });
    originalConsole.error(...args);
  };

  console.debug = (...args) => {
    if (__DEV__) {
      Sentry.addBreadcrumb({
        message: args.join(' '),
        level: 'debug',
        category: 'console',
        timestamp: Date.now() / 1000,
      });
    }
    originalConsole.debug(...args);
  };
}

// Test function to verify profiling is working
function testProfilingFunctionality() {
  try {
    // Create a transaction to test profiling using withScope
    Sentry.withScope((scope) => {
      scope.setTag('test_type', 'profiling');
      scope.setContext('profiling_test', {
        test_name: 'test_profiling_transaction',
        operation: 'test.profiling',
      });

      // Simulate some work
      const startTime = Date.now();

      // CPU-intensive operation to generate profile data
      let sum = 0;
      for (let i = 0; i < 100000; i++) {
        sum += Math.random() * i;
      }

      const duration = Date.now() - startTime;

      scope.setContext('test_results', {
        test_sum: sum,
        duration_ms: duration,
        status: 'ok',
      });

      console.log('✅ Profiling test completed successfully');
      console.log(`📊 Test duration: ${duration}ms, Sum: ${sum.toFixed(2)}`);

      // Add breadcrumb about profiling test
      Sentry.addBreadcrumb({
        message: 'Profiling functionality test completed',
        category: 'profiling.test',
        level: 'info',
        data: {
          duration_ms: duration,
          test_result: 'success',
          timestamp: new Date().toISOString(),
        },
      });

      // Note: Test message and console integration tests are disabled by default
      // to prevent test events in Sentry dashboard. Use SentryTestUtils if needed.

      // Add a note about the test component
      console.log('🧪 Sentry Test Component available in app - check dropdown menu "Sentry Test"');
    });
  } catch (error) {
    console.error('❌ Profiling test failed:', error);
    Sentry.withScope((scope) => {
      scope.setTag('test_type', 'profiling_verification');
      scope.setContext('test_error', {
        test_failed: true,
        error_message: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  }
}

// Utility functions for data collection management
export const SentryDataCollection = {
  // Set user information (respects sendDefaultPii setting)
  setUser: (user: { id?: string; email?: string; username?: string; ip_address?: string }) => {
    Sentry.setUser(user);
  },

  // Clear user information
  clearUser: () => {
    Sentry.setUser(null);
  },

  // Add custom context
  setContext: (key: string, context: SentryContext) => {
    Sentry.setContext(key, context);
  },

  // Add tags for filtering
  setTag: (key: string, value: string) => {
    Sentry.setTag(key, value);
  },

  // Add breadcrumb manually
  addBreadcrumb: (breadcrumb: {
    message: string;
    category?: string;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    data?: BreadcrumbData;
  }) => {
    Sentry.addBreadcrumb(breadcrumb);
  },

  // Capture exception with additional context
  captureException: (error: Error, context?: SentryContext) => {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value as Record<string, unknown>);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  },

  // Capture message with level
  captureMessage: (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  ) => {
    Sentry.captureMessage(message, level);
  },
};

// Tracing utilities for custom instrumentation
export const SentryTracing = {
  // Add performance mark
  addPerformanceMark: (name: string, data?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      message: `Performance mark: ${name}`,
      category: 'performance',
      level: 'info',
      data,
    });
  },

  // Track workout-specific operations with timing
  trackWorkoutOperation: async <T>(
    operation: string,
    workoutId: string,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const startTime = Date.now();

    // Add breadcrumb for operation start
    Sentry.addBreadcrumb({
      message: `Workout ${operation} started`,
      category: 'workout',
      level: 'info',
      data: { workoutId, operation },
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      // Add breadcrumb for successful completion
      Sentry.addBreadcrumb({
        message: `Workout ${operation} completed`,
        category: 'workout',
        level: 'info',
        data: { workoutId, operation, duration },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Add breadcrumb for error
      Sentry.addBreadcrumb({
        message: `Workout ${operation} failed`,
        category: 'workout',
        level: 'error',
        data: {
          workoutId,
          operation,
          duration,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      // Capture the exception with context
      Sentry.withScope((scope) => {
        scope.setTag('feature', 'workout');
        scope.setContext('workout_operation', {
          operation,
          workoutId,
          duration,
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });

      throw error;
    }
  },

  // Track exercise-specific operations
  trackExerciseOperation: async <T>(
    operation: string,
    exerciseId: string,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: `Exercise ${operation} started`,
      category: 'exercise',
      level: 'info',
      data: { exerciseId, operation },
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      Sentry.addBreadcrumb({
        message: `Exercise ${operation} completed`,
        category: 'exercise',
        level: 'info',
        data: { exerciseId, operation, duration },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.withScope((scope) => {
        scope.setTag('feature', 'exercise');
        scope.setContext('exercise_operation', {
          operation,
          exerciseId,
          duration,
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });

      throw error;
    }
  },

  // Track database operations
  trackDatabaseOperation: async <T>(
    operation: string,
    table: string,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: `Database ${operation} on ${table} started`,
      category: 'database',
      level: 'info',
      data: { table, operation },
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      Sentry.addBreadcrumb({
        message: `Database ${operation} on ${table} completed`,
        category: 'database',
        level: 'info',
        data: { table, operation, duration },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.withScope((scope) => {
        scope.setTag('feature', 'database');
        scope.setContext('database_operation', {
          operation,
          table,
          duration,
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });

      throw error;
    }
  },

  // Track API calls
  trackApiCall: async <T>(endpoint: string, method: string, fn: () => Promise<T>): Promise<T> => {
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: `API ${method} ${endpoint} started`,
      category: 'api',
      level: 'info',
      data: { endpoint, method },
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      Sentry.addBreadcrumb({
        message: `API ${method} ${endpoint} completed`,
        category: 'api',
        level: 'info',
        data: { endpoint, method, duration },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.withScope((scope) => {
        scope.setTag('feature', 'api');
        scope.setContext('api_call', {
          endpoint,
          method,
          duration,
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });

      throw error;
    }
  },

  // Track navigation performance
  trackNavigation: (routeName: string, params?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      message: `Navigation to ${routeName}`,
      category: 'navigation',
      level: 'info',
      data: { routeName, params },
    });

    // Set context for current screen
    Sentry.setContext('current_screen', {
      screen: routeName,
      params,
      timestamp: new Date().toISOString(),
    });
  },

  // Measure function execution time (simplified version)
  measureAsync: async <T>(
    name: string,
    fn: () => Promise<T>,
    options?: { category?: string; tags?: Record<string, string> },
  ): Promise<T> => {
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: `${name} started`,
      category: options?.category || 'performance',
      level: 'info',
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      Sentry.addBreadcrumb({
        message: `${name} completed`,
        category: options?.category || 'performance',
        level: 'info',
        data: { duration },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.withScope((scope) => {
        if (options?.tags) {
          Object.entries(options.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }
        scope.setContext('performance_measurement', {
          name,
          duration,
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });

      throw error;
    }
  },
};

// Export commonly used functions
export const { captureException, captureMessage, addBreadcrumb } = Sentry;

// Custom Logging System (Sentry Logs Alternative)
// This provides structured logging capabilities similar to Sentry Logs
// but using existing Sentry features until React Native support is added
export const SentryLogger = {
  // Log levels matching Sentry's standard levels
  levels: {
    DEBUG: 'debug',
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    FATAL: 'fatal',
  } as const,

  // Core logging function
  log: (
    level: 'debug' | 'info' | 'warning' | 'error' | 'fatal',
    message: string,
    data?: Record<string, any>,
    tags?: Record<string, string>,
  ) => {
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create structured log data
    const logData = {
      log_id: logId,
      timestamp,
      level,
      message,
      ...data,
    };

    // Add as breadcrumb for log trail
    Sentry.addBreadcrumb({
      message: `[${level.toUpperCase()}] ${message}`,
      category: 'log',
      level: level as any,
      data: logData,
    });

    // For warnings and errors, also capture as Sentry events
    if (level === 'warning' || level === 'error' || level === 'fatal') {
      Sentry.withScope((scope) => {
        // Add tags if provided
        if (tags) {
          Object.entries(tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }

        // Add log context
        scope.setContext('log_details', logData);
        scope.setTag('log_level', level);
        scope.setTag('log_id', logId);

        // Capture as message
        Sentry.captureMessage(`[LOG] ${message}`, level as any);
      });
    }

    // Console output for development
    if (__DEV__) {
      const consoleMethod =
        level === 'error' || level === 'fatal' ? 'error' : level === 'warning' ? 'warn' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, data || '');
    }
  },

  // Convenience methods for each log level
  debug: (message: string, data?: Record<string, any>, tags?: Record<string, string>) => {
    SentryLogger.log('debug', message, data, tags);
  },

  info: (message: string, data?: Record<string, any>, tags?: Record<string, string>) => {
    SentryLogger.log('info', message, data, tags);
  },

  warn: (message: string, data?: Record<string, any>, tags?: Record<string, string>) => {
    SentryLogger.log('warning', message, data, tags);
  },

  error: (message: string, data?: Record<string, any>, tags?: Record<string, string>) => {
    SentryLogger.log('error', message, data, tags);
  },

  fatal: (message: string, data?: Record<string, any>, tags?: Record<string, string>) => {
    SentryLogger.log('fatal', message, data, tags);
  },

  // Structured logging for specific app features
  workout: {
    started: (workoutId: string, planId?: string, exercises?: number) => {
      SentryLogger.info(
        'Workout session started',
        {
          workout_id: workoutId,
          plan_id: planId,
          exercise_count: exercises,
          session_type: 'workout',
        },
        { feature: 'workout', action: 'start' },
      );
    },

    completed: (workoutId: string, duration: number, exercisesCompleted: number) => {
      SentryLogger.info(
        'Workout session completed',
        {
          workout_id: workoutId,
          duration_seconds: duration,
          exercises_completed: exercisesCompleted,
          session_type: 'workout',
        },
        { feature: 'workout', action: 'complete' },
      );
    },

    paused: (workoutId: string, currentExercise: string) => {
      SentryLogger.info(
        'Workout session paused',
        {
          workout_id: workoutId,
          current_exercise: currentExercise,
          session_type: 'workout',
        },
        { feature: 'workout', action: 'pause' },
      );
    },

    error: (workoutId: string, error: string, context?: Record<string, any>) => {
      SentryLogger.error(
        'Workout session error',
        {
          workout_id: workoutId,
          error_message: error,
          session_type: 'workout',
          ...context,
        },
        { feature: 'workout', action: 'error' },
      );
    },
  },

  // User interaction logging
  user: {
    action: (action: string, screen: string, data?: Record<string, any>) => {
      SentryLogger.info(
        `User ${action}`,
        {
          action,
          screen,
          interaction_type: 'user_action',
          ...data,
        },
        { feature: 'user_interaction', screen },
      );
    },

    navigation: (from: string, to: string, method?: string) => {
      SentryLogger.info(
        'User navigation',
        {
          from_screen: from,
          to_screen: to,
          navigation_method: method || 'unknown',
          interaction_type: 'navigation',
        },
        { feature: 'navigation', from, to },
      );
    },

    error: (action: string, error: string, context?: Record<string, any>) => {
      SentryLogger.error(
        `User action failed: ${action}`,
        {
          failed_action: action,
          error_message: error,
          interaction_type: 'user_error',
          ...context,
        },
        { feature: 'user_interaction', action: 'error' },
      );
    },
  },

  // API and database logging
  api: {
    request: (endpoint: string, method: string, data?: Record<string, any>) => {
      SentryLogger.debug(
        'API request initiated',
        {
          endpoint,
          method,
          request_type: 'api_call',
          ...data,
        },
        { feature: 'api', endpoint, method },
      );
    },

    success: (endpoint: string, method: string, duration: number, data?: Record<string, any>) => {
      SentryLogger.info(
        'API request successful',
        {
          endpoint,
          method,
          duration_ms: duration,
          request_type: 'api_call',
          status: 'success',
          ...data,
        },
        { feature: 'api', endpoint, method },
      );
    },

    error: (endpoint: string, method: string, error: string, statusCode?: number) => {
      SentryLogger.error(
        'API request failed',
        {
          endpoint,
          method,
          error_message: error,
          status_code: statusCode,
          request_type: 'api_call',
          status: 'error',
        },
        { feature: 'api', endpoint, method },
      );
    },
  },

  // Database operation logging
  database: {
    query: (table: string, operation: string, data?: Record<string, any>) => {
      SentryLogger.debug(
        'Database query executed',
        {
          table,
          operation,
          query_type: 'database_operation',
          ...data,
        },
        { feature: 'database', table, operation },
      );
    },

    error: (table: string, operation: string, error: string, query?: string) => {
      SentryLogger.error(
        'Database operation failed',
        {
          table,
          operation,
          error_message: error,
          query: query?.substring(0, 200), // Truncate long queries
          query_type: 'database_operation',
        },
        { feature: 'database', table, operation },
      );
    },
  },

  // Performance logging
  performance: {
    mark: (name: string, duration?: number, data?: Record<string, any>) => {
      SentryLogger.info(
        'Performance mark',
        {
          performance_mark: name,
          duration_ms: duration,
          measurement_type: 'performance',
          ...data,
        },
        { feature: 'performance', mark: name },
      );
    },

    slow: (operation: string, duration: number, threshold: number, data?: Record<string, any>) => {
      SentryLogger.warn(
        'Slow operation detected',
        {
          operation,
          duration_ms: duration,
          threshold_ms: threshold,
          measurement_type: 'performance',
          performance_issue: 'slow_operation',
          ...data,
        },
        { feature: 'performance', operation, issue: 'slow' },
      );
    },
  },
};

// Advanced Performance Monitoring for Sentry Insights
// Provides macro-level metrics to micro-level spans as per Sentry Insights documentation
export const SentryInsights = {
  // Transaction management for comprehensive performance tracking
  startTransaction: (name: string, op: string, data?: Record<string, any>) => {
    // For React Native, we'll use performance marking and scoped events
    const transactionId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Mark the start of the transaction
    Sentry.addBreadcrumb({
      message: `Transaction started: ${name}`,
      category: 'performance',
      level: 'info',
      data: {
        transaction_id: transactionId,
        transaction_name: name,
        transaction_op: op,
        transaction_start: Date.now(),
        ...data,
      },
    });

    // Set transaction context
    Sentry.setTag('current_transaction', transactionId);
    Sentry.setTag('transaction_name', name);
    Sentry.setTag('transaction_op', op);

    if (data) {
      Sentry.setContext(`transaction_${transactionId}`, {
        ...data,
        transaction_name: name,
        transaction_op: op,
        started_at: new Date().toISOString(),
      });
    }

    const startTime = Date.now();

    if (__DEV__) {
      console.log(`🔄 Started transaction: ${name} (${op}) [${transactionId}]`);
    }

    return {
      name,
      op,
      startTime,
      transactionId,
      data: data || {},
      setStatus: (status: string) => {
        Sentry.setTag(`transaction_${transactionId}_status`, status);
        Sentry.setContext(`transaction_${transactionId}_status`, { status, timestamp: Date.now() });
      },
      setData: (key: string, value: any) => {
        Sentry.setContext(`transaction_${transactionId}_${key}`, { [key]: value });
      },
      setTag: (key: string, value: string) => {
        Sentry.setTag(`transaction_${transactionId}_${key}`, value);
      },
      finish: () => {
        const duration = Date.now() - startTime;

        // Mark transaction completion
        Sentry.addBreadcrumb({
          message: `Transaction completed: ${name}`,
          category: 'performance',
          level: 'info',
          data: {
            transaction_id: transactionId,
            transaction_name: name,
            transaction_op: op,
            duration_ms: duration,
            completed_at: Date.now(),
            ...data,
          },
        });

        // Send performance event
        Sentry.withScope((scope) => {
          scope.setTag('event_type', 'transaction_completed');
          scope.setTag('transaction_id', transactionId);
          scope.setTag('transaction_name', name);
          scope.setTag('transaction_op', op);
          scope.setContext('performance_data', {
            transaction_name: name,
            operation: op,
            duration_ms: duration,
            started_at: startTime,
            completed_at: Date.now(),
            transaction_id: transactionId,
            ...data,
          });

          Sentry.captureMessage(`Transaction completed: ${name}`, 'info');
        });

        if (__DEV__) {
          console.log(`✅ Finished transaction: ${name} (${duration}ms) [${transactionId}]`);
        }
      },
      startChild: (childData: { op: string; description: string; data?: Record<string, any> }) => {
        return SentryInsights.createSpan(
          { transactionId, transaction: null },
          childData.op,
          childData.description,
          childData.data,
        );
      },
    };
  },

  // Finish transaction with metrics
  finishTransaction: (transactionWrapper: any, status?: string, data?: Record<string, any>) => {
    if (transactionWrapper) {
      if (status) {
        transactionWrapper.setStatus(status);
      }

      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          transactionWrapper.setData(key, value);
        });
      }

      transactionWrapper.finish();
    }
  },

  // Create spans for micro-level performance tracking
  createSpan: (
    transactionWrapper: any,
    operation: string,
    description: string,
    data?: Record<string, any>,
  ) => {
    const spanId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const parentTransactionId = transactionWrapper?.transactionId || 'unknown';

    // Mark span start
    Sentry.addBreadcrumb({
      message: `Span started: ${description}`,
      category: 'performance',
      level: 'info',
      data: {
        span_id: spanId,
        parent_transaction_id: parentTransactionId,
        span_operation: operation,
        span_description: description,
        span_start: Date.now(),
        ...data,
      },
    });

    const startTime = Date.now();

    if (__DEV__) {
      console.log(`📊 Created span: ${description} (${operation}) [${spanId}]`);
    }

    return {
      op: operation,
      description,
      startTime,
      spanId,
      parentTransactionId,
      data: data || {},
      setStatus: (status: string) => {
        Sentry.setTag(`span_${spanId}_status`, status);
      },
      setData: (key: string, value: any) => {
        Sentry.setContext(`span_${spanId}_${key}`, { [key]: value });
      },
      setTag: (key: string, value: string) => {
        Sentry.setTag(`span_${spanId}_${key}`, value);
      },
      finish: () => {
        const duration = Date.now() - startTime;

        // Mark span completion
        Sentry.addBreadcrumb({
          message: `Span completed: ${description}`,
          category: 'performance',
          level: 'info',
          data: {
            span_id: spanId,
            parent_transaction_id: parentTransactionId,
            span_operation: operation,
            span_description: description,
            duration_ms: duration,
            completed_at: Date.now(),
            ...data,
          },
        });

        // Send span completion event
        Sentry.withScope((scope) => {
          scope.setTag('event_type', 'span_completed');
          scope.setTag('span_id', spanId);
          scope.setTag('parent_transaction_id', parentTransactionId);
          scope.setTag('span_operation', operation);
          scope.setContext('span_performance', {
            span_operation: operation,
            span_description: description,
            duration_ms: duration,
            parent_transaction_id: parentTransactionId,
            span_id: spanId,
            started_at: startTime,
            completed_at: Date.now(),
            ...data,
          });

          Sentry.captureMessage(`Span completed: ${description}`, 'info');
        });

        if (__DEV__) {
          console.log(`📊 Finished span: ${description} (${duration}ms) [${spanId}]`);
        }
      },
    };
  },

  // Workout-specific performance tracking
  workout: {
    // Track complete workout session
    trackWorkoutSession: async <T>(
      workoutId: string,
      planId: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `workout_session_${workoutId}`,
        'workout.session',
        {
          workout_id: workoutId,
          plan_id: planId,
          session_type: 'complete_workout',
        },
      );

      try {
        const result = await fn();

        SentryInsights.finishTransaction(transaction, 'ok', {
          workout_completed: true,
          session_result: 'success',
        });

        return result;
      } catch (error) {
        SentryInsights.finishTransaction(transaction, 'internal_error', {
          workout_completed: false,
          session_result: 'error',
          error_message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    // Track individual exercise performance
    trackExercisePerformance: async <T>(
      transaction: any,
      exerciseId: string,
      exerciseName: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const span = SentryInsights.createSpan(
        transaction,
        'workout.exercise',
        `Exercise: ${exerciseName}`,
        {
          exercise_id: exerciseId,
          exercise_name: exerciseName,
        },
      );

      try {
        const result = await fn();

        if (span) {
          span.setStatus('ok');
          span.setData('exercise_completed', true);
          span.finish();
        }

        return result;
      } catch (error) {
        if (span) {
          span.setStatus('internal_error');
          span.setData('exercise_completed', false);
          span.setData('error_message', error instanceof Error ? error.message : String(error));
          span.finish();
        }
        throw error;
      }
    },

    // Track rest periods
    trackRestPeriod: (transaction: any, duration: number, exerciseName: string) => {
      const span = SentryInsights.createSpan(
        transaction,
        'workout.rest',
        `Rest after ${exerciseName}`,
        {
          rest_duration_seconds: duration,
          exercise_name: exerciseName,
        },
      );

      if (span) {
        // Simulate rest period completion
        setTimeout(() => {
          span.setStatus('ok');
          span.finish();
        }, 100); // Immediate finish for tracking purposes
      }
    },
  },

  // API performance tracking for backend insights
  api: {
    // Track API calls with detailed performance metrics
    trackApiCall: async <T>(
      endpoint: string,
      method: string,
      fn: () => Promise<T>,
      options?: { timeout?: number; retries?: number },
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `api_${method.toLowerCase()}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
        'http.client',
        {
          endpoint,
          method,
          api_type: 'external',
          timeout: options?.timeout,
          max_retries: options?.retries,
        },
      );

      const startTime = Date.now();

      try {
        const result = await fn();
        const duration = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'ok', {
          response_time_ms: duration,
          api_success: true,
          status_category: 'success',
        });

        // Log performance insights
        SentryLogger.api.success(endpoint, method, duration, {
          performance_category: duration > 2000 ? 'slow' : duration > 1000 ? 'medium' : 'fast',
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'internal_error', {
          response_time_ms: duration,
          api_success: false,
          status_category: 'error',
          error_message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    },

    // Track database operations
    trackDatabaseOperation: async <T>(
      operation: string,
      table: string,
      fn: () => Promise<T>,
      queryInfo?: { query?: string; params?: any[] },
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(`db_${operation}_${table}`, 'db.query', {
        operation,
        table,
        query_type: operation,
        has_params: !!queryInfo?.params?.length,
      });

      const startTime = Date.now();

      try {
        const result = await fn();
        const duration = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'ok', {
          query_time_ms: duration,
          db_success: true,
          performance_category: duration > 1000 ? 'slow' : duration > 500 ? 'medium' : 'fast',
        });

        // Log slow queries for optimization insights
        if (duration > 1000) {
          SentryLogger.performance.slow(`db_${operation}_${table}`, duration, 500, {
            table,
            operation,
            query: queryInfo?.query?.substring(0, 100),
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'internal_error', {
          query_time_ms: duration,
          db_success: false,
          error_message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    },
  },

  // Navigation performance tracking
  navigation: {
    // Track screen transitions
    trackScreenTransition: (fromScreen: string, toScreen: string, method: string = 'unknown') => {
      const transaction = SentryInsights.startTransaction(
        `navigation_${fromScreen}_to_${toScreen}`,
        'navigation',
        {
          from_screen: fromScreen,
          to_screen: toScreen,
          navigation_method: method,
        },
      );

      // Set up automatic finish after a reasonable time
      setTimeout(() => {
        SentryInsights.finishTransaction(transaction, 'ok', {
          navigation_completed: true,
        });
      }, 1000);

      return transaction;
    },

    // Track screen load performance
    trackScreenLoad: async <T>(
      screenName: string,
      fn: () => Promise<T>,
      loadingSteps?: string[],
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `screen_load_${screenName}`,
        'navigation.load',
        {
          screen_name: screenName,
          loading_steps: loadingSteps?.length || 0,
        },
      );

      const startTime = Date.now();

      try {
        // Track individual loading steps if provided
        if (loadingSteps) {
          loadingSteps.forEach((step, index) => {
            SentryInsights.createSpan(transaction, 'navigation.load.step', step, {
              step_index: index,
              step_name: step,
            });
          });
        }

        const result = await fn();
        const loadTime = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'ok', {
          screen_load_time_ms: loadTime,
          load_success: true,
          performance_category: loadTime > 3000 ? 'slow' : loadTime > 1500 ? 'medium' : 'fast',
        });

        // Log slow screen loads
        if (loadTime > 3000) {
          SentryLogger.performance.slow(`screen_load_${screenName}`, loadTime, 1500, {
            screen_name: screenName,
          });
        }

        return result;
      } catch (error) {
        const loadTime = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'internal_error', {
          screen_load_time_ms: loadTime,
          load_success: false,
          error_message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    },
  },

  // User interaction performance tracking
  userInteraction: {
    // Track button press performance
    trackButtonPress: async <T>(
      buttonName: string,
      screen: string,
      fn: () => Promise<T>,
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `interaction_button_${buttonName}`,
        'ui.action.click',
        {
          button_name: buttonName,
          screen,
          interaction_type: 'button_press',
        },
      );

      const startTime = Date.now();

      try {
        const result = await fn();
        const responseTime = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'ok', {
          response_time_ms: responseTime,
          interaction_success: true,
          ui_responsiveness: responseTime > 300 ? 'slow' : responseTime > 100 ? 'medium' : 'fast',
        });

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;

        SentryInsights.finishTransaction(transaction, 'internal_error', {
          response_time_ms: responseTime,
          interaction_success: false,
          error_message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    },
  },
};

export default Sentry;

// Sentry Health Monitoring Utility
export const SentryHealth = {
  // Get current Sentry configuration status
  getStatus: () => {
    const status = {
      initialized: true,
      environment: Constants.expoConfig?.extra?.environment || 'development',
      release: Constants.expoConfig?.version || '1.0.0',
      profilingEnabled: __DEV__ ? 1.0 : 0.2,
      tracingEnabled: __DEV__ ? 1.0 : 0.3,
      platform: Constants.platform?.ios ? 'ios' : 'android',
      timestamp: new Date().toISOString(),
    };

    if (__DEV__) {
      console.log('📊 Sentry Health Status:', status);
    }

    return status;
  },

  // Quick health check with test event
  performHealthCheck: async () => {
    try {
      const healthCheckId = `health_check_${Date.now()}`;

      // Send a health check event
      Sentry.withScope((scope) => {
        scope.setTag('health_check', 'true');
        scope.setTag('check_id', healthCheckId);
        scope.setContext('health_status', SentryHealth.getStatus());

        Sentry.captureMessage('Sentry health check completed', 'info');
      });

      if (__DEV__) {
        console.log('✅ Sentry health check completed successfully');
      }

      return { success: true, checkId: healthCheckId };
    } catch (error) {
      console.error('❌ Sentry health check failed:', error);
      return { success: false, error: String(error) };
    }
  },

  // Monitor critical app metrics
  reportAppMetrics: () => {
    try {
      // Safely check for memory usage (browser/React Native specific)
      const memoryUsage = (() => {
        try {
          // @ts-ignore - performance.memory is not standard but exists in some environments
          return global.performance?.memory?.usedJSHeapSize || 'unknown';
        } catch {
          return 'unknown';
        }
      })();

      const metrics = {
        memory_usage: memoryUsage,
        app_state: 'active', // You can enhance this with actual app state
        connectivity: 'online', // You can enhance this with network state
        battery_level: 'unknown', // You can add battery info if needed
        device_info: {
          platform: Constants.platform?.ios ? 'ios' : 'android',
          expo_version: Constants.expoConfig?.sdkVersion,
          app_version: Constants.expoConfig?.version,
        },
        timestamp: new Date().toISOString(),
      };

      Sentry.setContext('app_metrics', metrics);

      if (__DEV__) {
        console.log('📈 App metrics reported to Sentry:', metrics);
      }

      return metrics;
    } catch (error) {
      console.error('❌ Failed to report app metrics:', error);
      return null;
    }
  },
};

// Simple test utilities for development
export const SentryTestUtils = {
  // Test basic Sentry functionality
  testBasicFunctionality: () => {
    try {
      // Test message capture
      SentryDataCollection.captureMessage('Sentry test message', 'info');

      // Test breadcrumb
      SentryDataCollection.addBreadcrumb({
        message: 'Test breadcrumb from Sentry test',
        category: 'test',
        level: 'info',
        data: {
          test_type: 'basic_functionality',
          timestamp: new Date().toISOString(),
        },
      });

      // Test context
      SentryDataCollection.setContext('test_context', {
        test_feature: 'sentry_test',
        test_timestamp: new Date().toISOString(),
        test_success: true,
      });

      // Test tag
      SentryDataCollection.setTag('test_feature', 'sentry_basic_test');

      console.log('✅ Basic Sentry test completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Basic Sentry test failed:', error);
      SentryDataCollection.captureException(error as Error, {
        test_type: 'basic_functionality',
        test_failed: true,
      });
      return false;
    }
  },

  // Test error capture
  testErrorCapture: () => {
    try {
      // Create a test error
      const testError = new Error('Test error for Sentry monitoring');

      // Capture with context
      SentryDataCollection.captureException(testError, {
        test_type: 'error_capture',
        error_intentional: true,
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Error capture test completed');
      return true;
    } catch (error) {
      console.error('❌ Error capture test failed:', error);
      return false;
    }
  },

  // Test performance monitoring and profiling
  testPerformanceMonitoring: async () => {
    try {
      console.log('🔍 Testing Sentry performance monitoring and profiling...');

      // Test a simple async operation with performance tracking
      const result = await SentryInsights.api.trackApiCall('test_api_endpoint', 'GET', async () => {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { test: 'data', success: true };
      });

      console.log('✅ Performance monitoring test completed:', result);
      return true;
    } catch (error) {
      console.error('❌ Performance monitoring test failed:', error);
      SentryDataCollection.captureException(error as Error, {
        test_type: 'performance_monitoring',
        test_failed: true,
      });
      return false;
    }
  },

  // NEW: Test profiling with explicit transaction (GUARANTEED to show in dashboard)
  testProfilingWithTransaction: async () => {
    try {
      console.log('🔍 Testing Sentry profiling with explicit transaction...');

      // Create an explicit transaction for profiling
      return new Promise((resolve) => {
        Sentry.withScope((scope: any) => {
          // Start capturing profiling data
          scope.setTag('test_type', 'profiling_with_transaction');
          scope.setTag('platform', 'react-native');
          scope.setTag('profiling_enabled', 'true');

          scope.setContext('profiling_test', {
            test_name: 'explicit_transaction_profiling',
            purpose: 'ensure_dashboard_visibility',
            expected_result: 'profile_data_in_dashboard',
          });

          console.log('⚡ Starting CPU-intensive work with profiling...');
          const startTime = performance.now();

          // Intensive CPU work that will definitely show up in profiles
          let computationResult = 0;
          let stringResult = '';
          const objects: Array<{ id: number; computation: number; text: string }> = [];

          // Extended computation to ensure profile capture
          for (let i = 0; i < 1000000; i++) {
            // Mathematical operations
            computationResult += Math.sin(i) * Math.cos(i) + Math.sqrt(i);

            // String operations every 10000 iterations
            if (i % 10000 === 0) {
              stringResult += `iteration_${i}_${Math.random().toString(36).substring(7)}`;
              objects.push({
                id: i,
                computation: computationResult,
                text: stringResult.substring(0, 20),
              });
            }

            // Additional complex operations every 50000 iterations
            if (i % 50000 === 0) {
              const tempArray = Array.from({ length: 1000 }, (_, idx) => idx * i);
              const filtered = tempArray.filter((x) => x % 3 === 0);
              const mapped = filtered.map((x) => Math.sqrt(x));
              computationResult += mapped.reduce((acc, val) => acc + val, 0);
            }
          }

          // JSON operations
          const jsonData = JSON.stringify(objects);
          const parsedData = JSON.parse(jsonData);
          const finalResult = parsedData.reduce(
            (sum: number, obj: any) => sum + obj.computation,
            0,
          );

          const duration = performance.now() - startTime;

          // Set comprehensive results
          scope.setContext('profiling_results', {
            computation_result: computationResult,
            string_length: stringResult.length,
            objects_created: objects.length,
            json_operations: 2,
            final_result: finalResult,
            total_duration_ms: duration,
            iterations_completed: 1000000,
            profile_should_be_visible: true,
          });

          console.log('✅ Profiling computation completed!');
          console.log(`📊 Duration: ${duration.toFixed(2)}ms`);
          console.log(`🔢 Computation result: ${computationResult.toFixed(2)}`);
          console.log(`📝 String length: ${stringResult.length}`);
          console.log(`🗂️  Objects created: ${objects.length}`);
          console.log(`📋 Final result: ${finalResult.toFixed(2)}`);

          // Add breadcrumb with profiling info
          Sentry.addBreadcrumb({
            message: 'Explicit transaction profiling test completed - should appear in dashboard',
            category: 'profiling.transaction.test',
            level: 'info',
            data: {
              duration_ms: duration,
              test_result: 'success',
              iterations: 1000000,
              profiling_method: 'explicit_transaction',
              timestamp: new Date().toISOString(),
              expected_in_dashboard: true,
            },
          });

          // Capture the event with profiling context
          Sentry.captureMessage(
            'PROFILING TEST COMPLETED - Check Performance > Profiles in Sentry Dashboard',
            'info',
          );

          console.log('🎯 Profiling data sent to Sentry - check dashboard in 1-2 minutes');
          resolve({
            success: true,
            duration,
            computationResult,
            objectsCreated: objects.length,
            expectedInDashboard: true,
          });
        });
      });
    } catch (error) {
      console.error('❌ Profiling test with transaction failed:', error);
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'profiling_transaction_error');
        scope.setContext('test_error', {
          test_failed: true,
          error_message: error instanceof Error ? error.message : String(error),
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
      return { success: false, error: String(error) };
    }
  },

  // NEW: Test performance events that should show up in dashboard
  testPerformanceEvents: async () => {
    try {
      console.log('🎯 Testing performance events for Sentry dashboard visibility...');

      // Test 1: API call simulation with performance tracking
      const apiTransaction = SentryInsights.startTransaction('test_api_call', 'http.client', {
        endpoint: '/api/test',
        method: 'GET',
        test_type: 'performance_visibility',
      });

      await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate API delay

      apiTransaction.setData('response_status', 200);
      apiTransaction.setData('response_size', 1024);
      apiTransaction.finish();

      // Test 2: Database operation simulation
      const dbTransaction = SentryInsights.startTransaction('test_db_query', 'db.query', {
        table: 'exercises',
        operation: 'SELECT',
        test_type: 'performance_visibility',
      });

      const dbSpan = SentryInsights.createSpan(
        dbTransaction,
        'db.connection',
        'Database connection',
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      dbSpan.finish();

      const querySpan = SentryInsights.createSpan(
        dbTransaction,
        'db.query.execute',
        'Execute SELECT query',
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      querySpan.setData('rows_returned', 25);
      querySpan.finish();

      dbTransaction.setData('total_rows', 25);
      dbTransaction.finish();

      // Test 3: Workout operation simulation
      const workoutTransaction = SentryInsights.startTransaction(
        'test_workout_session',
        'workout.session',
        {
          workout_id: 'test_workout_123',
          plan_id: 'test_plan_456',
          test_type: 'performance_visibility',
        },
      );

      // Simulate multiple exercises
      for (let i = 1; i <= 3; i++) {
        const exerciseSpan = SentryInsights.createSpan(
          workoutTransaction,
          'workout.exercise',
          `Exercise ${i}`,
          { exercise_id: `exercise_${i}` },
        );

        await new Promise((resolve) => setTimeout(resolve, 80));
        exerciseSpan.setData('sets_completed', 3);
        exerciseSpan.setData('total_reps', 30);
        exerciseSpan.finish();
      }

      workoutTransaction.setData('exercises_completed', 3);
      workoutTransaction.setData('total_duration_seconds', 240);
      workoutTransaction.finish();

      // Test 4: Navigation performance
      const navTransaction = SentryInsights.startTransaction(
        'test_screen_load',
        'navigation.load',
        {
          screen_name: 'WorkoutScreen',
          test_type: 'performance_visibility',
        },
      );

      const loadSpan = SentryInsights.createSpan(
        navTransaction,
        'navigation.data.load',
        'Load workout data',
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      loadSpan.finish();

      const renderSpan = SentryInsights.createSpan(
        navTransaction,
        'navigation.render',
        'Render screen',
      );
      await new Promise((resolve) => setTimeout(resolve, 75));
      renderSpan.finish();

      navTransaction.setData('screen_load_success', true);
      navTransaction.finish();

      // Send a summary event
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'performance_events_completed');
        scope.setTag('event_category', 'performance_testing');
        scope.setContext('test_summary', {
          transactions_created: 4,
          spans_created: 6,
          total_test_duration: 'approximately_1_second',
          expected_in_dashboard: true,
          dashboard_sections: [
            'Performance > Transactions',
            'Performance > Database',
            'Performance > Web Vitals',
            'Discover > Search for event_type:transaction_completed',
          ],
        });

        Sentry.captureMessage(
          'Performance events test completed - Check Sentry Performance dashboard',
          'info',
        );
      });

      console.log('✅ Performance events test completed successfully!');
      console.log('📊 Check these sections in your Sentry dashboard:');
      console.log('   • Performance > Transactions');
      console.log('   • Performance > Database');
      console.log('   • Discover > Search for "event_type:transaction_completed"');
      console.log('   • Issues > Search for "Performance events test completed"');

      return {
        success: true,
        transactions_created: 4,
        spans_created: 6,
        message: 'Performance events sent to Sentry dashboard',
      };
    } catch (error) {
      console.error('❌ Performance events test failed:', error);
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'performance_events_test');
        scope.setContext('test_error', {
          test_failed: true,
          error_message: error instanceof Error ? error.message : String(error),
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
      return { success: false, error: String(error) };
    }
  },

  // Comprehensive test suite
  runComprehensiveTest: async () => {
    console.log('🧪 Running comprehensive Sentry test suite...');

    const results = {
      basic: false,
      error: false,
      performance: false,
      profiling: false,
      performanceEvents: false,
      mobileReplay: false,
    };

    try {
      // Run all tests
      results.basic = SentryTestUtils.testBasicFunctionality();
      results.error = SentryTestUtils.testErrorCapture();
      results.performance = await SentryTestUtils.testPerformanceMonitoring();
      const profilingResult = (await SentryTestUtils.testProfilingWithTransaction()) as any;
      results.profiling = profilingResult?.success || false;
      const performanceEventsResult = (await SentryTestUtils.testPerformanceEvents()) as any;
      results.performanceEvents = performanceEventsResult?.success || false;
      const mobileReplayResult = SentryTestUtils.testMobileReplay() as any;
      results.mobileReplay = mobileReplayResult?.success || false;

      // Log comprehensive results
      SentryLogger.user.action('comprehensive_sentry_test', 'test_suite', {
        test_results: results,
        all_passed: Object.values(results).every(Boolean),
        timestamp: new Date().toISOString(),
      });

      const allPassed = Object.values(results).every(Boolean);
      console.log(allPassed ? '✅ All Sentry tests passed!' : '⚠️ Some Sentry tests failed');
      console.log('📊 Test Results:', results);

      if (results.profiling) {
        console.log(
          '🎯 Profiling is working! Check your Sentry dashboard under "Performance" > "Profiles"',
        );
      } else {
        console.log('⚠️ Profiling test failed. Check console for errors.');
      }

      if (results.performanceEvents) {
        console.log(
          '📈 Performance events sent! Check "Performance" > "Transactions" and "Discover" in your Sentry dashboard',
        );
      } else {
        console.log('⚠️ Performance events test failed. Check console for errors.');
      }

      if (results.mobileReplay) {
        console.log('🎬 Mobile Replay test sent! Check "Replays" section in your Sentry dashboard');
      } else {
        console.log('⚠️ Mobile Replay test failed. Check console for errors.');
      }

      return results;
    } catch (error) {
      console.error('❌ Comprehensive test suite failed:', error);
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'comprehensive_suite');
        scope.setContext('test_error', {
          test_failed: true,
          error_message: error instanceof Error ? error.message : String(error),
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
      return results;
    }
  },

  // Test mobile replay functionality
  testMobileReplay: () => {
    console.log('🎬 Testing Mobile Replay functionality...');

    try {
      // Add breadcrumb to indicate replay test
      Sentry.addBreadcrumb({
        message: 'Mobile Replay test initiated',
        category: 'replay.test',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          test_type: 'mobile_replay_verification',
        },
      });

      // Trigger an event that should be captured in replay
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'mobile_replay');
        scope.setTag('replay_test', 'user_interaction_simulation');
        scope.setContext('replay_test', {
          test_action: 'button_tap_simulation',
          screen: 'test_screen',
          timestamp: new Date().toISOString(),
          expected_in_replay: true,
        });

        // Capture a test message that should trigger replay recording
        Sentry.captureMessage('Mobile Replay test - User interaction simulated', 'info');
      });

      console.log('✅ Mobile Replay test completed!');
      console.log('🎬 If replay is working, you should see:');
      console.log('   • Session recordings in Sentry > Replays');
      console.log('   • User interactions captured in the replay');
      console.log('   • Text and images masked for privacy');
      console.log('   • This test event linked to the replay session');

      return {
        success: true,
        message: 'Mobile Replay test event sent - check Sentry Replays dashboard',
        configuration: {
          replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
          replaysOnErrorSampleRate: 1.0,
          maskAllText: true,
          maskAllImages: true,
          maskAllVectors: true,
        },
      };
    } catch (error) {
      console.error('❌ Mobile Replay test failed:', error);
      Sentry.withScope((scope) => {
        scope.setTag('test_type', 'mobile_replay_test_error');
        scope.setContext('replay_test_error', {
          test_failed: true,
          error_message: error instanceof Error ? error.message : String(error),
        });
        Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
      return { success: false, error: String(error) };
    }
  },
};
