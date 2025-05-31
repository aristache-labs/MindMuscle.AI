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

  // Session Replay for Mobile - Available for both development and production
  if (!isExpoGo) {
    integrations.push(
      Sentry.mobileReplayIntegration({
        // Privacy settings - adjust based on your needs
        maskAllText: false, // Set to true for maximum privacy
        maskAllImages: false, // Set to true to redact all images
        maskAllVectors: false, // Set to true to redact vector graphics
      }),
    );

    // Hermes Profiling (iOS only, production builds)
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
    // Release Health Configuration
    enableAutoSessionTracking: true,
    enableOutOfMemoryTracking: true,
    enableWatchdogTerminationTracking: true,
    enableAppHangTracking: true,
    sendDefaultPii: true,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    tracesSampleRate: isDevelopment ? 1.0 : 0.2,
    profilesSampleRate: isDevelopment ? 1.0 : 0.1,
    // Session Replay sampling rates
    replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1, // 10% of sessions in production
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
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
 * Set initial user context for debugging
 */
function setInitialUserContext(isDevelopment: boolean) {
  Sentry.setUser({
    ip_address: '{{auto}}',
    ...(isDevelopment && {
      id: 'dev-user',
      username: 'developer',
      email: 'dev@mindmuscle.ai',
    }),
  });
}

/**
 * Create session replay context configuration
 */
function createSessionReplayContext(isDevelopment: boolean, isExpoGo: boolean) {
  return {
    enabled: !isExpoGo,
    sample_rate: isDevelopment ? 1.0 : 0.1,
    on_error_rate: 1.0,
    frame_rate: 1, // 1 FPS
    privacy: {
      mask_text: false,
      mask_images: false,
      mask_vectors: false,
    },
    features: {
      user_interactions: true,
      network_requests: true,
      app_state_changes: true,
      workout_context: true,
    },
  };
}

/**
 * Create profiling context configuration
 */
function createProfilingContext(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  const profilingEnabled = !isDevelopment && !isExpoGo && isIOS;
  return {
    enabled: profilingEnabled,
    sample_rate: isDevelopment ? 1.0 : 0.1,
    hermes_profiling: profilingEnabled,
    platform_profilers: profilingEnabled,
  };
}

/**
 * Create performance context configuration
 */
function createPerformanceContext(isDevelopment: boolean) {
  return {
    tracing_enabled: true,
    sample_rate: isDevelopment ? 1.0 : 0.2,
    auto_instrumentation: true,
    workout_tracking: true,
    api_tracking: true,
  };
}

/**
 * Create native debugging context configuration
 */
function createNativeDebuggingContext(isDevelopment: boolean, isExpoGo: boolean) {
  return {
    crash_reporting: !isDevelopment && !isExpoGo,
    native_sdk: !isDevelopment && !isExpoGo,
    expo_go_limitations: isExpoGo,
  };
}

/**
 * Add initial debugging breadcrumb
 */
function addInitialDebuggingBreadcrumb(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  Sentry.addBreadcrumb({
    message: 'Mobile debugging session with Session Replay initialized',
    category: 'debug.session_replay',
    level: 'info',
    data: {
      platform: isIOS ? 'ios' : 'android',
      session_replay_enabled: !isExpoGo,
      profiling_enabled: !isDevelopment && !isExpoGo && isIOS,
      performance_monitoring: true,
      native_crash_reporting: !isDevelopment && !isExpoGo,
      expo_go_mode: isExpoGo,
      development_mode: isDevelopment,
      replay_sample_rate: isDevelopment ? 1.0 : 0.1,
      error_replay_rate: 1.0,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Configure initial Sentry scope and context
 */
function configureSentryScope(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  setInitialUserContext(isDevelopment);

  // Add Session Replay and debugging context
  Sentry.setContext('mobile_debugging', {
    session_replay: createSessionReplayContext(isDevelopment, isExpoGo),
    profiling: createProfilingContext(isDevelopment, isExpoGo, isIOS),
    performance: createPerformanceContext(isDevelopment),
    native_debugging: createNativeDebuggingContext(isDevelopment, isExpoGo),
  });

  addInitialDebuggingBreadcrumb(isDevelopment, isExpoGo, isIOS);
}

/**
 * Log initialization status to console
 */
function logInitializationStatus(isDevelopment: boolean, isExpoGo: boolean, isIOS: boolean) {
  if (isDevelopment) {
    console.log('🚀 Sentry Mobile Debugging initialized successfully');
    console.log('📱 Platform:', isIOS ? 'iOS' : 'Android');
    console.log('🎬 Session Replay:', !isExpoGo ? 'Enabled' : 'Disabled (Expo Go)');
    console.log(
      '⚡ Profiling:',
      !isDevelopment && !isExpoGo && isIOS ? 'Enabled' : 'Development Mode',
    );
    console.log('📊 Performance Monitoring: Enabled');
    console.log(
      '💥 Native Crash Reporting:',
      !isDevelopment && !isExpoGo ? 'Enabled' : 'Disabled (Dev Mode)',
    );
    console.log('🔍 Session Replay Features:');
    console.log('  • Visual session recordings (1 FPS)');
    console.log('  • User interaction tracking');
    console.log('  • Network request monitoring');
    console.log('  • App state change detection');
    console.log('  • Workout session context');
    console.log('  • Privacy-focused redaction');
    console.log('📈 Sampling Rates:');
    console.log('  • Session Replay:', isDevelopment ? '100%' : '10%');
    console.log('  • Error Replay: 100%');
    console.log('  • Performance Traces:', isDevelopment ? '100%' : '20%');
  }
}

/**
 * Initialize Sentry with comprehensive iOS debugging features
 */
export function initializeSentry() {
  try {
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

    const config = createSentryConfig(sentryDsn, isDevelopment, isExpoGo, isIOS);

    console.log('🔧 Sentry Config:', {
      environment: config.environment,
      release: config.release,
      debug: config.debug,
      autoInitializeNativeSdk: config.autoInitializeNativeSdk,
      enableNativeCrashHandling: config.enableNativeCrashHandling,
      replaysSessionSampleRate: config.replaysSessionSampleRate,
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    });

    Sentry.init(config);

    // Test Sentry connection immediately
    testSentryConnection(isDevelopment);

    configureSentryScope(isDevelopment, isExpoGo, isIOS);

    // Initialize Release Health monitoring
    SentryReleaseHealth.setReleaseHealthContext();
    SentryReleaseHealth.trackAppLifecycle('launched');

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
 * Test Sentry connection and data flow
 */
function testSentryConnection(isDevelopment: boolean) {
  try {
    // Send a test message to verify connection
    Sentry.captureMessage('🧪 Sentry connection test - MindMuscle.AI initialized', 'info');

    // Add test breadcrumb
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

    // Test Session Replay breadcrumb
    if (Constants.appOwnership !== 'expo') {
      SentryDebug.sessionReplay.addReplayBreadcrumb(
        'Session Replay connection test',
        'connection_test',
        { test_mode: true },
      );
    }

    console.log('✅ Sentry connection test sent successfully');
  } catch (error) {
    console.error('❌ Sentry connection test failed:', error);
  }
}

/**
 * Release Health Monitoring Utilities
 * Based on: https://docs.sentry.io/product/releases/health/
 */
export const SentryReleaseHealth = {
  // Track session status changes
  trackSessionStatus: (
    status: 'healthy' | 'errored' | 'crashed' | 'abnormal',
    context?: Record<string, unknown>,
  ) => {
    Sentry.addBreadcrumb({
      message: `Session status: ${status}`,
      category: 'release_health.session_status',
      level:
        status === 'crashed' || status === 'abnormal'
          ? 'error'
          : status === 'errored'
            ? 'warning'
            : 'info',
      data: {
        session_status: status,
        platform: Constants.platform?.ios ? 'ios' : 'android',
        release: Constants.expoConfig?.version || '1.0.0',
        timestamp: new Date().toISOString(),
        ...context,
      },
    });

    // Set session context for release health
    Sentry.setContext('session_health', {
      status,
      release: Constants.expoConfig?.version || '1.0.0',
      platform: Constants.platform?.ios ? 'ios' : 'android',
      timestamp: new Date().toISOString(),
      ...context,
    });
  },

  // Track user adoption metrics
  trackUserAdoption: (userId: string, isNewUser: boolean = false) => {
    Sentry.setUser({
      id: userId,
      ip_address: '{{auto}}',
    });

    Sentry.addBreadcrumb({
      message: `User adoption: ${isNewUser ? 'new' : 'returning'} user`,
      category: 'release_health.user_adoption',
      level: 'info',
      data: {
        user_id: userId,
        user_type: isNewUser ? 'new' : 'returning',
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        timestamp: new Date().toISOString(),
      },
    });

    Sentry.setContext('user_adoption', {
      user_id: userId,
      user_type: isNewUser ? 'new' : 'returning',
      release: Constants.expoConfig?.version || '1.0.0',
      adoption_timestamp: new Date().toISOString(),
    });
  },

  // Track app lifecycle for release health
  trackAppLifecycle: (
    event: 'foreground' | 'background' | 'inactive' | 'terminated' | 'launched',
    duration?: number,
  ) => {
    Sentry.addBreadcrumb({
      message: `App lifecycle: ${event}`,
      category: 'release_health.app_lifecycle',
      level: event === 'terminated' ? 'warning' : 'info',
      data: {
        lifecycle_event: event,
        duration_ms: duration,
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        timestamp: new Date().toISOString(),
      },
    });

    // Track session duration for background/foreground transitions
    if (event === 'background' && duration) {
      SentryReleaseHealth.trackSessionDuration(duration);
    }
  },

  // Track session duration for release health metrics
  trackSessionDuration: (durationMs: number) => {
    const durationMinutes = Math.round(durationMs / 60000);

    Sentry.addBreadcrumb({
      message: `Session duration: ${durationMinutes} minutes`,
      category: 'release_health.session_duration',
      level: 'info',
      data: {
        duration_ms: durationMs,
        duration_minutes: durationMinutes,
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        timestamp: new Date().toISOString(),
      },
    });

    // Set tags for session duration analysis
    Sentry.setTag(
      'session_duration_category',
      durationMinutes < 1
        ? 'very_short'
        : durationMinutes < 5
          ? 'short'
          : durationMinutes < 15
            ? 'medium'
            : durationMinutes < 60
              ? 'long'
              : 'very_long',
    );
  },

  // Track crashes with release health context
  trackCrash: (error: Error, isFatal: boolean = true, context?: Record<string, unknown>) => {
    Sentry.withScope((scope) => {
      scope.setTag('crash_type', isFatal ? 'fatal' : 'non_fatal');
      scope.setTag('release_health_event', 'crash');
      scope.setLevel(isFatal ? 'fatal' : 'error');

      scope.setContext('crash_details', {
        is_fatal: isFatal,
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        crash_timestamp: new Date().toISOString(),
        ...context,
      });

      // Track session status as crashed
      SentryReleaseHealth.trackSessionStatus('crashed', {
        crash_fatal: isFatal,
        error_message: error.message,
        ...context,
      });

      Sentry.captureException(error);
    });
  },

  // Track handled errors for release health
  trackHandledError: (error: Error, context?: Record<string, unknown>) => {
    Sentry.withScope((scope) => {
      scope.setTag('error_handled', 'true');
      scope.setTag('release_health_event', 'handled_error');
      scope.setLevel('warning');

      scope.setContext('handled_error_details', {
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        error_timestamp: new Date().toISOString(),
        ...context,
      });

      // Track session status as errored (but not crashed)
      SentryReleaseHealth.trackSessionStatus('errored', {
        error_message: error.message,
        error_handled: true,
        ...context,
      });

      Sentry.captureException(error);
    });
  },

  // Track abnormal session termination
  trackAbnormalTermination: (reason: string, context?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({
      message: `Abnormal termination: ${reason}`,
      category: 'release_health.abnormal_termination',
      level: 'error',
      data: {
        termination_reason: reason,
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        timestamp: new Date().toISOString(),
        ...context,
      },
    });

    SentryReleaseHealth.trackSessionStatus('abnormal', {
      termination_reason: reason,
      ...context,
    });

    Sentry.captureMessage(`Abnormal session termination: ${reason}`, 'error');
  },

  // Track release adoption stage
  trackAdoptionStage: (stage: 'adopted' | 'low_adoption' | 'replaced') => {
    Sentry.setTag('adoption_stage', stage);

    Sentry.addBreadcrumb({
      message: `Release adoption stage: ${stage}`,
      category: 'release_health.adoption_stage',
      level: stage === 'replaced' ? 'warning' : 'info',
      data: {
        adoption_stage: stage,
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        timestamp: new Date().toISOString(),
      },
    });
  },

  // Set release health context for the entire session
  setReleaseHealthContext: (userId?: string, environment?: string) => {
    const release = Constants.expoConfig?.version || '1.0.0';
    const platform = Constants.platform?.ios ? 'ios' : 'android';

    Sentry.setContext('release_health', {
      release,
      environment: environment || Constants.expoConfig?.extra?.environment || 'development',
      platform,
      user_id: userId,
      session_start: new Date().toISOString(),
      sdk_version: Constants.expoConfig?.sdkVersion,
      app_build: Constants.expoConfig?.extra?.buildNumber || '1',
      device_model: Constants.platform?.ios ? 'iOS Device' : 'Android Device',
      is_device: Constants.isDevice,
    });

    // Set release health tags
    Sentry.setTag('release_version', release);
    Sentry.setTag('release_platform', platform);
    Sentry.setTag('release_environment', environment || 'development');
  },

  // Track workout session for release health (app-specific)
  trackWorkoutSession: (
    workoutId: string,
    event: 'start' | 'pause' | 'resume' | 'complete' | 'abandon',
    duration?: number,
  ) => {
    Sentry.addBreadcrumb({
      message: `Workout session ${event}: ${workoutId}`,
      category: 'release_health.workout_session',
      level: event === 'abandon' ? 'warning' : 'info',
      data: {
        workout_id: workoutId,
        workout_event: event,
        duration_ms: duration,
        release: Constants.expoConfig?.version || '1.0.0',
        platform: Constants.platform?.ios ? 'ios' : 'android',
        timestamp: new Date().toISOString(),
      },
    });

    // Track session health based on workout completion
    if (event === 'complete') {
      SentryReleaseHealth.trackSessionStatus('healthy', {
        workout_completed: true,
        workout_id: workoutId,
        workout_duration: duration,
      });
    } else if (event === 'abandon') {
      SentryReleaseHealth.trackSessionStatus('errored', {
        workout_abandoned: true,
        workout_id: workoutId,
        workout_duration: duration,
      });
    }
  },
};

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

  // Session Replay utilities
  sessionReplay: {
    // Add custom breadcrumb for session replay context
    addReplayBreadcrumb: (message: string, category: string, data?: Record<string, unknown>) => {
      Sentry.addBreadcrumb({
        message,
        category: `replay.${category}`,
        level: 'info',
        data: {
          ...data,
          replay_context: true,
          platform: Constants.platform?.ios ? 'ios' : 'android',
          timestamp: new Date().toISOString(),
        },
      });
    },

    // Track user interactions for replay context
    trackUserInteraction: (
      action: 'tap' | 'swipe' | 'scroll' | 'input' | 'navigation',
      element: string,
      screen: string,
      additionalData?: Record<string, unknown>,
    ) => {
      Sentry.addBreadcrumb({
        message: `User ${action}: ${element}`,
        category: 'replay.interaction',
        level: 'info',
        data: {
          action,
          element,
          screen,
          platform: Constants.platform?.ios ? 'ios' : 'android',
          timestamp: new Date().toISOString(),
          ...additionalData,
        },
      });
    },

    // Track workout session events for replay
    trackWorkoutEvent: (
      event: 'start' | 'pause' | 'resume' | 'complete' | 'exercise_change',
      workoutId: string,
      exerciseId?: string,
      additionalData?: Record<string, unknown>,
    ) => {
      Sentry.addBreadcrumb({
        message: `Workout ${event}: ${workoutId}${exerciseId ? ` - ${exerciseId}` : ''}`,
        category: 'replay.workout',
        level: 'info',
        data: {
          event,
          workout_id: workoutId,
          exercise_id: exerciseId,
          platform: Constants.platform?.ios ? 'ios' : 'android',
          timestamp: new Date().toISOString(),
          ...additionalData,
        },
      });
    },

    // Track app state changes for replay context
    trackAppStateChange: (state: 'active' | 'background' | 'inactive', previousState?: string) => {
      Sentry.addBreadcrumb({
        message: `App state: ${previousState || 'unknown'} → ${state}`,
        category: 'replay.app_state',
        level: 'info',
        data: {
          current_state: state,
          previous_state: previousState,
          platform: Constants.platform?.ios ? 'ios' : 'android',
          timestamp: new Date().toISOString(),
        },
      });
    },

    // Track network requests for replay context
    trackNetworkRequest: (
      method: string,
      url: string,
      status?: number,
      duration?: number,
      error?: string,
    ) => {
      Sentry.addBreadcrumb({
        message: `${method.toUpperCase()} ${url}${status ? ` - ${status}` : ''}`,
        category: 'replay.network',
        level: error ? 'error' : status && status >= 400 ? 'warning' : 'info',
        data: {
          method: method.toUpperCase(),
          url,
          status_code: status,
          duration_ms: duration,
          error_message: error,
          platform: Constants.platform?.ios ? 'ios' : 'android',
          timestamp: new Date().toISOString(),
        },
      });
    },

    // Set replay-specific user context
    setReplayUserContext: (userId: string, email?: string, username?: string) => {
      Sentry.setUser({
        id: userId,
        email,
        username,
        ip_address: '{{auto}}',
      });

      Sentry.setContext('replay_user', {
        user_id: userId,
        email,
        username,
        session_start: new Date().toISOString(),
        platform: Constants.platform?.ios ? 'ios' : 'android',
      });
    },

    // Set workout context for replay
    setWorkoutContext: (
      workoutId: string,
      planId?: string,
      exerciseCount?: number,
      estimatedDuration?: number,
    ) => {
      Sentry.setContext('workout_session', {
        workout_id: workoutId,
        plan_id: planId,
        exercise_count: exerciseCount,
        estimated_duration_minutes: estimatedDuration,
        session_start: new Date().toISOString(),
        platform: Constants.platform?.ios ? 'ios' : 'android',
      });
    },

    // Clear workout context when session ends
    clearWorkoutContext: () => {
      Sentry.setContext('workout_session', null);
    },
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

/**
 * Manual Sentry Testing Utilities
 * Use these functions to manually test Sentry integration
 */
export const SentryTesting = {
  // Test basic message capture
  testMessage: () => {
    console.log('🧪 Testing Sentry message capture...');
    Sentry.captureMessage('Manual test message from MindMuscle.AI', 'info');
    console.log('✅ Test message sent to Sentry');
  },

  // Test error capture
  testError: () => {
    console.log('🧪 Testing Sentry error capture...');
    const testError = new Error('Manual test error from MindMuscle.AI');
    testError.stack = 'Test stack trace for debugging';
    Sentry.captureException(testError);
    console.log('✅ Test error sent to Sentry');
  },

  // Test breadcrumb
  testBreadcrumb: () => {
    console.log('🧪 Testing Sentry breadcrumb...');
    Sentry.addBreadcrumb({
      message: 'Manual test breadcrumb',
      category: 'debug.manual_test',
      level: 'info',
      data: {
        test_type: 'manual_breadcrumb',
        timestamp: new Date().toISOString(),
        platform: Constants.platform?.ios ? 'ios' : 'android',
      },
    });
    console.log('✅ Test breadcrumb added');
  },

  // Test Session Replay
  testSessionReplay: () => {
    console.log('🧪 Testing Session Replay...');
    if (Constants.appOwnership === 'expo') {
      console.log('⚠️ Session Replay is disabled in Expo Go');
      return;
    }

    SentryDebug.sessionReplay.trackUserInteraction('tap', 'manual-test-button', 'debug-screen', {
      test_mode: true,
    });

    SentryDebug.sessionReplay.addReplayBreadcrumb('Manual Session Replay test', 'manual_test', {
      test_timestamp: new Date().toISOString(),
    });

    console.log('✅ Session Replay test data sent');
  },

  // Test workout context
  testWorkoutContext: () => {
    console.log('🧪 Testing workout context...');
    SentryDebug.sessionReplay.setWorkoutContext('test_workout_123', 'test_plan_456', 5, 30);

    SentryDebug.sessionReplay.trackWorkoutEvent('start', 'test_workout_123', 'test_exercise_789', {
      test_mode: true,
    });

    console.log('✅ Workout context test sent');
  },

  // Test Release Health features
  testReleaseHealth: () => {
    console.log('🧪 Testing Release Health features...');

    // Test session status tracking
    SentryReleaseHealth.trackSessionStatus('healthy', { test_mode: true });

    // Test user adoption
    SentryReleaseHealth.trackUserAdoption('test_user_123', true);

    // Test app lifecycle
    SentryReleaseHealth.trackAppLifecycle('foreground', 5000);

    // Test session duration
    SentryReleaseHealth.trackSessionDuration(120000); // 2 minutes

    // Test handled error
    const testError = new Error('Test handled error for release health');
    SentryReleaseHealth.trackHandledError(testError, { test_mode: true });

    // Test workout session
    SentryReleaseHealth.trackWorkoutSession('test_workout_456', 'complete', 1800000); // 30 minutes

    // Test adoption stage
    SentryReleaseHealth.trackAdoptionStage('adopted');

    console.log('✅ Release Health tests completed');
  },

  // Test all Sentry features
  testAll: () => {
    console.log('🧪 Running comprehensive Sentry test...');
    SentryTesting.testMessage();
    SentryTesting.testBreadcrumb();
    SentryTesting.testSessionReplay();
    SentryTesting.testWorkoutContext();
    SentryTesting.testReleaseHealth();
    SentryTesting.testError(); // Test error last
    console.log('✅ All Sentry tests completed - check your Sentry dashboard');
  },

  // Check Sentry configuration
  checkConfig: () => {
    console.log('🔧 Sentry Configuration Check:');
    console.log('DSN:', Constants.expoConfig?.extra?.sentryDsn ? '✅ Configured' : '❌ Missing');
    console.log('Environment:', Constants.expoConfig?.extra?.environment || 'development');
    console.log('Platform:', Constants.platform?.ios ? 'iOS' : 'Android');
    console.log(
      'Expo Go:',
      Constants.appOwnership === 'expo' ? '⚠️ Yes (limited features)' : '✅ No',
    );
    console.log('Development Mode:', __DEV__ ? '✅ Yes' : '❌ No');
    console.log(
      'Session Replay:',
      Constants.appOwnership !== 'expo' ? '✅ Enabled' : '❌ Disabled',
    );
  },
};

// Export core Sentry functions
export const { captureException, captureMessage, addBreadcrumb, setUser, setContext, setTag } =
  Sentry;

// Export default Sentry instance
export default Sentry;
