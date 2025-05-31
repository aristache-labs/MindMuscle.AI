import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Comprehensive Sentry iOS Debugging Integration for MindMuscle.AI
 *
 * This service provides complete iOS debugging capabilities including:
 * - Session Replay: Visual reproduction of user sessions
 * - Performance Profiling: CPU and memory profiling
 * - Error Tracking: Comprehensive error monitoring with stack traces
 * - Native Crash Reporting: iOS native crash detection
 * - Performance Monitoring: Transaction and span tracking
 * - User Context: Enhanced user and device context
 */

// Type definitions
interface SentryContext {
  [key: string]: string | number | boolean | object | null | undefined;
}

/**
 * Configure Sentry integrations for iOS debugging
 */
function configureSentryIntegrations(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integrations: any[] = [
    Sentry.reactNavigationIntegration({
      enableTimeToInitialDisplay: true,
    }),
  ];

  if (!isDevelopment && !isExpoGo && isIOS) {
    integrations.push(
      Sentry.hermesProfilingIntegration({
        platformProfilers: true,
      }),
      Sentry.mobileReplayIntegration({
        maskAllText: false,
        maskAllImages: false,
        maskAllVectors: false,
      }),
    );
  }

  return integrations;
}

/**
 * Create Sentry configuration object
 */
