import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * iOS Debugging Utilities
 */
export const SentryDebug = {
  // Capture iOS-specific errors with enhanced context
  captureIOSError: (error: Error, context?: Record<string, unknown>) => {
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

// Default export to satisfy Expo Router (this file should not be a route)
export default function DebugRouterPlaceholder() {
  return null;
}
