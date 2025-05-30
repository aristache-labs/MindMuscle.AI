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

      // Enhanced tracing options for better insights
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.supabase\.co/,
        /^https:\/\/api\.openai\.com/,
        /^https:\/\/[^/]*\.firebase\.com/,
        /^https:\/\/[^/]*\.googleapis\.com/,
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
    tags?: Record<string, string>
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
      const consoleMethod = level === 'error' || level === 'fatal' ? 'error' : 
                           level === 'warning' ? 'warn' : 'log';
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
      SentryLogger.info('Workout session started', {
        workout_id: workoutId,
        plan_id: planId,
        exercise_count: exercises,
        session_type: 'workout',
      }, { feature: 'workout', action: 'start' });
    },

    completed: (workoutId: string, duration: number, exercisesCompleted: number) => {
      SentryLogger.info('Workout session completed', {
        workout_id: workoutId,
        duration_seconds: duration,
        exercises_completed: exercisesCompleted,
        session_type: 'workout',
      }, { feature: 'workout', action: 'complete' });
    },

    paused: (workoutId: string, currentExercise: string) => {
      SentryLogger.info('Workout session paused', {
        workout_id: workoutId,
        current_exercise: currentExercise,
        session_type: 'workout',
      }, { feature: 'workout', action: 'pause' });
    },

    error: (workoutId: string, error: string, context?: Record<string, any>) => {
      SentryLogger.error('Workout session error', {
        workout_id: workoutId,
        error_message: error,
        session_type: 'workout',
        ...context,
      }, { feature: 'workout', action: 'error' });
    },
  },

  // User interaction logging
  user: {
    action: (action: string, screen: string, data?: Record<string, any>) => {
      SentryLogger.info(`User ${action}`, {
        action,
        screen,
        interaction_type: 'user_action',
        ...data,
      }, { feature: 'user_interaction', screen });
    },

    navigation: (from: string, to: string, method?: string) => {
      SentryLogger.info('User navigation', {
        from_screen: from,
        to_screen: to,
        navigation_method: method || 'unknown',
        interaction_type: 'navigation',
      }, { feature: 'navigation', from, to });
    },

    error: (action: string, error: string, context?: Record<string, any>) => {
      SentryLogger.error(`User action failed: ${action}`, {
        failed_action: action,
        error_message: error,
        interaction_type: 'user_error',
        ...context,
      }, { feature: 'user_interaction', action: 'error' });
    },
  },

  // API and database logging
  api: {
    request: (endpoint: string, method: string, data?: Record<string, any>) => {
      SentryLogger.debug('API request initiated', {
        endpoint,
        method,
        request_type: 'api_call',
        ...data,
      }, { feature: 'api', endpoint, method });
    },

    success: (endpoint: string, method: string, duration: number, data?: Record<string, any>) => {
      SentryLogger.info('API request successful', {
        endpoint,
        method,
        duration_ms: duration,
        request_type: 'api_call',
        status: 'success',
        ...data,
      }, { feature: 'api', endpoint, method });
    },

    error: (endpoint: string, method: string, error: string, statusCode?: number) => {
      SentryLogger.error('API request failed', {
        endpoint,
        method,
        error_message: error,
        status_code: statusCode,
        request_type: 'api_call',
        status: 'error',
      }, { feature: 'api', endpoint, method });
    },
  },

  // Database operation logging
  database: {
    query: (table: string, operation: string, data?: Record<string, any>) => {
      SentryLogger.debug('Database query executed', {
        table,
        operation,
        query_type: 'database_operation',
        ...data,
      }, { feature: 'database', table, operation });
    },

    error: (table: string, operation: string, error: string, query?: string) => {
      SentryLogger.error('Database operation failed', {
        table,
        operation,
        error_message: error,
        query: query?.substring(0, 200), // Truncate long queries
        query_type: 'database_operation',
      }, { feature: 'database', table, operation });
    },
  },

  // Performance logging
  performance: {
    mark: (name: string, duration?: number, data?: Record<string, any>) => {
      SentryLogger.info('Performance mark', {
        performance_mark: name,
        duration_ms: duration,
        measurement_type: 'performance',
        ...data,
      }, { feature: 'performance', mark: name });
    },

    slow: (operation: string, duration: number, threshold: number, data?: Record<string, any>) => {
      SentryLogger.warn('Slow operation detected', {
        operation,
        duration_ms: duration,
        threshold_ms: threshold,
        measurement_type: 'performance',
        performance_issue: 'slow_operation',
        ...data,
      }, { feature: 'performance', operation, issue: 'slow' });
    },
  },

  // Test log generation for development
  generateTestLogs: () => {
    if (!__DEV__) return;

    console.log('🧪 Generating test logs...');

    // Test different log levels
    SentryLogger.debug('Debug message for testing', { test_data: 'debug_value' });
    SentryLogger.info('Info message for testing', { test_data: 'info_value' });
    SentryLogger.warn('Warning message for testing', { test_data: 'warning_value' });
    SentryLogger.error('Error message for testing', { test_data: 'error_value' });

    // Test structured logging
    SentryLogger.workout.started('test-workout-789', 'test-plan-123', 5);
    SentryLogger.user.action('button_press', 'profile', { button: 'test_logs' });
    SentryLogger.api.request('/api/test', 'GET', { test: true });
    SentryLogger.performance.mark('test_operation', 150, { test: true });

    console.log('✅ Test logs generated! Check Sentry for structured log data.');
  },
};

