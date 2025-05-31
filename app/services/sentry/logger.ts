import * as Sentry from '@sentry/react-native';
import { SentryDataCollection } from './dataCollection';

/**
 * Sentry Logging Utilities
 */
export const SentryLogger = {
  log: (
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, unknown>,
  ) => {
    Sentry.addBreadcrumb({ message, level, data, category: 'logger' });
    if (level === 'error') Sentry.captureMessage(message, level);
  },

  error: (message: string, data?: Record<string, unknown>, context?: Record<string, unknown>) => {
    const combinedData = { ...data, ...context };
    if (data && typeof data === 'object' && 'error' in data) {
      SentryDataCollection.captureException(data.error as Error, combinedData);
    } else {
      Sentry.captureMessage(message, 'error');
    }
  },

  warn: (message: string, data?: Record<string, unknown>, context?: Record<string, unknown>) => {
    const combinedData = { ...data, ...context };
    SentryLogger.log(message, 'warning', combinedData);
  },

  info: (message: string, data?: Record<string, unknown>, context?: Record<string, unknown>) => {
    const combinedData = { ...data, ...context };
    SentryLogger.log(message, 'info', combinedData);
  },

  database: {
    query: (table: string, operation: string, data?: Record<string, unknown>) => {
      Sentry.addBreadcrumb({
        message: `DB ${operation}: ${table}`,
        category: 'database',
        data,
      });
    },
    error: (table: string, operation: string, error: string, data?: Record<string, unknown>) => {
      Sentry.addBreadcrumb({
        message: `DB Error ${operation}: ${table} - ${error}`,
        category: 'database.error',
        level: 'error',
        data,
      });
    },
  },

  workout: {
    completed: (workoutId: string, duration: number, exerciseCount: number) => {
      Sentry.addBreadcrumb({
        message: `Workout completed: ${workoutId}`,
        category: 'workout.completed',
        data: { workout_id: workoutId, duration, exercise_count: exerciseCount },
      });
    },
    error: (workoutId: string, error: string, data?: Record<string, unknown>) => {
      Sentry.addBreadcrumb({
        message: `Workout error: ${workoutId} - ${error}`,
        category: 'workout.error',
        level: 'error',
        data: { workout_id: workoutId, ...data },
      });
    },
  },
};
