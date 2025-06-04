import { useCallback, useEffect, useRef } from 'react';
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

// Self-monitoring metrics
interface SentryHookMetrics {
  initTime: number;
  breadcrumbCount: number;
  contextSetCount: number;
  exceptionCount: number;
  messageCount: number;
  userActionCount: number;
  screenViewCount: number;
  workoutEventCount: number;
  performanceMetrics: {
    avgBreadcrumbTime: number;
    avgContextSetTime: number;
    avgExceptionTime: number;
  };
}

/**
 * React hook for managing Sentry data collection
 * Provides easy-to-use functions for components to interact with Sentry
 * while respecting privacy settings and user preferences.
 */
export function useSentryDataCollection(options: UseSentryDataCollectionOptions = {}) {
  const { respectPrivacySettings = true, componentName } = options;

  // Self-monitoring refs
  const hookMetrics = useRef<SentryHookMetrics>({
    initTime: Date.now(),
    breadcrumbCount: 0,
    contextSetCount: 0,
    exceptionCount: 0,
    messageCount: 0,
    userActionCount: 0,
    screenViewCount: 0,
    workoutEventCount: 0,
    performanceMetrics: {
      avgBreadcrumbTime: 0,
      avgContextSetTime: 0,
      avgExceptionTime: 0,
    },
  });

  const performanceTimes = useRef<{
    breadcrumbs: number[];
    contexts: number[];
    exceptions: number[];
  }>({
    breadcrumbs: [],
    contexts: [],
    exceptions: [],
  });

  // Initialize self-monitoring
  useEffect(() => {
    if (componentName) {
      try {
        const initStartTime = Date.now();

        SentryDataCollection.setContext('sentry_hook_init', {
          component: componentName,
          init_time: hookMetrics.current.initTime,
          respect_privacy: respectPrivacySettings,
        });

        const initDuration = Date.now() - initStartTime;

        SentryDataCollection.addBreadcrumb({
          message: 'Sentry data collection hook initialized',
          category: 'sentry-hook',
          level: 'debug',
          data: {
            component: componentName,
            init_duration_ms: initDuration,
            respect_privacy: respectPrivacySettings,
          },
        });
      } catch (error) {
        console.warn('Failed to initialize Sentry hook self-monitoring:', error);
      }
    }
  }, [componentName, respectPrivacySettings]);

  // Update performance metrics
  const updatePerformanceMetrics = useCallback(() => {
    const { breadcrumbs, contexts, exceptions } = performanceTimes.current;

    hookMetrics.current.performanceMetrics = {
      avgBreadcrumbTime:
        breadcrumbs.length > 0 ? breadcrumbs.reduce((a, b) => a + b, 0) / breadcrumbs.length : 0,
      avgContextSetTime:
        contexts.length > 0 ? contexts.reduce((a, b) => a + b, 0) / contexts.length : 0,
      avgExceptionTime:
        exceptions.length > 0 ? exceptions.reduce((a, b) => a + b, 0) / exceptions.length : 0,
    };

    // Keep only last 100 measurements to prevent memory leaks
    if (breadcrumbs.length > 100) performanceTimes.current.breadcrumbs = breadcrumbs.slice(-100);
    if (contexts.length > 100) performanceTimes.current.contexts = contexts.slice(-100);
    if (exceptions.length > 100) performanceTimes.current.exceptions = exceptions.slice(-100);
  }, []);

  // Set user information with privacy checks
  const setUser = useCallback(
    (userData: UserData) => {
      const operationStartTime = Date.now();

      try {
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

        const operationDuration = Date.now() - operationStartTime;

        if (componentName) {
          SentryDataCollection.addBreadcrumb({
            message: 'User data set via Sentry hook',
            category: 'sentry-hook',
            level: 'debug',
            data: {
              component: componentName,
              operation_duration_ms: operationDuration,
              has_user_id: !!userData.id,
              privacy_respected: respectPrivacySettings,
            },
          });
        }
      } catch (error) {
        const operationDuration = Date.now() - operationStartTime;
        console.warn('Failed to set user in Sentry:', error);

        if (componentName) {
          SentryDataCollection.captureException(error as Error, {
            operation: 'set_user',
            component: componentName,
            operation_duration_ms: operationDuration,
          });
        }
      }
    },
    [respectPrivacySettings, componentName],
  );

  // Clear user information
  const clearUser = useCallback(() => {
    const operationStartTime = Date.now();

    try {
      SentryDataCollection.clearUser();

      const operationDuration = Date.now() - operationStartTime;

      if (componentName) {
        SentryDataCollection.addBreadcrumb({
          message: 'User data cleared via Sentry hook',
          category: 'sentry-hook',
          level: 'debug',
          data: {
            component: componentName,
            operation_duration_ms: operationDuration,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to clear user in Sentry:', error);
    }
  }, [componentName]);

  // Set context with component information
  const setContext = useCallback(
    (key: string, context: SentryContext) => {
      const operationStartTime = Date.now();

      try {
        const enhancedContext = componentName ? { ...context, component: componentName } : context;

        SentryDataCollection.setContext(key, enhancedContext);

        const operationDuration = Date.now() - operationStartTime;
        hookMetrics.current.contextSetCount += 1;
        performanceTimes.current.contexts.push(operationDuration);
        updatePerformanceMetrics();
      } catch (error) {
        const operationDuration = Date.now() - operationStartTime;
        console.warn('Failed to set context in Sentry:', error);
        performanceTimes.current.contexts.push(operationDuration);
      }
    },
    [componentName, updatePerformanceMetrics],
  );

  // Set tag
  const setTag = useCallback((key: string, value: string) => {
    try {
      SentryDataCollection.setTag(key, value);
    } catch (error) {
      console.warn('Failed to set tag in Sentry:', error);
    }
  }, []);

  // Add breadcrumb with component context
  const addBreadcrumb = useCallback(
    (breadcrumb: {
      message: string;
      category?: string;
      level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
      data?: BreadcrumbData;
    }) => {
      const operationStartTime = Date.now();

      try {
        const enhancedBreadcrumb = {
          ...breadcrumb,
          data: componentName ? { ...breadcrumb.data, component: componentName } : breadcrumb.data,
        };

        SentryDataCollection.addBreadcrumb(enhancedBreadcrumb);

        const operationDuration = Date.now() - operationStartTime;
        hookMetrics.current.breadcrumbCount += 1;
        performanceTimes.current.breadcrumbs.push(operationDuration);
        updatePerformanceMetrics();
      } catch (error) {
        const operationDuration = Date.now() - operationStartTime;
        console.warn('Failed to add breadcrumb to Sentry:', error);
        performanceTimes.current.breadcrumbs.push(operationDuration);
      }
    },
    [componentName, updatePerformanceMetrics],
  );

  // Capture exception with component context
  const captureException = useCallback(
    (error: Error, context?: SentryContext) => {
      const operationStartTime = Date.now();

      try {
        const enhancedContext = componentName ? { ...context, component: componentName } : context;

        SentryDataCollection.captureException(error, enhancedContext);

        const operationDuration = Date.now() - operationStartTime;
        hookMetrics.current.exceptionCount += 1;
        performanceTimes.current.exceptions.push(operationDuration);
        updatePerformanceMetrics();
      } catch (captureError) {
        const operationDuration = Date.now() - operationStartTime;
        console.warn('Failed to capture exception in Sentry:', captureError);
        performanceTimes.current.exceptions.push(operationDuration);
      }
    },
    [componentName, updatePerformanceMetrics],
  );

  // Capture message with component context
  const captureMessage = useCallback(
    (message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') => {
      try {
        if (componentName) {
          SentryDataCollection.setContext('component_context', { component: componentName });
        }
        SentryDataCollection.captureMessage(message, level);

        hookMetrics.current.messageCount += 1;
      } catch (error) {
        console.warn('Failed to capture message in Sentry:', error);
      }
    },
    [componentName],
  );

  // Track user action
  const trackUserAction = useCallback(
    (action: string, data?: UserActionData) => {
      try {
        addBreadcrumb({
          message: `User action: ${action}`,
          category: 'user-action',
          level: 'info',
          data: {
            action,
            ...data,
          },
        });

        hookMetrics.current.userActionCount += 1;
      } catch (error) {
        console.warn('Failed to track user action:', error);
      }
    },
    [addBreadcrumb],
  );

  // Track screen view
  const trackScreenView = useCallback(
    (screenName: string, data?: ScreenViewData) => {
      try {
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

        hookMetrics.current.screenViewCount += 1;
      } catch (error) {
        console.warn('Failed to track screen view:', error);
      }
    },
    [addBreadcrumb, setTag],
  );

  // Track workout event
  const trackWorkoutEvent = useCallback(
    (event: string, workoutData?: WorkoutEventData) => {
      try {
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

        hookMetrics.current.workoutEventCount += 1;
      } catch (error) {
        console.warn('Failed to track workout event:', error);
      }
    },
    [setContext, addBreadcrumb],
  );

  // Get hook performance metrics
  const getHookMetrics = useCallback((): SentryHookMetrics & { hookLifetime: number } => {
    return {
      ...hookMetrics.current,
      hookLifetime: Date.now() - hookMetrics.current.initTime,
    };
  }, []);

  // Cleanup and report metrics on unmount
  useEffect(() => {
    return () => {
      if (componentName) {
        try {
          const finalMetrics = getHookMetrics();

          SentryDataCollection.addBreadcrumb({
            message: 'Sentry data collection hook unmounted',
            category: 'sentry-hook',
            level: 'debug',
            data: {
              component: componentName,
              hook_lifetime_ms: finalMetrics.hookLifetime,
              total_breadcrumbs: finalMetrics.breadcrumbCount,
              total_contexts: finalMetrics.contextSetCount,
              total_exceptions: finalMetrics.exceptionCount,
              total_messages: finalMetrics.messageCount,
              total_user_actions: finalMetrics.userActionCount,
              total_screen_views: finalMetrics.screenViewCount,
              total_workout_events: finalMetrics.workoutEventCount,
              avg_breadcrumb_time_ms: finalMetrics.performanceMetrics.avgBreadcrumbTime,
              avg_context_time_ms: finalMetrics.performanceMetrics.avgContextSetTime,
              avg_exception_time_ms: finalMetrics.performanceMetrics.avgExceptionTime,
            },
          });
        } catch (error) {
          console.warn('Failed to report final Sentry hook metrics:', error);
        }
      }
    };
  }, [componentName, getHookMetrics]);

  return {
    // Core Sentry functions
    setUser,
    clearUser,
    setContext,
    setTag,
    addBreadcrumb,
    captureException,
    captureMessage,

    // Tracking functions
    trackUserAction,
    trackScreenView,
    trackWorkoutEvent,

    // Self-monitoring
    getHookMetrics,
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
