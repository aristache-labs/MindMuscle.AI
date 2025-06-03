import * as Sentry from '@sentry/react-native';

/**
 * Distributed Tracing Utilities
 */
export const SentryDistributedTracing = {
  startTransaction: (name: string, operation: string = 'navigation') => {
    return Sentry.startSpan({ name, op: operation }, (span) => span);
  },

  traceApiCall: async <T>(
    endpoint: string,
    method: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    return await Sentry.startSpan(
      { name: `${method.toUpperCase()} ${endpoint}`, op: 'http.client' },
      async () => await operation(),
    );
  },

  setTraceContext: (context: Record<string, unknown>) => {
    Sentry.setContext('trace_context', context);
  },

  setTraceTags: (tags: Record<string, string>) => {
    Object.entries(tags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });
  },

  traceNavigation: (fromRoute: string, toRoute: string, duration?: number) => {
    return Sentry.startSpan(
      {
        name: `Navigation: ${fromRoute} → ${toRoute}`,
        op: 'navigation',
        attributes: {
          from_route: fromRoute,
          to_route: toRoute,
          duration_ms: duration,
        },
      },
      (span) => span,
    );
  },

  traceWorkoutOperation: async <T>(
    workoutId: string,
    operation: () => Promise<T>,
    task: string,
    context?: Record<string, unknown>,
  ): Promise<T> => {
    return await Sentry.startSpan(
      {
        name: `Workout ${task}: ${workoutId}`,
        op: 'workout.operation',
        attributes: {
          workout_id: workoutId,
          task,
          ...context,
        },
      },
      async () => await operation(),
    );
  },

  traceDbOperation: async <T>(
    operation: () => Promise<T>,
    table: string,
    task: string,
    context?: Record<string, unknown>,
  ): Promise<T> => {
    return await Sentry.startSpan(
      {
        name: `DB ${task}: ${table}`,
        op: 'db.operation',
        attributes: {
          table,
          task,
          ...context,
        },
      },
      async () => await operation(),
    );
  },

  traceAiOperation: async <T>(
    operation: () => Promise<T>,
    model: string,
    task: string,
    context?: Record<string, unknown>,
  ): Promise<T> => {
    return await Sentry.startSpan(
      {
        name: `AI ${task}: ${model}`,
        op: 'ai.operation',
        attributes: {
          model,
          task,
          ...context,
        },
      },
      async () => await operation(),
    );
  },

  traceCustomOperation: async <T>(
    name: string,
    operation: () => Promise<T>,
    task: string,
    context?: Record<string, unknown>,
  ): Promise<T> => {
    return await Sentry.startSpan(
      {
        name: `${name}: ${task}`,
        op: 'custom.operation',
        attributes: {
          operation_name: name,
          task,
          ...context,
        },
      },
      async () => await operation(),
    );
  },
};
