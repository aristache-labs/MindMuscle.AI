import { useEffect, useState } from 'react';
import { db } from '../services/database';
import { initDatabase } from '../services/initDatabase';
import { useSentryDataCollection } from './useSentryDataCollection';

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sentry = useSentryDataCollection({
    componentName: 'useDatabase',
    autoSetUser: false,
  });

  useEffect(() => {
    async function initialize() {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Database initialization started',
          category: 'database',
          level: 'info',
        });

        sentry.setContext('database_init', {
          timestamp: new Date().toISOString(),
          status: 'initializing',
        });

        await initDatabase();

        const duration = Date.now() - startTime;

        sentry.trackPerformance('database_init_duration', duration, 'ms');

        sentry.setContext('database_init', {
          timestamp: new Date().toISOString(),
          status: 'ready',
          duration,
        });

        sentry.addBreadcrumb({
          message: 'Database initialization completed successfully',
          category: 'database',
          level: 'info',
          data: { duration },
        });

        setIsReady(true);
      } catch (err) {
        const duration = Date.now() - startTime;
        const dbError = err instanceof Error ? err : new Error('Failed to initialize database');

        sentry.setContext('database_init', {
          timestamp: new Date().toISOString(),
          status: 'failed',
          duration,
          error: dbError.message,
        });

        sentry.captureException(dbError, {
          database_init_duration: duration,
          initialization_failed: true,
        });

        sentry.addBreadcrumb({
          message: 'Database initialization failed',
          category: 'database',
          level: 'error',
          data: {
            error: dbError.message,
            duration,
          },
        });

        setError(dbError);
      }
    }

    initialize();
  }, []);

  // Track database readiness state changes
  useEffect(() => {
    sentry.setTag('database_ready', isReady.toString());

    if (isReady) {
      sentry.addBreadcrumb({
        message: 'Database is ready for use',
        category: 'database',
        level: 'info',
      });
    }
  }, [isReady, sentry]);

  // Track error state changes
  useEffect(() => {
    if (error) {
      sentry.setTag('database_error', 'true');
      sentry.setContext('database_error_state', {
        hasError: true,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      sentry.setTag('database_error', 'false');
    }
  }, [error, sentry]);

  return {
    db,
    isReady,
    error,
  };
}

export default useDatabase;
