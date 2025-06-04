import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Core Sentry initialization and configuration
 */

/**
 * Configure Sentry integrations for automatic instrumentation
 */
function configureSentryIntegrations(
  isDevelopment: boolean,
  isExpoGo: boolean,
  isIOS: boolean,
  navigationIntegration?: unknown,
) {
  const integrations: unknown[] = [
    Sentry.reactNativeTracingIntegration({
      shouldCreateSpanForRequest: (url) => {
        return !url.match(/\/health\/?$/) && !url.match(/\/ping\/?$/);
      },
      beforeStartSpan: (context) => {
        return {
          ...context,
          attributes: {
            ...context.attributes,
            platform: isIOS ? 'ios' : 'android',
            app_version: Constants.expoConfig?.version || '1.0.0',
            environment: Constants.expoConfig?.extra?.environment || 'development',
          },
        };
      },
      idleTimeoutMs: 1000,
      finalTimeoutMs: 60000,
    }),
    Sentry.httpClientIntegration(),
  ];

  if (navigationIntegration) {
    integrations.push(navigationIntegration);
  }

  if (!isExpoGo) {
    integrations.push(
      Sentry.mobileReplayIntegration({
        maskAllText: false,
        maskAllImages: false,
        maskAllVectors: false,
      }),
    );

    if (!isDevelopment && isIOS) {
      integrations.push(
        Sentry.hermesProfilingIntegration({
          platformProfilers: true,
        }),
      );
    }
  }

  return integrations;
}

/**
 * Create Expo Router navigation integration
 */
export function createExpoRouterNavigationIntegration(isExpoGo: boolean) {
  return Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isExpoGo,
    routeChangeTimeoutMs: 1000,
    ignoreEmptyBackNavigationTransactions: true,
  });
}

/**
 * Create Sentry configuration object
 */
