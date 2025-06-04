import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SentryReleaseHealth } from '../services/sentry';
import { useSentryDataCollection } from './useSentryDataCollection';

interface UseReleaseHealthOptions {
  userId?: string;
  environment?: string;
  trackAppLifecycle?: boolean;
  trackSessionDuration?: boolean;
}

/**
 * React Hook for Sentry Release Health monitoring
 * Based on: https://docs.sentry.io/product/releases/health/
 *
 * This hook automatically tracks:
 * - App lifecycle events (foreground/background)
 * - Session duration
 * - User adoption metrics
 * - Session status changes
 */
export function useReleaseHealth(options: UseReleaseHealthOptions = {}) {
  const { userId, environment, trackAppLifecycle = true, trackSessionDuration = true } = options;

  // Initialize self-monitoring
  const {
    setContext,
    addBreadcrumb,
    captureException,
    trackUserAction: _trackUserAction, // eslint-disable-line no-unused-vars
    setTag,
  } = useSentryDataCollection({
    componentName: 'useReleaseHealth',
  });

  const sessionStartTime = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  // Self-monitoring refs
  const hookInitTime = useRef<number>(Date.now());
  const lifecycleEventCount = useRef<number>(0);
  const sessionTrackingCount = useRef<number>(0);
  const errorTrackingCount = useRef<number>(0);

  // Set initial context for self-monitoring
  useEffect(() => {
    setContext('release_health_hook', {
      user_id: userId || 'anonymous',
      environment: environment || 'unknown',
      track_app_lifecycle: trackAppLifecycle,
      track_session_duration: trackSessionDuration,
      hook_init_time: hookInitTime.current,
    });

    setTag('release_health_user', userId || 'anonymous');
    setTag('release_health_env', environment || 'unknown');

    addBreadcrumb({
      message: 'Release health hook initialized',
      category: 'release-health',
      level: 'info',
      data: {
        user_id: userId || 'anonymous',
        environment: environment || 'unknown',
        tracking_options: {
          app_lifecycle: trackAppLifecycle,
          session_duration: trackSessionDuration,
        },
      },
    });
  }, [userId, environment, trackAppLifecycle, trackSessionDuration]);

  // Initialize release health context
  useEffect(() => {
    const initStartTime = Date.now();

    try {
      SentryReleaseHealth.setReleaseHealthContext(userId, environment);

      if (userId) {
        // Determine if this is a new user (you might want to implement your own logic)
        const isNewUser = false; // Replace with your user detection logic
        SentryReleaseHealth.trackUserAdoption(userId, isNewUser);

        addBreadcrumb({
          message: 'User adoption tracked',
          category: 'release-health',
          level: 'info',
          data: {
            user_id: userId,
            is_new_user: isNewUser,
          },
        });
      }

      // Track initial session status as healthy
      SentryReleaseHealth.trackSessionStatus('healthy', {
        session_initialized: true,
        user_id: userId,
      });

      const initDuration = Date.now() - initStartTime;

      addBreadcrumb({
        message: 'Release health context initialized',
        category: 'release-health',
        level: 'info',
        data: {
          init_duration_ms: initDuration,
          user_id: userId || 'anonymous',
        },
      });

      setContext('release_health_performance', {
        init_duration_ms: initDuration,
        successful_init: true,
      });
    } catch (error) {
      const initDuration = Date.now() - initStartTime;

      captureException(error as Error, {
        operation: 'release_health_init',
        user_id: userId,
        environment: environment,
        init_duration_ms: initDuration,
      });
    }
  }, [userId, environment]);

  // Track app lifecycle changes
  useEffect(() => {
    if (!trackAppLifecycle) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentTime = Date.now();
      lifecycleEventCount.current += 1;

      addBreadcrumb({
        message: `App state changed: ${appStateRef.current} -> ${nextAppState}`,
        category: 'app-lifecycle',
        level: 'info',
        data: {
          from_state: appStateRef.current,
          to_state: nextAppState,
          event_count: lifecycleEventCount.current,
        },
      });

      try {
        if (appStateRef.current === 'background' && nextAppState === 'active') {
          // App came to foreground
          const backgroundDuration = backgroundTime.current
            ? currentTime - backgroundTime.current
            : 0;

          SentryReleaseHealth.trackAppLifecycle('foreground', backgroundDuration);

          addBreadcrumb({
            message: 'App returned to foreground',
            category: 'app-lifecycle',
            level: 'info',
            data: {
              background_duration_ms: backgroundDuration,
            },
          });

          // Reset session start time when returning from background
          sessionStartTime.current = currentTime;
          backgroundTime.current = null;
        } else if (appStateRef.current === 'active' && nextAppState === 'background') {
          // App went to background
          const sessionDuration = currentTime - sessionStartTime.current;

          SentryReleaseHealth.trackAppLifecycle('background', sessionDuration);

          if (trackSessionDuration) {
            SentryReleaseHealth.trackSessionDuration(sessionDuration);
            sessionTrackingCount.current += 1;

            addBreadcrumb({
              message: 'Session duration tracked',
              category: 'session-tracking',
              level: 'info',
              data: {
                session_duration_ms: sessionDuration,
                tracking_count: sessionTrackingCount.current,
              },
            });
          }

          backgroundTime.current = currentTime;
        } else if (nextAppState === 'inactive') {
          SentryReleaseHealth.trackAppLifecycle('inactive');
        }

        // Update performance context
        setContext('lifecycle_performance', {
          total_events: lifecycleEventCount.current,
          session_tracking_count: sessionTrackingCount.current,
          last_event_time: currentTime,
        });
      } catch (error) {
        captureException(error as Error, {
          operation: 'app_lifecycle_tracking',
          from_state: appStateRef.current,
          to_state: nextAppState,
          event_count: lifecycleEventCount.current,
        });
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [trackAppLifecycle, trackSessionDuration]);

  // Track session termination on unmount
  useEffect(() => {
    return () => {
      const sessionDuration = Date.now() - sessionStartTime.current;
      const hookLifetime = Date.now() - hookInitTime.current;

      try {
        if (trackSessionDuration) {
          SentryReleaseHealth.trackSessionDuration(sessionDuration);
        }

        // Track normal session termination
        SentryReleaseHealth.trackSessionStatus('healthy', {
          session_ended: true,
          session_duration: sessionDuration,
        });

        addBreadcrumb({
          message: 'Release health hook unmounted',
          category: 'release-health',
          level: 'info',
          data: {
            hook_lifetime_ms: hookLifetime,
            final_session_duration_ms: sessionDuration,
            total_lifecycle_events: lifecycleEventCount.current,
            total_session_tracking: sessionTrackingCount.current,
            total_error_tracking: errorTrackingCount.current,
          },
        });
      } catch (error) {
        captureException(error as Error, {
          operation: 'release_health_cleanup',
          hook_lifetime_ms: hookLifetime,
          session_duration_ms: sessionDuration,
        });
      }
    };
  }, [trackSessionDuration]);

  // Utility functions for manual tracking with self-monitoring
  const trackError = useCallback((error: Error, context?: Record<string, unknown>) => {
    const trackingStartTime = Date.now();
    errorTrackingCount.current += 1;

    try {
      SentryReleaseHealth.trackHandledError(error, context);

      const trackingDuration = Date.now() - trackingStartTime;

      addBreadcrumb({
        message: 'Error tracked via release health',
        category: 'error-tracking',
        level: 'info',
        data: {
          error_message: error.message,
          tracking_duration_ms: trackingDuration,
          error_count: errorTrackingCount.current,
        },
      });
    } catch (trackingError) {
      captureException(trackingError as Error, {
        operation: 'track_error',
        original_error: error.message,
        tracking_duration_ms: Date.now() - trackingStartTime,
      });
    }
  }, []);

  const trackCrash = useCallback(
    (error: Error, isFatal: boolean = true, context?: Record<string, unknown>) => {
      const trackingStartTime = Date.now();
      errorTrackingCount.current += 1;

      try {
        SentryReleaseHealth.trackCrash(error, isFatal, context);

        const trackingDuration = Date.now() - trackingStartTime;

        addBreadcrumb({
          message: 'Crash tracked via release health',
          category: 'crash-tracking',
          level: 'error',
          data: {
            error_message: error.message,
            is_fatal: isFatal,
            tracking_duration_ms: trackingDuration,
            error_count: errorTrackingCount.current,
          },
        });
      } catch (trackingError) {
        captureException(trackingError as Error, {
          operation: 'track_crash',
          original_error: error.message,
          is_fatal: isFatal,
          tracking_duration_ms: Date.now() - trackingStartTime,
        });
      }
    },
    [],
  );

  const trackWorkoutSession = useCallback(
    (
      workoutId: string,
      event: 'start' | 'pause' | 'resume' | 'complete' | 'abandon',
      duration?: number,
    ) => {
      const trackingStartTime = Date.now();

      try {
        SentryReleaseHealth.trackWorkoutSession(workoutId, event, duration);

        const trackingDuration = Date.now() - trackingStartTime;

        addBreadcrumb({
          message: 'Workout session tracked via release health',
          category: 'workout-tracking',
          level: 'info',
          data: {
            workout_id: workoutId,
            event: event,
            duration_ms: duration,
            tracking_duration_ms: trackingDuration,
          },
        });
      } catch (trackingError) {
        captureException(trackingError as Error, {
          operation: 'track_workout_session',
          workout_id: workoutId,
          event: event,
          tracking_duration_ms: Date.now() - trackingStartTime,
        });
      }
    },
    [],
  );

  const trackAbnormalTermination = useCallback(
    (reason: string, context?: Record<string, unknown>) => {
      const trackingStartTime = Date.now();

      try {
        SentryReleaseHealth.trackAbnormalTermination(reason, context);

        const trackingDuration = Date.now() - trackingStartTime;

        addBreadcrumb({
          message: 'Abnormal termination tracked',
          category: 'termination-tracking',
          level: 'warning',
          data: {
            reason: reason,
            tracking_duration_ms: trackingDuration,
          },
        });
      } catch (trackingError) {
        captureException(trackingError as Error, {
          operation: 'track_abnormal_termination',
          reason: reason,
          tracking_duration_ms: Date.now() - trackingStartTime,
        });
      }
    },
    [],
  );

  const setAdoptionStage = useCallback((stage: 'adopted' | 'low_adoption' | 'replaced') => {
    const trackingStartTime = Date.now();

    try {
      SentryReleaseHealth.trackAdoptionStage(stage);

      const trackingDuration = Date.now() - trackingStartTime;

      addBreadcrumb({
        message: 'Adoption stage updated',
        category: 'adoption-tracking',
        level: 'info',
        data: {
          adoption_stage: stage,
          tracking_duration_ms: trackingDuration,
        },
      });
    } catch (trackingError) {
      captureException(trackingError as Error, {
        operation: 'set_adoption_stage',
        stage: stage,
        tracking_duration_ms: Date.now() - trackingStartTime,
      });
    }
  }, []);

  const updateSessionStatus = useCallback(
    (status: 'healthy' | 'errored' | 'crashed' | 'abnormal', context?: Record<string, unknown>) => {
      const trackingStartTime = Date.now();

      try {
        SentryReleaseHealth.trackSessionStatus(status, context);

        const trackingDuration = Date.now() - trackingStartTime;

        addBreadcrumb({
          message: 'Session status updated',
          category: 'session-tracking',
          level: status === 'healthy' ? 'info' : 'warning',
          data: {
            session_status: status,
            tracking_duration_ms: trackingDuration,
          },
        });
      } catch (trackingError) {
        captureException(trackingError as Error, {
          operation: 'update_session_status',
          status: status,
          tracking_duration_ms: Date.now() - trackingStartTime,
        });
      }
    },
    [],
  );

  return {
    // Manual tracking functions
    trackError,
    trackCrash,
    trackWorkoutSession,
    trackAbnormalTermination,
    setAdoptionStage,
    updateSessionStatus,

    // Session info
    getSessionDuration: () => Date.now() - sessionStartTime.current,
    getCurrentAppState: () => appStateRef.current,

    // Self-monitoring info
    getHookMetrics: () => ({
      hookLifetime: Date.now() - hookInitTime.current,
      lifecycleEventCount: lifecycleEventCount.current,
      sessionTrackingCount: sessionTrackingCount.current,
      errorTrackingCount: errorTrackingCount.current,
    }),
  };
}

export default useReleaseHealth;
