import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SentryReleaseHealth } from '../services/sentry';

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

  const sessionStartTime = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  // Initialize release health context
  useEffect(() => {
    SentryReleaseHealth.setReleaseHealthContext(userId, environment);

    if (userId) {
      // Determine if this is a new user (you might want to implement your own logic)
      const isNewUser = false; // Replace with your user detection logic
      SentryReleaseHealth.trackUserAdoption(userId, isNewUser);
    }

    // Track initial session status as healthy
    SentryReleaseHealth.trackSessionStatus('healthy', {
      session_initialized: true,
      user_id: userId,
    });
  }, [userId, environment]);

  // Track app lifecycle changes
  useEffect(() => {
    if (!trackAppLifecycle) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentTime = Date.now();

      if (appStateRef.current === 'background' && nextAppState === 'active') {
        // App came to foreground
        const backgroundDuration = backgroundTime.current
          ? currentTime - backgroundTime.current
          : 0;

        SentryReleaseHealth.trackAppLifecycle('foreground', backgroundDuration);

        // Reset session start time when returning from background
        sessionStartTime.current = currentTime;
        backgroundTime.current = null;
      } else if (appStateRef.current === 'active' && nextAppState === 'background') {
        // App went to background
        const sessionDuration = currentTime - sessionStartTime.current;

        SentryReleaseHealth.trackAppLifecycle('background', sessionDuration);

        if (trackSessionDuration) {
          SentryReleaseHealth.trackSessionDuration(sessionDuration);
        }

        backgroundTime.current = currentTime;
      } else if (nextAppState === 'inactive') {
        SentryReleaseHealth.trackAppLifecycle('inactive');
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

      if (trackSessionDuration) {
        SentryReleaseHealth.trackSessionDuration(sessionDuration);
      }

      // Track normal session termination
      SentryReleaseHealth.trackSessionStatus('healthy', {
        session_ended: true,
        session_duration: sessionDuration,
      });
    };
  }, [trackSessionDuration]);

  // Utility functions for manual tracking
  const trackError = useCallback((error: Error, context?: Record<string, unknown>) => {
    SentryReleaseHealth.trackHandledError(error, context);
  }, []);

  const trackCrash = useCallback(
    (error: Error, isFatal: boolean = true, context?: Record<string, unknown>) => {
      SentryReleaseHealth.trackCrash(error, isFatal, context);
    },
    [],
  );

  const trackWorkoutSession = useCallback(
    (
      workoutId: string,
      event: 'start' | 'pause' | 'resume' | 'complete' | 'abandon',
      duration?: number,
    ) => {
      SentryReleaseHealth.trackWorkoutSession(workoutId, event, duration);
    },
    [],
  );

  const trackAbnormalTermination = useCallback(
    (reason: string, context?: Record<string, unknown>) => {
      SentryReleaseHealth.trackAbnormalTermination(reason, context);
    },
    [],
  );

  const setAdoptionStage = useCallback((stage: 'adopted' | 'low_adoption' | 'replaced') => {
    SentryReleaseHealth.trackAdoptionStage(stage);
  }, []);

  const updateSessionStatus = useCallback(
    (status: 'healthy' | 'errored' | 'crashed' | 'abnormal', context?: Record<string, unknown>) => {
      SentryReleaseHealth.trackSessionStatus(status, context);
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
  };
}

export default useReleaseHealth;
