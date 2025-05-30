import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

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

    Sentry.init({
      dsn: sentryDsn,

      // Enhanced Data Collection Configuration
      // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/

      // Adds more context data to events (IP address, cookies, user, etc.)
      // Set to true to send PII data like user info, device names, etc.
      sendDefaultPii: true,

      // Enhanced Tracing Configuration
      // For more information, visit: https://docs.sentry.io/platforms/react-native/tracing/
      tracesSampleRate: __DEV__ ? 1.0 : 0.3, // 100% in dev, 30% in production

      // Enhanced profiling for better insights
      profilesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production

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

      // Enhanced native integration
      enableNativeCrashHandling: true,
      enableNativeNagger: __DEV__, // Show native debugging info in dev
      enableAutoPerformanceTracing: true, // Auto-instrument performance
      enableWatchdogTerminationTracking: true, // Track app terminations

      // Enhanced stack trace and debugging
      attachStacktrace: true,
      sendClientReports: true,

      // Enhanced integrations
      integrations: [
        // Add React Native specific integrations for tracing
        Sentry.reactNavigationIntegration({
          enableTimeToInitialDisplay: true,
        }),
      ],

      // Enhanced beforeSend with more permissive filtering for development
      beforeSend(event, _hint) {
        // In development, send everything for better debugging
        if (__DEV__) {
          console.log('Sentry event being sent:', event);
          return event;
        }

        // In production, still filter sensitive data
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
        environment: Constants.expoConfig?.extra?.environment || 'development',
        release: Constants.expoConfig?.version || '1.0.0',
        maxBreadcrumbs: 150,
        enableAutoPerformanceTracing: true,
      });

      // Send a test message to verify connection
      Sentry.captureMessage('Sentry initialized successfully in development mode', 'info');

      // Add initial breadcrumb
      Sentry.addBreadcrumb({
        message: 'App started with enhanced Sentry configuration',
        category: 'app.lifecycle',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          platform: Constants.platform?.ios ? 'ios' : 'android',
          version: Constants.expoConfig?.version,
        },
      });
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

// Enhanced testing utilities for development
export const SentryTestUtils = {
  // Generate test data to verify Sentry is working
  generateTestData: () => {
    if (!__DEV__) {
      console.warn('Test data generation is only available in development mode');
      return;
    }

    console.log('🧪 Generating Sentry test data...');

    // Test message
    Sentry.captureMessage('Test message from MindMuscle.AI', 'info');

    // Test breadcrumbs
    Sentry.addBreadcrumb({
      message: 'User navigated to test screen',
      category: 'navigation',
      level: 'info',
      data: { screen: 'test', timestamp: new Date().toISOString() },
    });

    Sentry.addBreadcrumb({
      message: 'Test workout started',
      category: 'workout',
      level: 'info',
      data: { workoutId: 'test-workout-123', exerciseCount: 5 },
    });

    // Test context
    Sentry.setContext('test_session', {
      session_id: 'test-session-' + Date.now(),
      test_mode: true,
      generated_at: new Date().toISOString(),
    });

    // Test tags
    Sentry.setTag('test_run', 'true');
    Sentry.setTag('feature_test', 'sentry_integration');

    // Test warning
    Sentry.captureMessage('Test warning message', 'warning');

    // Test error (non-fatal)
    try {
      throw new Error('Test error for Sentry verification - this is intentional');
    } catch (error) {
      Sentry.captureException(error);
    }

    console.log('✅ Test data sent to Sentry. Check your dashboard!');
  },

  // Generate performance test data
  generatePerformanceData: async () => {
    if (!__DEV__) return;

    console.log('⚡ Generating performance test data...');

    // Simulate a slow operation
    await SentryTracing.measureAsync(
      'test_slow_operation',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'completed';
      },
      { category: 'test', tags: { operation_type: 'slow_test' } },
    );

    // Simulate workout tracking
    await SentryTracing.trackWorkoutOperation(
      'test_workout_session',
      'test-workout-456',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { exercises: 3, duration: 1800 };
      },
    );

    console.log('✅ Performance test data sent to Sentry!');
  },

  // Test user interaction tracking
  testUserInteraction: (action: string, screen: string) => {
    if (!__DEV__) return;

    Sentry.addBreadcrumb({
      message: `User ${action} on ${screen}`,
      category: 'user_interaction',
      level: 'info',
      data: {
        action,
        screen,
        timestamp: new Date().toISOString(),
        test_interaction: true,
      },
    });

    SentryTracing.trackNavigation(screen, { test_mode: true, action });
  },
};

export default Sentry;
