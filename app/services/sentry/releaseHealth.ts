import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

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
