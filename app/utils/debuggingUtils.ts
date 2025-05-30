/**
 * Advanced Debugging Utilities for Reactotron
 *
 * This file contains practical utilities that demonstrate the tips and tricks
 * for enhanced Reactotron usage. These utilities help with common debugging
 * scenarios in React Native development.
 */

import { useEffect, useRef } from 'react';
import { queryClient } from '../services/queryClient';

/**
 * Debug levels for conditional logging
 */
export type DebugLevel = 'minimal' | 'normal' | 'verbose';

/**
 * Current debug level - can be changed based on environment or user preference
 */
const DEBUG_LEVEL: DebugLevel = __DEV__ ? 'verbose' : 'minimal';

// Recursion guard to prevent infinite loops
let isLoggingInProgress = false;

/**
 * Conditional logging based on debug level
 */
export const conditionalLog = (level: DebugLevel, message: string, data?: unknown) => {
  if (!__DEV__ || isLoggingInProgress) return;

  try {
    isLoggingInProgress = true;
    const levels = { minimal: 1, normal: 2, verbose: 3 };
    if (levels[DEBUG_LEVEL] >= levels[level]) {
      console.tron?.log(`[${level.toUpperCase()}] ${message}`, data);
    }
  } catch {
    // Fallback to regular console if Reactotron fails
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  } finally {
    isLoggingInProgress = false;
  }
};

/**
 * Enhanced API call debugging wrapper
 */
export const debugApiCall = async <T>(
  endpoint: string,
  options: RequestInit,
  apiFunction: () => Promise<T>,
): Promise<T> => {
  if (!__DEV__) return apiFunction();

  const startTime = Date.now();
  const method = options.method || 'GET';

  try {
    console.tron?.log(`🌐 Starting API call: ${method} ${endpoint}`);

    const result = await apiFunction();
    const duration = Date.now() - startTime;

    console.tron?.api(endpoint, method, options.body, {
      status: 'success',
      data: result,
      duration: `${duration}ms`,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.tron?.error(`API call failed: ${method} ${endpoint}`, {
      error: error instanceof Error ? error.message : error,
      duration: `${duration}ms`,
      options,
    });
    throw error;
  }
};

/**
 * Hook for debugging component renders and performance
 */
export const useRenderDebugger = (
  componentName: string,
  props?: Record<string, unknown>,
  state?: Record<string, unknown>,
) => {
  const renderCount = useRef(0);
  const renderStart = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = Date.now() - renderStart.current;

    if (__DEV__) {
      console.tron?.render(componentName, props, state);
      console.tron?.performance(`${componentName} Render #${renderCount.current}`, renderTime, {
        renderCount: renderCount.current,
        timestamp: new Date().toISOString(),
      });
    }

    renderStart.current = Date.now();
  });

  useEffect(() => {
    if (__DEV__) {
      console.tron?.log(`🎨 ${componentName} mounted`);
      return () => {
        console.tron?.log(`🎨 ${componentName} unmounted`);
      };
    }
  }, [componentName]);
};

/**
 * Hook for debugging context state changes
 */
export const useContextDebugger = (contextName: string, contextValue: unknown) => {
  useEffect(() => {
    if (__DEV__) {
      console.tron?.state(contextName, contextValue);
    }
  }, [contextName, contextValue]);
};

/**
 * Hook for debugging navigation events
 */
export const useNavigationDebugger = () => {
  useEffect(() => {
    if (__DEV__ && typeof navigator !== 'undefined') {
      // This would be implemented with react-navigation listener
      console.tron?.log('🧭 Navigation debugger initialized');
    }
  }, []);
};

/**
 * Memory usage tracker (React Native specific)
 */
export const trackMemoryUsage = (operation: string) => {
  if (!__DEV__) return;

  // Note: performance.memory is not available in React Native by default
  // This is more applicable to React web apps
  if (typeof performance !== 'undefined' && (performance as { memory?: unknown }).memory) {
    const memoryInfo = (performance as { memory?: Record<string, number> }).memory;
    if (memoryInfo) {
      console.tron?.performance(`Memory Usage - ${operation}`, 0, {
        usedJSHeapSize: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        totalJSHeapSize: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        jsHeapSizeLimit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
      });
    }
  } else {
    console.tron?.log(
      `📊 Memory tracking requested for: ${operation} (not available in React Native)`,
    );
  }
};

/**
 * Enhanced async operation tracker
 */
