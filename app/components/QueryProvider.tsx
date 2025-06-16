import React, { ReactNode, useEffect } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '../services/queryClient';
import { SentryDataCollection, SentryInsights } from '../services/sentry';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Track QueryProvider lifecycle
  useEffect(() => {
    const startTime = performance.now();

    SentryDataCollection.addBreadcrumb({
      message: 'QueryProvider mounted - React Query initialized',
      category: 'query.lifecycle',
      data: {
        timestamp: new Date().toISOString(),
        queryClientConfig: {
          defaultOptions: queryClient.getDefaultOptions(),
        },
      },
    });

    // Monitor query cache events
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      try {
        SentryDataCollection.addBreadcrumb({
          message: `Query cache event: ${event.type}`,
          category: 'query.cache',
          data: {
            queryKey: event.query?.queryKey,
            queryHash: event.query?.queryHash,
            eventType: event.type,
            timestamp: new Date().toISOString(),
          },
        });

        // Track query performance for specific events
        if (event.type === 'updated' && event.query) {
          const query = event.query;
          if (query.state.dataUpdatedAt && query.state.dataUpdateCount > 0) {
            SentryInsights.trackPerformanceMetric(
              'query_update_time',
              query.state.dataUpdatedAt - (query.state.dataUpdatedAt - 1000), // Approximate
              'ms',
            );
          }
        }
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'QueryProvider',
          action: 'query_cache_subscription',
          queryKey: event.query?.queryKey?.toString(),
        });
      }
    });

    // Track mutation cache events
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      try {
        SentryDataCollection.addBreadcrumb({
          message: `Mutation cache event: ${event.type}`,
          category: 'query.mutation',
          data: {
            mutationKey: event.mutation?.options.mutationKey,
            eventType: event.type,
            timestamp: new Date().toISOString(),
          },
        });

        // Track mutation performance
        if (event.type === 'updated' && event.mutation?.state.status) {
          SentryInsights.trackFeatureUsage('mutation_execution', {
            status: event.mutation.state.status,
            mutationKey: event.mutation.options.mutationKey,
          });
        }
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'QueryProvider',
          action: 'mutation_cache_subscription',
          mutationKey: event.mutation?.options.mutationKey?.toString(),
        });
      }
    });

    const initTime = performance.now() - startTime;
    SentryDataCollection.addBreadcrumb({
      message: 'QueryProvider initialization completed',
      category: 'query.lifecycle',
      data: {
        initializationTimeMs: initTime.toFixed(2),
        cacheSize: queryClient.getQueryCache().getAll().length,
      },
    });

    return () => {
      SentryDataCollection.addBreadcrumb({
        message: 'QueryProvider unmounting - cleaning up subscriptions',
        category: 'query.lifecycle',
        data: {
          timestamp: new Date().toISOString(),
        },
      });

      unsubscribe();
      unsubscribeMutations();
    };
  }, []);

  // Monitor persistence operations
  useEffect(() => {
    const originalRestore = asyncStoragePersister.restoreClient;
    const originalPersist = asyncStoragePersister.persistClient;

    // Wrap restore operation
    asyncStoragePersister.restoreClient = async () => {
      const startTime = performance.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Query cache restore started',
        category: 'query.persistence',
        data: { timestamp: new Date().toISOString() },
      });

      try {
        const result = await originalRestore.call(asyncStoragePersister);
        const restoreTime = performance.now() - startTime;

        SentryDataCollection.addBreadcrumb({
          message: 'Query cache restored successfully',
          category: 'query.persistence',
          data: {
            restoreTimeMs: restoreTime.toFixed(2),
            restoredQueries: result ? 'data_found' : 'no_data',
          },
        });

        SentryInsights.trackPerformanceMetric('query_cache_restore_time', restoreTime, 'ms');

        return result;
      } catch (error) {
        const restoreTime = performance.now() - startTime;

        SentryDataCollection.captureException(error as Error, {
          component: 'QueryProvider',
          action: 'cache_restore',
          restoreTimeMs: restoreTime.toFixed(2),
        });

        throw error;
      }
    };

    // Wrap persist operation
    asyncStoragePersister.persistClient = async (client) => {
      const startTime = performance.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Query cache persist started',
        category: 'query.persistence',
        data: {
          timestamp: new Date().toISOString(),
          operation: 'persist_started',
        },
      });

      try {
        const result = await originalPersist.call(asyncStoragePersister, client);
        const persistTime = performance.now() - startTime;

        SentryDataCollection.addBreadcrumb({
          message: 'Query cache persisted successfully',
          category: 'query.persistence',
          data: {
            persistTimeMs: persistTime.toFixed(2),
            queriesCount: 'persisted',
          },
        });

        SentryInsights.trackPerformanceMetric('query_cache_persist_time', persistTime, 'ms');

        return result;
      } catch (error) {
        const persistTime = performance.now() - startTime;

        SentryDataCollection.captureException(error as Error, {
          component: 'QueryProvider',
          action: 'cache_persist',
          persistTimeMs: persistTime.toFixed(2),
        });

        throw error;
      }
    };

    return () => {
      // Restore original methods on cleanup
      asyncStoragePersister.restoreClient = originalRestore;
      asyncStoragePersister.persistClient = originalPersist;
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        buster: process.env.APP_VERSION || '1.0.0',
      }}
      onSuccess={() => {
        SentryDataCollection.addBreadcrumb({
          message: 'Query persistence initialization successful',
          category: 'query.persistence',
          data: {
            timestamp: new Date().toISOString(),
            maxAge: '7 days',
            buster: process.env.APP_VERSION || '1.0.0',
          },
        });
      }}
      onError={() => {
        SentryDataCollection.addBreadcrumb({
          message: 'Query persistence initialization failed',
          category: 'query.persistence',
          data: {
            timestamp: new Date().toISOString(),
            maxAge: '7 days',
            buster: process.env.APP_VERSION || '1.0.0',
          },
        });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export default QueryProvider;
