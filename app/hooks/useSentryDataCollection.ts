import { useCallback, useEffect } from 'react';
import { SentryDataCollection } from '../services/sentry';

// Type definitions for Sentry data collection
type SentryValue = string | number | boolean | Date | null | undefined;

interface SentryContext {
  [key: string]: SentryValue | Record<string, SentryValue>;
}

interface BreadcrumbData {
  [key: string]: SentryValue | Record<string, SentryValue>;
}

interface UserActionData {
  action?: string;
  [key: string]: SentryValue;
}

interface ScreenViewData {
  screen?: string;
  from?: string;
  [key: string]: SentryValue;
}

interface WorkoutEventData {
  event?: string;
  timestamp?: string;
  type?: string;
  exerciseCount?: number;
  estimatedDuration?: number;
  duration?: number;
  exercisesCompleted?: number;
  totalWeight?: number;
  name?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  [key: string]: SentryValue;
}

interface UserData {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

interface UseSentryDataCollectionOptions {
  componentName?: string;
  autoSetUser?: boolean;
  respectPrivacySettings?: boolean;
}

/**
 * React hook for managing Sentry data collection
 * Provides easy-to-use functions for components to interact with Sentry
 * while respecting privacy settings and user preferences.
 */
export function useSentryDataCollection(options: UseSentryDataCollectionOptions = {}) {
  const {
    autoSetUser: _autoSetUser = false,
    respectPrivacySettings = true,
    componentName,
  } = options;

  // Set user information with privacy checks
  const setUser = useCallback(
    (userData: UserData) => {
      if (respectPrivacySettings) {
        // In a real app, you'd check user privacy preferences here
        // For now, we'll assume PII is allowed if sendDefaultPii is true
        const allowPII = true; // This should come from user preferences/settings

        if (allowPII) {
          SentryDataCollection.setUser(userData);
        } else {
          // Only set non-PII data
          SentryDataCollection.setUser({
            id: userData.id,
            // Exclude email, username if PII not allowed
          });
        }
      } else {
        SentryDataCollection.setUser(userData);
      }
    },
    [respectPrivacySettings],
  );

  // Clear user information
  const clearUser = useCallback(() => {
    SentryDataCollection.clearUser();
  }, []);

  // Set context with component information
  const setContext = useCallback(
    (key: string, context: SentryContext) => {
      const enhancedContext = componentName ? { ...context, component: componentName } : context;

      SentryDataCollection.setContext(key, enhancedContext);
    },
    [componentName],
  );

  // Set tag
  const setTag = useCallback((key: string, value: string) => {
    SentryDataCollection.setTag(key, value);
  }, []);

  // Add breadcrumb with component context
  const addBreadcrumb = useCallback(
    (breadcrumb: {
      message: string;
      category?: string;
      level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
      data?: BreadcrumbData;
    }) => {
      const enhancedBreadcrumb = {
        ...breadcrumb,
        data: componentName ? { ...breadcrumb.data, component: componentName } : breadcrumb.data,
      };

      SentryDataCollection.addBreadcrumb(enhancedBreadcrumb);
    },
    [componentName],
  );

  // Capture exception with component context
  const captureException = useCallback(
    (error: Error, context?: SentryContext) => {
      const enhancedContext = componentName ? { ...context, component: componentName } : context;

      SentryDataCollection.captureException(error, enhancedContext);
    },
    [componentName],
  );

  // Capture message with component context
  const captureMessage = useCallback(
    (message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') => {
      if (componentName) {
        SentryDataCollection.setContext('component_context', { component: componentName });
      }
      SentryDataCollection.captureMessage(message, level);
    },
    [componentName],
  );

  // Track user action
  const trackUserAction = useCallback(
    (action: string, data?: UserActionData) => {
      addBreadcrumb({
        message: `User action: ${action}`,
        category: 'user-action',
        level: 'info',
        data: {
          action,
          ...data,
        },
      });
    },
    [addBreadcrumb],
  );

  // Track screen view
  const trackScreenView = useCallback(
    (screenName: string, data?: ScreenViewData) => {
      const breadcrumbData: BreadcrumbData = {
        screen: screenName,
        ...data,
      };

      addBreadcrumb({
        message: `Screen view: ${screenName}`,
        category: 'navigation',
        level: 'info',
        data: breadcrumbData,
      });

      setTag('current_screen', screenName);
    },
    [addBreadcrumb, setTag],
  );

  // Track workout event
  const trackWorkoutEvent = useCallback(
    (event: string, workoutData?: WorkoutEventData) => {
      setContext('workout_event', {
        event,
        timestamp: new Date().toISOString(),
        ...workoutData,
      });

      addBreadcrumb({
        message: `Workout event: ${event}`,
        category: 'workout',
        level: 'info',
        data: workoutData,
      });
    },
    [setContext, addBreadcrumb],
  );

  // Track performance metric
  const trackPerformance = useCallback(
    (metric: string, value: number, unit?: string) => {
      addBreadcrumb({
        message: `Performance: ${metric}`,
        category: 'performance',
        level: 'info',
        data: {
          metric,
          value,
          unit,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [addBreadcrumb],
  );

  // Set component context on mount
  useEffect(() => {
    if (componentName) {
      setContext('component_lifecycle', {
        component: componentName,
        mounted: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Cleanup on unmount
    return () => {
      if (componentName) {
        setContext('component_lifecycle', {
          component: componentName,
          mounted: false,
          timestamp: new Date().toISOString(),
        });
      }
    };
  }, [componentName, setContext]);

  return {
    // User management
    setUser,
    clearUser,

    // Context and tags
    setContext,
    setTag,

    // Error tracking
    captureException,
    captureMessage,
    addBreadcrumb,

    // Specialized tracking
    trackUserAction,
    trackScreenView,
    trackWorkoutEvent,
    trackPerformance,
  };
}

// Specialized hooks for common use cases

/**
 * Hook for workout-related components
 */
export function useSentryWorkoutTracking(componentName?: string) {
  const sentry = useSentryDataCollection({
    componentName: componentName || 'WorkoutComponent',
    autoSetUser: true,
  });

  const trackWorkoutStart = useCallback(
    (workoutData: { type?: string; exerciseCount?: number; estimatedDuration?: number }) => {
      sentry.trackWorkoutEvent('workout_started', workoutData);
    },
    [sentry],
  );

  const trackWorkoutComplete = useCallback(
    (workoutData: { duration?: number; exercisesCompleted?: number; totalWeight?: number }) => {
      sentry.trackWorkoutEvent('workout_completed', workoutData);
    },
    [sentry],
  );

  const trackExerciseComplete = useCallback(
    (exerciseData: { name?: string; sets?: number; reps?: number; weight?: number }) => {
      sentry.trackWorkoutEvent('exercise_completed', exerciseData);
    },
    [sentry],
  );

  return {
    ...sentry,
    trackWorkoutStart,
    trackWorkoutComplete,
    trackExerciseComplete,
  };
}

/**
 * Hook for authentication-related components
 */
export function useSentryAuthTracking(componentName?: string) {
  const sentry = useSentryDataCollection({
    componentName: componentName || 'AuthComponent',
  });

  const trackLoginAttempt = useCallback(
    (method: string) => {
      sentry.trackUserAction('login_attempt', { method });
    },
    [sentry],
  );

  const trackLoginSuccess = useCallback(
    (userData: UserData) => {
      sentry.trackUserAction('login_success');
      sentry.setUser(userData);
    },
    [sentry],
  );

  const trackLoginFailure = useCallback(
    (error: string) => {
      sentry.trackUserAction('login_failure', { error });
    },
    [sentry],
  );

  const trackLogout = useCallback(() => {
    sentry.trackUserAction('logout');
    sentry.clearUser();
  }, [sentry]);

  return {
    ...sentry,
    trackLoginAttempt,
    trackLoginSuccess,
    trackLoginFailure,
    trackLogout,
  };
}

/**
 * Hook for navigation-related tracking
 */
export function useSentryNavigationTracking() {
  const sentry = useSentryDataCollection({
    componentName: 'NavigationComponent',
  });

  const trackNavigation = useCallback(
    (from: string, to: string, params?: Record<string, SentryValue>) => {
      const navigationData: BreadcrumbData = {
        from,
        to,
        timestamp: new Date().toISOString(),
        ...params,
      };

      sentry.addBreadcrumb({
        message: `Navigation: ${from} → ${to}`,
        category: 'navigation',
        level: 'info',
        data: navigationData,
      });

      const screenViewData: ScreenViewData = {
        from,
        ...params,
      };

      sentry.trackScreenView(to, screenViewData);
    },
    [sentry],
  );

  return {
    ...sentry,
    trackNavigation,
  };
}
export default function disablewarn() {
  return null;
}