export const trackAsyncOperation = async <T>(
  operationName: string,
  operation: () => Promise<T>,
  options?: {
    logStart?: boolean;
    logSuccess?: boolean;
    logError?: boolean;
    includeResult?: boolean;
  },
): Promise<T> => {
  if (!__DEV__) return operation();

  const {
    logStart = true,
    logSuccess = true,
    logError = true,
    includeResult = false,
  } = options || {};

  const startTime = Date.now();

  if (logStart) {
    console.tron?.log(`🔄 Starting async operation: ${operationName}`);
  }

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    if (logSuccess) {
      console.tron?.success(`Async operation completed: ${operationName}`, {
        duration: `${duration}ms`,
        ...(includeResult && { result }),
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (logError) {
      console.tron?.error(`Async operation failed: ${operationName}`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    throw error;
  }
};

/**
 * User action tracker for analytics and debugging
 */
export const trackUserAction = (
  action: string,
  details?: Record<string, unknown>,
  important = false,
) => {
  if (!__DEV__) return;

  console.tron?.display({
    name: '👤 User Action',
    value: {
      action,
      details,
      timestamp: new Date().toISOString(),
      sessionId: 'debug-session', // In real app, use actual session ID
    },
    preview: `User: ${action}`,
    important,
  });
};

/**
 * Performance benchmark utility
 */
export const benchmark = <T>(operation: () => T, operationName: string, threshold = 100): T => {
  if (!__DEV__) return operation();

  const startTime = performance.now();
  const result = operation();
  const duration = performance.now() - startTime;

  const isImportant = duration > threshold;

  console.tron?.performance(operationName, Math.round(duration), {
    threshold: `${threshold}ms`,
    status: isImportant ? 'SLOW' : 'FAST',
    timestamp: new Date().toISOString(),
  });

  return result;
};

/**
 * Async performance benchmark utility
 */
export const benchmarkAsync = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  threshold = 1000,
): Promise<T> => {
  if (!__DEV__) return operation();

  const startTime = performance.now();
  const result = await operation();
  const duration = performance.now() - startTime;

  const isImportant = duration > threshold;

  console.tron?.performance(operationName, Math.round(duration), {
    threshold: `${threshold}ms`,
    status: isImportant ? 'SLOW' : 'FAST',
    timestamp: new Date().toISOString(),
  });

  return result;
};

/**
 * State change tracker for debugging state management
 */
export const trackStateChange = (
  stateName: string,
  oldState: unknown,
  newState: unknown,
  action?: string,
) => {
  if (!__DEV__) return;

  const hasChanged = JSON.stringify(oldState) !== JSON.stringify(newState);

  if (hasChanged) {
    console.tron?.display({
      name: '🏪 State Change',
      value: {
        stateName,
        action,
        oldState,
        newState,
        timestamp: new Date().toISOString(),
      },
      preview: `${stateName}${action ? ` (${action})` : ''}`,
      important: false,
    });
  }
};

/**
 * Error boundary helper for component error tracking
 */
export const trackComponentError = (
  componentName: string,
  error: Error,
  errorInfo?: Record<string, unknown>,
) => {
  if (!__DEV__) return;

  console.tron?.display({
    name: '🔴 Component Error',
    value: {
      componentName,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      errorInfo,
      timestamp: new Date().toISOString(),
    },
    preview: `Error in ${componentName}: ${error.message}`,
    important: true,
  });
};

/**
 * Network request interceptor for debugging
 */
export const createNetworkInterceptor = () => {
  if (!__DEV__) return;

  const originalFetch = global.fetch;

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const startTime = Date.now();

    console.tron?.log(`🌐 Network Request: ${method} ${url}`);

    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;

      console.tron?.api(url, method, init?.body, {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        headers: Object.fromEntries(response.headers.entries()),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.tron?.error(`Network Request Failed: ${method} ${url}`, {
        error: error instanceof Error ? error.message : error,
        duration: `${duration}ms`,
      });
      throw error;
    }
  };

  console.tron?.logImportant('🌐 Network interceptor enabled for debugging');
};

/**
 * React Query debugging utilities
 */
export const debugReactQuery = {
  /**
   * Log all queries in the cache
   */
  logAllQueries: () => {
    if (!__DEV__) return;

    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    console.tron?.display({
      name: '🔍 React Query Cache',
      value: {
        totalQueries: queries.length,
        queries: queries.map((query) => ({
          queryKey: query.queryKey,
          state: query.state.status,
          dataUpdatedAt: new Date(query.state.dataUpdatedAt).toISOString(),
          errorUpdatedAt: query.state.errorUpdatedAt
            ? new Date(query.state.errorUpdatedAt).toISOString()
            : null,
          fetchStatus: query.state.fetchStatus,
          isStale: query.isStale(),
        })),
      },
      preview: `${queries.length} queries in cache`,
      important: false,
    });
  },

  /**
   * Log a specific query by key
   */
  logQuery: (queryKey: unknown[]) => {
    if (!__DEV__) return;

    const query = queryClient.getQueryCache().find({ queryKey });

    if (query) {
      console.tron?.display({
        name: '🔍 React Query - Single Query',
        value: {
          queryKey: query.queryKey,
          state: query.state,
          observers: query.getObserversCount(),
          isStale: query.isStale(),
          isActive: query.isActive(),
          data: query.state.data,
          error: query.state.error,
        },
        preview: `Query: ${JSON.stringify(queryKey)}`,
        important: query.state.status === 'error',
      });
    } else {
      console.tron?.warn('Query not found in cache', { queryKey });
    }
  },

  /**
   * Invalidate queries and log the action
   */
  invalidateQueries: async (queryKey?: unknown[]) => {
    if (!__DEV__) return;

    const startTime = Date.now();
    console.tron?.log(`🔄 Invalidating queries: ${queryKey ? JSON.stringify(queryKey) : 'all'}`);

    try {
      await queryClient.invalidateQueries(queryKey ? { queryKey } : undefined);
      const duration = Date.now() - startTime;

      console.tron?.success('Queries invalidated successfully', {
        queryKey: queryKey || 'all',
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.tron?.error('Failed to invalidate queries', {
        queryKey: queryKey || 'all',
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
      });
    }
  },

  /**
   * Clear all query cache and log the action
   */
  clearCache: () => {
    if (!__DEV__) return;

    const cache = queryClient.getQueryCache();
    const queriesCount = cache.getAll().length;

    queryClient.clear();

    console.tron?.logImportant(`🗑️ React Query cache cleared (${queriesCount} queries removed)`);
  },

  /**
   * Refetch all queries and log the action
   */
  refetchAll: async () => {
    if (!__DEV__) return;

    const startTime = Date.now();
    console.tron?.log('🔄 Refetching all queries...');

    try {
      await queryClient.refetchQueries();
      const duration = Date.now() - startTime;

      console.tron?.success('All queries refetched successfully', {
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.tron?.error('Failed to refetch queries', {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
      });
    }
  },

  /**
   * Log query cache statistics
   */
  logCacheStats: () => {
    if (!__DEV__) return;

    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    const stats = {
      total: queries.length,
      byStatus: {
        success: queries.filter((q) => q.state.status === 'success').length,
        error: queries.filter((q) => q.state.status === 'error').length,
        pending: queries.filter((q) => q.state.status === 'pending').length,
      },
      byFetchStatus: {
        idle: queries.filter((q) => q.state.fetchStatus === 'idle').length,
        fetching: queries.filter((q) => q.state.fetchStatus === 'fetching').length,
        paused: queries.filter((q) => q.state.fetchStatus === 'paused').length,
      },
      stale: queries.filter((q) => q.isStale()).length,
      active: queries.filter((q) => q.isActive()).length,
    };

    console.tron?.display({
      name: '📊 React Query Cache Statistics',
      value: stats,
      preview: `${stats.total} total queries, ${stats.stale} stale, ${stats.active} active`,
      important: stats.byStatus.error > 0,
    });
  },

  /**
   * Monitor query state changes
   */
  monitorQuery: (queryKey: unknown[]) => {
    if (!__DEV__) return;

    const query = queryClient.getQueryCache().find({ queryKey });

    if (query) {
      // Note: React Query doesn't have a subscribe method on queries
      // Instead, we'll log the current state and suggest using React Query DevTools
      console.tron?.display({
        name: '👁️ React Query Monitor (Current State)',
        value: {
          queryKey,
          status: query.state.status,
          fetchStatus: query.state.fetchStatus,
          dataUpdatedAt: new Date(query.state.dataUpdatedAt).toISOString(),
          error: query.state.error,
          isStale: query.isStale(),
        },
        preview: `Query ${JSON.stringify(queryKey)} - ${query.state.status}`,
        important: query.state.status === 'error',
      });

      console.tron?.logImportant(
        `👁️ Query state logged for: ${JSON.stringify(queryKey)}. Use React Query DevTools for real-time monitoring.`,
      );

      // Return a no-op function for consistency
      return () => {};
    } else {
      console.tron?.warn('Cannot monitor query - not found in cache', { queryKey });
    }
  },
};

/**
 * Debugging utilities collection
 */
export const DebugUtils = {
  // Logging
  conditionalLog,

  // Performance
  benchmark,
  benchmarkAsync,
  trackMemoryUsage,

  // API & Network
  debugApiCall,
  createNetworkInterceptor,

  // State & Navigation
  trackStateChange,
  trackUserAction,

  // Async Operations
  trackAsyncOperation,

  // Component Debugging
  trackComponentError,

  // Hooks
  useRenderDebugger,
  useContextDebugger,
  useNavigationDebugger,

  // React Query
  debugReactQuery,
};

// Make DebugUtils available globally in development
if (__DEV__ && !isLoggingInProgress) {
  try {
    // Check if global object is available and not already set
    if (typeof global !== 'undefined' && !(global as Record<string, unknown>).DebugUtils) {
      (global as Record<string, unknown>).DebugUtils = DebugUtils;
      console.tron?.logImportant('🛠️ DebugUtils available globally for enhanced debugging');
    }
  } catch {
    // Silently fail if there's an issue setting up global debugging
    console.log('DebugUtils setup completed (fallback mode)');
  }
}