// eslint-disable-next-line complexity
function createSentryConfig(
  sentryDsn: string,
  isDevelopment: boolean,
  isExpoGo: boolean,
  isIOS: boolean,
) {
  return {
    dsn: sentryDsn,
    environment: Constants.expoConfig?.extra?.environment || 'development',
    release: Constants.expoConfig?.version || '1.0.0',
    dist: Constants.expoConfig?.extra?.buildNumber || '1',
    debug: isDevelopment,
    autoInitializeNativeSdk: !isDevelopment && !isExpoGo,
    enableNativeCrashHandling: !isDevelopment && !isExpoGo,
    enableAutoPerformanceTracing: true,
    autoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    sendDefaultPii: true,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    tracesSampleRate: isDevelopment ? 1.0 : 0.2,
    profilesSampleRate: isDevelopment ? 1.0 : 0.1,
    replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: configureSentryIntegrations(isDevelopment, isExpoGo, isIOS),
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/[^/]*\.supabase\.co/,
      /^https:\/\/api\.openai\.com/,
      /^https:\/\/[^/]*\.firebase\.com/,
      /^https:\/\/[^/]*\.googleapis\.com/,
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeSend(event: any, _hint: any) {
      if (isIOS && event.contexts) {
        event.contexts.ios_debug = {
          device_model: Constants.platform?.ios ? 'iOS Device' : 'Unknown',
          expo_version: Constants.expoConfig?.sdkVersion,
          hermes_enabled: true,
          new_architecture: Constants.expoConfig?.newArchEnabled,
        };
      }
      if (event.exception) {
        event.tags = {
          ...event.tags,
          debug_session: isDevelopment ? 'active' : 'production',
          platform_specific: isIOS ? 'ios' : 'android',
        };
      }
      return event;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeBreadcrumb(breadcrumb: any, _hint: any) {
      breadcrumb.data = {
        ...breadcrumb.data,
        ios_timestamp: Date.now(),
        platform: isIOS ? 'ios' : 'android',
      };
      return breadcrumb;
    },
    initialScope: {
      tags: {
        platform: isIOS ? 'ios' : 'android',
        expo_version: Constants.expoConfig?.sdkVersion || 'unknown',
        hermes_engine: 'enabled',
        new_architecture: Constants.expoConfig?.newArchEnabled ? 'enabled' : 'disabled',
        debug_mode: isDevelopment ? 'enabled' : 'disabled',
      },
      contexts: {
        device: {
          family: isIOS ? 'iOS' : 'Android',
          model: isIOS ? 'iOS Device' : 'Android Device',
          year_class: Constants.deviceYearClass,
          is_device: Constants.isDevice,
        },
        app: {
          app_version: Constants.expoConfig?.version,
          app_build: Constants.expoConfig?.extra?.buildNumber || '1',
          sdk_version: Constants.expoConfig?.sdkVersion,
          js_engine: 'hermes',
        },
        debugging: {
          session_replay_enabled: true,
          profiling_enabled: true,
          performance_monitoring: true,
          native_crash_reporting: !isDevelopment && !isExpoGo,
        },
      },
    },
  };
}

/**
 * Configure initial Sentry scope and context
 */
function configureSentryScope(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  // Set initial user context for debugging
  Sentry.setUser({
    ip_address: '{{auto}}',
    ...(isDevelopment && {
      id: 'dev-user',
      username: 'developer',
      email: 'dev@mindmuscle.ai',
    }),
  });

  // Add initial debugging context
  Sentry.setContext('ios_debugging', {
    session_replay: {
      enabled: true,
      sample_rate: isDevelopment ? 1.0 : 0.1,
      on_error_rate: 1.0,
    },
    profiling: {
      enabled: true,
      sample_rate: isDevelopment ? 1.0 : 0.1,
      hermes_profiling: !isDevelopment && !isExpoGo && isIOS,
    },
    performance: {
      tracing_enabled: true,
      sample_rate: isDevelopment ? 1.0 : 0.2,
      auto_instrumentation: true,
    },
    native_debugging: {
      crash_reporting: !isDevelopment && !isExpoGo,
      native_sdk: !isDevelopment && !isExpoGo,
      platform_profilers: !isDevelopment && !isExpoGo && isIOS,
    },
  });

  // Initial breadcrumb for debugging session
  Sentry.addBreadcrumb({
    message: 'iOS debugging session initialized',
    category: 'debug.session',
    level: 'info',
    data: {
      platform: isIOS ? 'ios' : 'android',
      session_replay: true,
      profiling: true,
      performance_monitoring: true,
      native_crash_reporting: !isDevelopment && !isExpoGo,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Log initialization status to console
 */
function logInitializationStatus(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  if (isDevelopment) {
    console.log('🚀 Sentry iOS Debugging initialized successfully');
    console.log('📱 Platform:', isIOS ? 'iOS' : 'Android');
    console.log('🎬 Session Replay: Enabled');
    console.log('⚡ Profiling: Enabled');
    console.log('📊 Performance Monitoring: Enabled');
    console.log(
      '💥 Native Crash Reporting:',
      !isDevelopment && !isExpoGo ? 'Enabled' : 'Disabled (Dev Mode)',
    );
    console.log('🔍 Debug Features Available:');
    console.log('  • Visual session replays');
    console.log('  • CPU and memory profiling');
    console.log('  • Performance transaction tracking');
    console.log('  • Native iOS crash detection');
    console.log('  • Real-time error monitoring');
    console.log('  • User journey breadcrumbs');
  }
}

/**
 * Initialize Sentry with comprehensive iOS debugging features
 */
export function initializeSentry() {
  try {
    const sentryDsn = Constants.expoConfig?.extra?.sentryDsn || '';

    if (!sentryDsn) {
      console.warn('Sentry DSN is not configured');
      return;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    const isDevelopment = __DEV__;
    const isIOS = Boolean(Constants.platform?.ios);

    const config = createSentryConfig(sentryDsn, isDevelopment, isExpoGo, isIOS);
    Sentry.init(config);

    configureSentryScope(isDevelopment, isExpoGo, isIOS);
    logInitializationStatus(isDevelopment, isExpoGo, isIOS);
  } catch (error) {
    console.error('❌ Sentry initialization failed:', error);
    try {
      Sentry.captureException(error);
    } catch {
      // Silent fail if Sentry is completely unavailable
    }
  }
}

/**
 * iOS Debugging Utilities
 */
export const SentryDebug = {
  // Capture iOS-specific errors with enhanced context
  captureIOSError: (error: Error, context?: SentryContext) => {
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'ios_specific');
      scope.setTag('platform', 'ios');

      if (context) {
        scope.setContext('ios_error_context', context);
      }

      scope.setContext('ios_debug_info', {
        device_model: Constants.platform?.ios ? 'iOS Device' : 'Unknown',
        memory_warnings: 0, // Can be enhanced with actual memory info
        app_state: 'active', // Can be enhanced with actual app state
        network_status: 'online', // Can be enhanced with actual network status
      });

      Sentry.captureException(error);
    });
  },

  // Track iOS performance issues
  trackIOSPerformance: (operation: string, duration: number, context?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      message: `iOS Performance: ${operation}`,
      category: 'performance.ios',
      level: duration > 1000 ? 'warning' : 'info',
      data: {
        operation,
        duration_ms: duration,
        performance_category: duration > 2000 ? 'slow' : duration > 1000 ? 'medium' : 'fast',
        platform: 'ios',
        ...context,
      },
    });

    if (duration > 2000) {
      Sentry.captureMessage(`Slow iOS operation detected: ${operation} (${duration}ms)`, 'warning');
    }
  },

  // Track iOS memory warnings
  trackMemoryWarning: (availableMemory?: number, usedMemory?: number) => {
    Sentry.withScope((scope) => {
      scope.setTag('event_type', 'memory_warning');
      scope.setTag('platform', 'ios');

      scope.setContext('memory_info', {
        available_memory_mb: availableMemory,
        used_memory_mb: usedMemory,
        warning_timestamp: new Date().toISOString(),
        device_model: Constants.platform?.ios ? 'iOS Device' : 'Unknown',
      });

      Sentry.captureMessage('iOS Memory Warning Detected', 'warning');
    });
  },

  // Track iOS app lifecycle events
  trackAppLifecycle: (event: 'foreground' | 'background' | 'inactive' | 'terminated') => {
    Sentry.addBreadcrumb({
      message: `iOS App Lifecycle: ${event}`,
      category: 'app.lifecycle.ios',
      level: 'info',
      data: {
        lifecycle_event: event,
        platform: 'ios',
        timestamp: new Date().toISOString(),
      },
    });
  },

  // Track iOS navigation performance
  trackIOSNavigation: (fromScreen: string, toScreen: string, duration?: number) => {
    Sentry.addBreadcrumb({
      message: `iOS Navigation: ${fromScreen} → ${toScreen}`,
      category: 'navigation.ios',
      level: 'info',
      data: {
        from_screen: fromScreen,
        to_screen: toScreen,
        navigation_duration_ms: duration,
        platform: 'ios',
        timestamp: new Date().toISOString(),
      },
    });

    // Set current screen context
    Sentry.setContext('current_screen', {
      screen: toScreen,
      previous_screen: fromScreen,
      platform: 'ios',
      navigation_time: new Date().toISOString(),
    });
  },

  // Start iOS performance span
  startIOSSpan: (name: string, operation: string = 'ios.operation') => {
    const span = Sentry.startSpan(
      {
        name,
        op: operation,
        attributes: {
          platform: 'ios',
          span_type: 'ios_debug',
          ios_device: Constants.platform?.ios ? 'iOS Device' : 'Unknown',
          hermes_engine: true,
          start_time: Date.now(),
        },
      },
      (span) => {
        return {
          span,
          finish: () => {
            // Span automatically finishes when the callback returns
          },
          setData: (key: string, value: string | number | boolean) => {
            span.setAttributes({ [key]: value });
          },
          addTag: (key: string, value: string) => {
            span.setAttributes({ [key]: value });
          },
        };
      },
    );

    return span;
  },
};

/**
 * Performance Monitoring for iOS
 */
export const SentryPerformance = {
  // Measure iOS operation performance
  measureIOSOperation: async <T>(
    name: string,
    operation: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> => {
    const startTime = Date.now();

    return await Sentry.startSpan(
      {
        name,
        op: 'ios.measure',
        attributes: {
          platform: 'ios',
          operation_type: 'measure',
          ...context,
        },
      },
      async (span) => {
        try {
          const result = await operation();
          const duration = Date.now() - startTime;

          span.setAttributes({
            success: true,
            duration_ms: duration,
          });

          SentryDebug.trackIOSPerformance(name, duration, context);

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          span.setAttributes({
            success: false,
            duration_ms: duration,
            error: error instanceof Error ? error.message : String(error),
          });

          SentryDebug.captureIOSError(error instanceof Error ? error : new Error(String(error)), {
            operation: name,
            duration,
            ...context,
          });

          throw error;
        }
      },
    );
  },

  // Track iOS workout session performance
  trackWorkoutSession: async <T>(workoutId: string, operation: () => Promise<T>): Promise<T> => {
    return SentryPerformance.measureIOSOperation(`ios_workout_session_${workoutId}`, operation, {
      workout_id: workoutId,
      session_type: 'workout',
    });
  },

  // Track iOS API call performance
  trackAPICall: async <T>(
    endpoint: string,
    method: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    return SentryPerformance.measureIOSOperation(
      `ios_api_${method.toLowerCase()}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
      operation,
      { endpoint, method, call_type: 'api' },
    );
  },
};

// Export core Sentry functions
export const { captureException, captureMessage, addBreadcrumb, setUser, setContext, setTag } =
  Sentry;

// Export default Sentry instance
export default Sentry;