// Advanced Performance Monitoring for Sentry Insights
// Provides macro-level metrics to micro-level spans as per Sentry Insights documentation
export const SentryInsights = {
  // Transaction management for comprehensive performance tracking
  startTransaction: (name: string, op: string, data?: Record<string, any>) => {
    // Use withScope for React Native compatibility
    Sentry.withScope((scope) => {
      scope.setTag('transaction_name', name);
      scope.setTag('transaction_op', op);
      scope.setTag('feature', 'performance_insights');
      
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          scope.setContext(key, { value });
        });
      }
    });

    const startTime = Date.now();
    
    if (__DEV__) {
      console.log(`🔄 Started transaction: ${name} (${op})`);
    }

    return {
      name,
      op,
      startTime,
      data: data || {},
      setStatus: (status: string) => {
        Sentry.withScope((scope) => {
          scope.setTag('transaction_status', status);
        });
      },
      setData: (key: string, value: any) => {
        Sentry.withScope((scope) => {
          scope.setContext(key, { value });
        });
      },
      finish: () => {
        const duration = Date.now() - startTime;
        
        Sentry.addBreadcrumb({
          message: `Transaction completed: ${name}`,
          category: 'performance',
          level: 'info',
          data: {
            transaction_name: name,
            transaction_op: op,
            duration_ms: duration,
            ...data,
          },
        });

        if (__DEV__) {
          console.log(`✅ Finished transaction: ${name} (${duration}ms)`);
        }
      },
      startChild: (childData: { op: string; description: string; data?: Record<string, any> }) => {
        return SentryInsights.createSpan(null, childData.op, childData.description, childData.data);
      },
    };
  },

  // Finish transaction with metrics
  finishTransaction: (transaction: any, status?: string, data?: Record<string, any>) => {
    if (transaction) {
      if (status) {
        transaction.setStatus(status);
      }
      
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          transaction.setData(key, value);
        });
      }

      transaction.finish();
    }
  },

  // Create spans for micro-level performance tracking
  createSpan: (transaction: any, operation: string, description: string, data?: Record<string, any>) => {
    const startTime = Date.now();

    if (__DEV__) {
      console.log(`📊 Created span: ${description} (${operation})`);
    }

    return {
      op: operation,
      description,
      startTime,
      data: data || {},
      setStatus: (status: string) => {
        Sentry.withScope((scope) => {
          scope.setTag('span_status', status);
          scope.setTag('span_operation', operation);
        });
      },
      setData: (key: string, value: any) => {
        Sentry.withScope((scope) => {
          scope.setContext(`span_${key}`, { value });
        });
      },
      finish: () => {
        const duration = Date.now() - startTime;
        
        Sentry.addBreadcrumb({
          message: `Span completed: ${description}`,
          category: 'performance',
          level: 'info',
          data: {
            span_operation: operation,
            span_description: description,
            duration_ms: duration,
            ...data,
          },
        });

        if (__DEV__) {
          console.log(`📊 Finished span: ${description} (${duration}ms)`);
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
      fn: () => Promise<T>
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `workout_session_${workoutId}`,
        'workout.session',
        {
          workout_id: workoutId,
          plan_id: planId,
          session_type: 'complete_workout',
        }
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
      fn: () => Promise<T>
    ): Promise<T> => {
      const span = SentryInsights.createSpan(
        transaction,
        'workout.exercise',
        `Exercise: ${exerciseName}`,
        {
          exercise_id: exerciseId,
          exercise_name: exerciseName,
        }
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
        }
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
      options?: { timeout?: number; retries?: number }
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
        }
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
      queryInfo?: { query?: string; params?: any[] }
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `db_${operation}_${table}`,
        'db.query',
        {
          operation,
          table,
          query_type: operation,
          has_params: !!queryInfo?.params?.length,
        }
      );

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
          SentryLogger.performance.slow(
            `db_${operation}_${table}`,
            duration,
            500,
            {
              table,
              operation,
              query: queryInfo?.query?.substring(0, 100),
            }
          );
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
        }
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
      loadingSteps?: string[]
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `screen_load_${screenName}`,
        'navigation.load',
        {
          screen_name: screenName,
          loading_steps: loadingSteps?.length || 0,
        }
      );

      const startTime = Date.now();

      try {
        // Track individual loading steps if provided
        if (loadingSteps) {
          loadingSteps.forEach((step, index) => {
            SentryInsights.createSpan(
              transaction,
              'navigation.load.step',
              step,
              { step_index: index, step_name: step }
            );
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
          SentryLogger.performance.slow(
            `screen_load_${screenName}`,
            loadTime,
            1500,
            { screen_name: screenName }
          );
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
      fn: () => Promise<T>
    ): Promise<T> => {
      const transaction = SentryInsights.startTransaction(
        `interaction_button_${buttonName}`,
        'ui.action.click',
        {
          button_name: buttonName,
          screen,
          interaction_type: 'button_press',
        }
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

  // Generate comprehensive test data for Sentry Insights
  generateInsightsTestData: async () => {
    if (!__DEV__) return;

    console.log('🔬 Generating Sentry Insights test data...');

    // Test workout session tracking
    await SentryInsights.workout.trackWorkoutSession(
      'test-workout-insights-123',
      'test-plan-insights-456',
      async () => {
        // Simulate workout with exercises - create a mock transaction for testing
        const workoutTransaction = SentryInsights.startTransaction(
          'test_workout_exercises',
          'workout.exercises',
          { test_mode: true }
        );
        
        // Test exercise tracking
        await SentryInsights.workout.trackExercisePerformance(
          workoutTransaction,
          'exercise-1',
          'Push-ups',
          async () => {
            await new Promise(resolve => setTimeout(resolve, 800));
            return { sets: 3, reps: 15 };
          }
        );

        // Test rest period
        SentryInsights.workout.trackRestPeriod(workoutTransaction, 60, 'Push-ups');

        await SentryInsights.workout.trackExercisePerformance(
          workoutTransaction,
          'exercise-2',
          'Squats',
          async () => {
            await new Promise(resolve => setTimeout(resolve, 600));
            return { sets: 3, reps: 20 };
          }
        );

        workoutTransaction.finish();
        return { totalExercises: 2, duration: 1400 };
      }
    );

    // Test API call tracking
    await SentryInsights.api.trackApiCall(
      '/api/test/insights',
      'GET',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { data: 'test_insights_response' };
      }
    );

    // Test database operation tracking
    await SentryInsights.api.trackDatabaseOperation(
      'select',
      'test_insights_table',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return [{ id: 1, name: 'test_insights_record' }];
      },
      { query: 'SELECT * FROM test_insights_table WHERE test = true' }
    );

    // Test navigation tracking
    const navTransaction = SentryInsights.navigation.trackScreenTransition(
      'profile',
      'insights_test',
      'button_press'
    );

    // Test screen load tracking
    await SentryInsights.navigation.trackScreenLoad(
      'insights_test_screen',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { loaded: true };
      },
      ['fetch_data', 'render_components', 'setup_listeners']
    );

    // Test user interaction tracking
    await SentryInsights.userInteraction.trackButtonPress(
      'test_insights_button',
      'insights_test_screen',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { action: 'completed' };
      }
    );

    console.log('✅ Sentry Insights test data generated! Check your dashboard for:');
    console.log('  • Transaction traces with spans');
    console.log('  • Performance metrics');
    console.log('  • Cross-referenced issues');
    console.log('  • Custom performance queries');
  },
};

export default Sentry;