function createSentryConfig(
  sentryDsn: string,
  isDevelopment: boolean,
  isExpoGo: boolean,
  isIOS: boolean,
  navigationIntegration?: unknown,
) {
  return {
    dsn: sentryDsn,
    environment: Constants.expoConfig?.extra?.environment || 'development',
    release: Constants.expoConfig?.version || '1.0.0',
    dist: Constants.expoConfig?.extra?.buildNumber || '1',
    debug: isDevelopment,
    enableNative: !isExpoGo, // Enable native SDK unless in Expo Go
    autoInitializeNativeSdk: !isExpoGo, // Auto-initialize unless in Expo Go
    enableNativeCrashHandling: !isExpoGo, // Enable native crash handling unless in Expo Go
    enableAutoPerformanceTracing: true,
    enableTracing: true,
    enableAutoInstrumentation: true,
    autoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    enableAutoSessionTracking: true,
    enableOutOfMemoryTracking: true,
    enableWatchdogTerminationTracking: true,
    enableAppHangTracking: true,
    sendDefaultPii: true,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    tracesSampleRate: isDevelopment ? 1.0 : 0.2,
    profilesSampleRate: isDevelopment ? 1.0 : 0.1,
    replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: configureSentryIntegrations(
      isDevelopment,
      isExpoGo,
      isIOS,
      navigationIntegration,
    ) as never,
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/[^/]*\.supabase\.co/,
      /^https:\/\/api\.openai\.com/,
      /^https:\/\/[^/]*\.firebase\.com/,
      /^https:\/\/[^/]*\.googleapis\.com/,
    ],
    beforeSend(event: Sentry.Event, _hint: unknown) {
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
    beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb, _hint: unknown) {
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
 * Initialize Sentry with comprehensive features
 */
export function initializeSentry(navigationIntegration?: unknown) {
  try {
    // Suppress Sentry's promise package warning by ensuring Promise.allSettled is available
    if (!Promise.allSettled) {
      Promise.allSettled = function <T>(
        promises: readonly (T | PromiseLike<T>)[],
      ): Promise<PromiseSettledResult<T>[]> {
        return Promise.all(
          promises.map((promise: T | PromiseLike<T>) =>
            Promise.resolve(promise)
              .then((value): PromiseFulfilledResult<T> => ({ status: 'fulfilled' as const, value }))
              .catch((reason): PromiseRejectedResult => ({ status: 'rejected' as const, reason })),
          ),
        );
      };
    }

    const sentryDsn = Constants.expoConfig?.extra?.sentryDsn || '';

    if (!sentryDsn) {
      console.warn('❌ Sentry DSN is not configured');
      return;
    }

    console.log('🔧 Sentry DSN found:', sentryDsn.substring(0, 50) + '...');

    const isExpoGo = Constants.appOwnership === 'expo';
    const isDevelopment = __DEV__;
    const isIOS = Boolean(Constants.platform?.ios);

    console.log('🔧 Sentry Environment:', {
      isDevelopment,
      isExpoGo,
      isIOS,
      appOwnership: Constants.appOwnership,
      platform: Constants.platform,
    });

    const config = createSentryConfig(
      sentryDsn,
      isDevelopment,
      isExpoGo,
      isIOS,
      navigationIntegration,
    );

    console.log('🔧 Sentry Config:', {
      environment: config.environment,
      release: config.release,
      debug: config.debug,
      enableNative: config.enableNative,
      autoInitializeNativeSdk: config.autoInitializeNativeSdk,
      enableNativeCrashHandling: config.enableNativeCrashHandling,
      replaysSessionSampleRate: config.replaysSessionSampleRate,
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Sentry.init(config as any);

    // Test Sentry connection
    testSentryConnection(isDevelopment);

    // Configure initial scope
    configureSentryScope(isDevelopment, isExpoGo, isIOS);

    console.log('🚀 Sentry initialized successfully');
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
 * Test Sentry connection
 */
function testSentryConnection(isDevelopment: boolean) {
  try {
    Sentry.captureMessage('🧪 Sentry connection test - MindMuscle.AI initialized', 'info');
    Sentry.addBreadcrumb({
      message: 'Sentry connection test breadcrumb',
      category: 'debug.connection_test',
      level: 'info',
      data: {
        test_timestamp: new Date().toISOString(),
        platform: Constants.platform?.ios ? 'ios' : 'android',
        development_mode: isDevelopment,
      },
    });
    console.log('✅ Sentry connection test sent successfully');
  } catch (error) {
    console.error('❌ Sentry connection test failed:', error);
  }
}

/**
 * Configure initial Sentry scope
 */
function configureSentryScope(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  // Set initial user context
  Sentry.setUser({
    ip_address: '{{auto}}',
    ...(isDevelopment && {
      id: 'dev-user',
      username: 'developer',
      email: 'dev@mindmuscle.ai',
    }),
  });

  // Add debugging context
  Sentry.setContext('mobile_debugging', {
    session_replay: {
      enabled: !isExpoGo,
      sample_rate: isDevelopment ? 1.0 : 0.1,
      on_error_rate: 1.0,
    },
    profiling: {
      enabled: !isDevelopment && !isExpoGo && isIOS,
      sample_rate: isDevelopment ? 1.0 : 0.1,
    },
    performance: {
      tracing_enabled: true,
      sample_rate: isDevelopment ? 1.0 : 0.2,
    },
  });

  // Add initial breadcrumb
  Sentry.addBreadcrumb({
    message: 'Mobile debugging session initialized',
    category: 'debug.session',
    level: 'info',
    data: {
      platform: isIOS ? 'ios' : 'android',
      session_replay_enabled: !isExpoGo,
      profiling_enabled: !isDevelopment && !isExpoGo && isIOS,
      development_mode: isDevelopment,
      timestamp: new Date().toISOString(),
    },
  });
}

// Default export to satisfy Expo Router (this file should not be a route)
export default function CoreRouterPlaceholder() {
  return null;
}
