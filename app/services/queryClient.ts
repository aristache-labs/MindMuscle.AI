import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import {
  captureAPIError,
  captureStorageError,
  capturePerformanceError,
  setContext,
  setTag,
} from './sentry';
import { addBreadcrumb, captureMessage } from './sentry/simpleErrorHandler';

// Set up Sentry context for query client
setContext('react_query', {
  service: 'QueryClient',
  version: '1.0.0',
  features: ['caching', 'persistence', 'retry', 'background_refetch'],
});
setTag('service.type', 'query_client');

// Create a client with Sentry monitoring
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default query configuration
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (previously cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

// Add Sentry error tracking to the query cache
queryClient.getQueryCache().subscribe((event) => {
  if (event?.type === 'observerAdded') {
    const query = event.query;
    const queryKey = Array.isArray(query.queryKey)
      ? query.queryKey.join(',')
      : String(query.queryKey);

    addBreadcrumb('React Query observer added', 'query', {
      queryKey,
      state: query.state.status,
    });
  }

  if (event?.type === 'updated' && event.query?.state.error) {
    const query = event.query;
    const queryKey = Array.isArray(query.queryKey)
      ? query.queryKey.join(',')
      : String(query.queryKey);
    const error = query.state.error as Error;

    addBreadcrumb('React Query error occurred', 'query', {
      queryKey,
      error: error.message,
      state: query.state.status,
    });

    captureAPIError(error, queryKey, 'react-query');

    captureMessage('React Query error detected', 'error', {
      category: 'api_error',
      queryKey,
      errorMessage: error.message,
      queryState: query.state.status,
    });
  }

  if (event?.type === 'updated' && event.query?.state.data && !event.query.state.error) {
    const query = event.query;
    const queryKey = Array.isArray(query.queryKey)
      ? query.queryKey.join(',')
      : String(query.queryKey);

    addBreadcrumb('React Query success', 'query', {
      queryKey,
      dataType: typeof query.state.data,
      state: query.state.status,
    });

    // Track performance for slow queries
    const fetchTime =
      query.state.dataUpdatedAt -
      (query.state.dataUpdateCount > 1
        ? query.state.dataUpdatedAt - 1000
        : query.state.dataUpdatedAt);
    if (fetchTime > 5000) {
      // 5 seconds
      capturePerformanceError('Slow React Query operation', 'query_duration', fetchTime);
    }
  }
});

// Add Sentry error tracking to the mutation cache
queryClient.getMutationCache().subscribe((event) => {
  if (event?.type === 'added') {
    const mutation = event.mutation;
    const mutationKey = Array.isArray(mutation.options.mutationKey)
      ? mutation.options.mutationKey.join(',')
      : String(mutation.options.mutationKey || 'unknown');

    addBreadcrumb('React Query mutation added', 'mutation', {
      mutationKey,
      state: mutation.state.status,
    });
  }

  if (event?.type === 'updated' && event.mutation.state.error) {
    const mutation = event.mutation;
    const mutationKey = Array.isArray(mutation.options.mutationKey)
      ? mutation.options.mutationKey.join(',')
      : String(mutation.options.mutationKey || 'unknown');
    const error = mutation.state.error as Error;

    addBreadcrumb('React Query mutation error', 'mutation', {
      mutationKey,
      error: error.message,
      retryCount: mutation.state.failureCount,
    });

    captureAPIError(error, mutationKey, 'react-query-mutation');

    captureMessage('React Query mutation failed', 'error', {
      category: 'api_error',
      mutationKey,
      errorMessage: error.message,
      retryCount: mutation.state.failureCount,
    });
  }

  if (event?.type === 'updated' && event.mutation.state.data && !event.mutation.state.error) {
    const mutation = event.mutation;
    const mutationKey = Array.isArray(mutation.options.mutationKey)
      ? mutation.options.mutationKey.join(',')
      : String(mutation.options.mutationKey || 'unknown');

    addBreadcrumb('React Query mutation success', 'mutation', {
      mutationKey,
      dataType: typeof mutation.state.data,
    });
  }
});

// Create a persister for AsyncStorage with Sentry monitoring
// We need to create a custom adapter since the AsyncStorage functions are async
export const asyncStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    const startTime = Date.now();

    addBreadcrumb('Starting query cache persistence', 'storage', {
      operation: 'persistClient',
      clientState: typeof client,
    });

    try {
      const serializedClient = JSON.stringify(client);
      await AsyncStorage.setItem('MINDMUSCLE_QUERY_CACHE', serializedClient);

      const duration = Date.now() - startTime;
      const dataSize = new Blob([serializedClient]).size;

      addBreadcrumb('Query cache persisted successfully', 'storage', {
        operation: 'persistClient',
        duration,
        dataSize,
      });

      // Track performance for large cache persistence
      if (duration > 2000) {
        // 2 seconds
        capturePerformanceError('Slow query cache persistence', 'persist_duration', duration);
      }

      if (dataSize > 1024 * 1024) {
        // 1MB
        capturePerformanceError('Large query cache size', 'cache_size', dataSize);
      }

      captureMessage('Query cache persisted successfully', 'info', {
        category: 'storage_error',
        operation: 'persistClient',
        duration,
        dataSize,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      addBreadcrumb('Query cache persistence failed', 'error', {
        operation: 'persistClient',
        duration,
        error: (error as Error).message,
      });

      captureStorageError(error as Error, 'async_storage', 'persistClient');
      throw error;
    }
  },

  restoreClient: async () => {
    const startTime = Date.now();

    addBreadcrumb('Starting query cache restoration', 'storage', {
      operation: 'restoreClient',
    });

    try {
      const storageValue = await AsyncStorage.getItem('MINDMUSCLE_QUERY_CACHE');

      if (storageValue) {
        const client = JSON.parse(storageValue) as PersistedClient;
        const duration = Date.now() - startTime;
        const dataSize = new Blob([storageValue]).size;

        addBreadcrumb('Query cache restored successfully', 'storage', {
          operation: 'restoreClient',
          duration,
          dataSize,
          hasData: true,
        });

        // Track performance for slow restoration
        if (duration > 1000) {
          // 1 second
          capturePerformanceError('Slow query cache restoration', 'restore_duration', duration);
        }

        captureMessage('Query cache restored successfully', 'info', {
          category: 'storage_error',
          operation: 'restoreClient',
          duration,
          dataSize,
        });

        return client;
      } else {
        const duration = Date.now() - startTime;

        addBreadcrumb('No query cache found to restore', 'storage', {
          operation: 'restoreClient',
          duration,
          hasData: false,
        });

        return undefined;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      addBreadcrumb('Query cache restoration failed', 'error', {
        operation: 'restoreClient',
        duration,
        error: (error as Error).message,
      });

      captureStorageError(error as Error, 'async_storage', 'restoreClient');

      // Return undefined instead of throwing to prevent app crashes
      return undefined;
    }
  },

  removeClient: async () => {
    const startTime = Date.now();

    addBreadcrumb('Starting query cache removal', 'storage', {
      operation: 'removeClient',
    });

    try {
      await AsyncStorage.removeItem('MINDMUSCLE_QUERY_CACHE');

      const duration = Date.now() - startTime;

      addBreadcrumb('Query cache removed successfully', 'storage', {
        operation: 'removeClient',
        duration,
      });

      captureMessage('Query cache removed successfully', 'info', {
        category: 'storage_error',
        operation: 'removeClient',
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      addBreadcrumb('Query cache removal failed', 'error', {
        operation: 'removeClient',
        duration,
        error: (error as Error).message,
      });

      captureStorageError(error as Error, 'async_storage', 'removeClient');
      throw error;
    }
  },
};

// Track service initialization
addBreadcrumb('QueryClient and AsyncStorage persister initialized', 'system', {
  timestamp: new Date().toISOString(),
  service: 'queryClient',
  cacheKey: 'MINDMUSCLE_QUERY_CACHE',
});

captureMessage('React Query service initialized successfully', 'info', {
  category: 'javascript_error',
  service: 'queryClient',
  features: ['caching', 'persistence', 'retry', 'error_tracking'],
  defaultStaleTime: 1000 * 60 * 5,
  defaultGcTime: 1000 * 60 * 60 * 24,
});

// This is only here to satisfy Expo Router and is not meant to be used
export default function QueryClientProvider() {
  return null;
}
