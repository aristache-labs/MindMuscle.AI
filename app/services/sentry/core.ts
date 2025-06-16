import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { SENTRY_DEBUG_CONFIG } from '../../utils/debugConfig';

/**
 * Core Sentry initialization and configuration
 */

// Global type declaration for React Native __DEV__ variable
declare const __DEV__: boolean;

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
      idleTimeoutMs: 500,
      finalTimeoutMs: 30000,
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
    routeChangeTimeoutMs: 500,
    ignoreEmptyBackNavigationTransactions: true,
  });
}

/**
 * Create base Sentry configuration
 */
function createBaseSentryConfig(
  sentryDsn: string,
  isDevelopment: boolean,
  isExpoGo: boolean,
  enableDebugLogging: boolean,
) {
  return {
    dsn: sentryDsn,
    environment: Constants.expoConfig?.extra?.environment || 'development',
    release: Constants.expoConfig?.version || '1.0.0',
    dist: Constants.expoConfig?.extra?.buildNumber || '1',
    debug: enableDebugLogging,
    enableNative: !isExpoGo,
    autoInitializeNativeSdk: !isExpoGo,
    enableNativeCrashHandling: !isExpoGo,
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
  };
}

/**
 * Create sampling configuration
 */
function createSamplingSentryConfig(isDevelopment: boolean) {
  return {
    maxBreadcrumbs: 50,
    tracesSampleRate: isDevelopment ? 0.3 : 0.2,
    profilesSampleRate: isDevelopment ? 0.2 : 0.1,
    replaysSessionSampleRate: isDevelopment ? 0.2 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  };
}

/**
 * Create network configuration
 */
function createNetworkSentryConfig() {
  return {
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/[^/]*\.supabase\.co/,
      /^https:\/\/api\.openai\.com/,
      /^https:\/\/[^/]*\.firebase\.com/,
      /^https:\/\/[^/]*\.googleapis\.com/,
    ],
  };
}

/**
 * Create beforeSend handler
 */
function createBeforeSendHandler(isDevelopment: boolean, isIOS: boolean) {
  return (event: Sentry.Event, _hint: unknown) => {
    // Filter out excessive navigation transactions in development
    if (isDevelopment && event.type === 'transaction') {
      // Only send 20% of navigation transactions in development to reduce noise
      if (event.transaction?.includes('Route Change') && Math.random() > 0.2) {
        return null;
      }
    }

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
  };
}

/**
 * Create initial scope configuration
 */
function createInitialScopeConfig(isDevelopment: boolean, isIOS: boolean) {
  return {
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
        native_crash_reporting: !isDevelopment,
      },
    },
  };
}

/**
 * Create complete Sentry configuration
 * To enable verbose Sentry logging for debugging, set SENTRY_DEBUG=true in your environment
 * or update the SENTRY_DEBUG flag in debugConfig.ts
 */
function createSentryConfig(
  sentryDsn: string,
  isDevelopment: boolean,
  isExpoGo: boolean,
  isIOS: boolean,
  navigationIntegration?: unknown,
) {
  // Use proper debug configuration instead of hardcoded value
  const enableDebugLogging = SENTRY_DEBUG_CONFIG.enableDebug || process.env.SENTRY_DEBUG === 'true';

  const baseConfig = createBaseSentryConfig(sentryDsn, isDevelopment, isExpoGo, enableDebugLogging);
  const samplingConfig = createSamplingSentryConfig(isDevelopment);
  const networkConfig = createNetworkSentryConfig();
  const initialScope = createInitialScopeConfig(isDevelopment, isIOS);

  return {
    ...baseConfig,
    ...samplingConfig,
    ...networkConfig,
    integrations: configureSentryIntegrations(
      isDevelopment,
      isExpoGo,
      isIOS,
      navigationIntegration,
    ) as never,
    beforeSend: createBeforeSendHandler(isDevelopment, isIOS),
    initialScope,
  };
}

/**
 * Initialize Sentry with comprehensive features
 */
export function initializeSentry(navigationIntegration?: unknown) {
  // Store original console methods before modification
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalDebug = console.debug;

  try {
    // Suppress Sentry's promise package warning by patching console before initialization

    // Temporarily suppress specific Sentry debug and log messages
    console.warn = (...args: unknown[]) => {
      const message = args.join(' ');
      if (
        message.includes('multiple versions of the "promise" package') ||
        message.includes('Promise.allSettled') ||
        message.includes('Sentry Logger [warn]') ||
        message.includes('Sentry Logger [debug]')
      ) {
        // Suppress Sentry logging messages
        return;
      }
      originalWarn.apply(console, args);
    };

    console.log = (...args: unknown[]) => {
      const message = args.join(' ');
      if (
        message.includes('Sentry Logger [log]') ||
        message.includes('Sentry Logger [debug]') ||
        message.includes('[Profiling]') ||
        message.includes('[Tracing]') ||
        message.includes('[NativeFrames]') ||
        message.includes('[Measurements]') ||
        message.includes('[TimeToDisplay]') ||
        message.includes('[TouchEvents]') ||
        message.includes('[UserInteraction]')
      ) {
        // Suppress Sentry debug and performance logging messages
        return;
      }
      originalLog.apply(console, args);
    };

    console.debug = (...args: unknown[]) => {
      const message = args.join(' ');
      if (
        message.includes('Sentry Logger [debug]') ||
        message.includes('[Profiling]') ||
        message.includes('[Tracing]') ||
        message.includes('[NativeFrames]') ||
        message.includes('[Measurements]') ||
        message.includes('[TimeToDisplay]') ||
        message.includes('[TouchEvents]') ||
        message.includes('[UserInteraction]')
      ) {
        // Suppress Sentry debug messages
        return;
      }
      originalDebug.apply(console, args);
    };

    // Ensure Promise.allSettled is available before Sentry checks
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

    // Mark Promise as properly polyfilled to prevent Sentry warnings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Promise as any).__sentryPolyfilled = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Promise as any).__mindmusclePolyfilled = true;

    const sentryDsn = Constants.expoConfig?.extra?.sentryDsn || '';

    if (!sentryDsn) {
      console.warn('❌ Sentry DSN is not configured');
      return;
    }

    console.log('🔧 Sentry DSN found:', sentryDsn.substring(0, 50) + '...');

    const isExpoGo = Constants.appOwnership === 'expo';
    const isDevelopment = __DEV__;
    const isIOS = Boolean(Constants.platform?.ios);

    console.log(
      '🔧 Sentry Environment:',
      JSON.stringify(
        {
          isDevelopment,
          isExpoGo,
          isIOS,
          appOwnership: Constants.appOwnership,
          platform: Constants.platform,
        },
        null,
        2,
      ),
    );

    const config = createSentryConfig(
      sentryDsn,
      isDevelopment,
      isExpoGo,
      isIOS,
      navigationIntegration,
    );

    // Debug release value to identify formatting issue
    console.log('🔧 Release value debug:', {
      rawRelease: config.release,
      releaseLength: config.release?.length,
      releaseType: typeof config.release,
      releaseCharCodes: config.release?.split('').map((char) => char.charCodeAt(0)),
    });

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

    // Restore original console methods after Sentry initialization
    console.warn = originalWarn;
    console.log = originalLog;
    console.debug = originalDebug;

    // Test Sentry connection
    testSentryConnection(isDevelopment);

    // Configure initial scope
    configureSentryScope(isDevelopment, isExpoGo, isIOS);

    console.log('🚀 Sentry initialized successfully');
  } catch (error) {
    // Restore original console methods in case of error
    try {
      console.warn = originalWarn;
      console.log = originalLog;
      console.debug = originalDebug;
    } catch {
      // If restoration fails, at least log the error
    }

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
