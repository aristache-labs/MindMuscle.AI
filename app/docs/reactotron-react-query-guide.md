# Reactotron React Query Debugging Guide

## Overview

The React Query plugin for Reactotron provides powerful debugging capabilities for your TanStack Query (React Query) cache and queries, similar to the React Query DevTools but integrated directly into Reactotron. This allows you to monitor, inspect, and manipulate your query cache in real-time during development.

## Features

- **Query Cache Inspection**: View all queries in your cache with their current state
- **Real-time Monitoring**: Watch query state changes as they happen
- **Cache Manipulation**: Invalidate, refetch, or clear queries directly from Reactotron
- **Performance Tracking**: Monitor query execution times and performance
- **Error Debugging**: Inspect query errors and failed requests
- **Custom Commands**: Execute query operations through Reactotron's custom commands

## Installation & Setup

The React Query plugin is already configured in your Reactotron setup:

```javascript
// In ReactotronConfig.js
import { QueryClientManager, reactotronReactQuery } from 'reactotron-react-query';
import { queryClient } from './app/services/queryClient';

// Create QueryClientManager for React Query debugging
const queryClientManager = new QueryClientManager({
  queryClient,
});

Reactotron
  .use(reactotronReactQuery(queryClientManager))
  .configure({
    onDisconnect: () => {
      // Clean up React Query manager when Reactotron disconnects
      queryClientManager.unsubscribe();
    },
  })
```

## Using the React Query Tab

### 1. Viewing Query Cache

In Reactotron, you'll see a new "React Query" tab that displays:

- **All active queries** with their current state
- **Query keys** and their hierarchical structure
- **Query status** (success, error, pending, idle)
- **Fetch status** (idle, fetching, paused)
- **Data freshness** (stale/fresh indicators)
- **Observer count** (how many components are using the query)

### 2. Query Details

Click on any query to see detailed information:

- **Query Key**: The unique identifier for the query
- **Query Data**: The actual data returned by the query
- **Query State**: Complete state object including timestamps
- **Error Information**: If the query failed, detailed error information
- **Cache Time**: When the data was last updated
- **Stale Time**: When the data will become stale

## Console Commands

### Basic React Query Commands

```javascript
// View all queries in cache
console.tron.reactQuery.logCache();

// Invalidate all queries (triggers refetch for active queries)
console.tron.reactQuery.invalidateAll();

// Clear entire query cache
console.tron.reactQuery.clearCache();

// Refetch all active queries
console.tron.reactQuery.refetchAll();
```

### Advanced Debugging Utilities

```javascript
// Access advanced React Query debugging utilities
DebugUtils.debugReactQuery.logAllQueries();
DebugUtils.debugReactQuery.logCacheStats();

// Log specific query
DebugUtils.debugReactQuery.logQuery(['users', 'profile']);

// Invalidate specific queries
DebugUtils.debugReactQuery.invalidateQueries(['workouts']);

// Monitor query state changes
const unsubscribe = DebugUtils.debugReactQuery.monitorQuery(['exercises']);
// Call unsubscribe() when done monitoring
```

## Practical Debugging Scenarios

### 1. Debugging Stale Data

```javascript
// Check which queries are stale
DebugUtils.debugReactQuery.logCacheStats();

// Force refetch of stale data
console.tron.reactQuery.refetchAll();

// Or invalidate specific stale queries
DebugUtils.debugReactQuery.invalidateQueries(['workouts', 'recent']);
```

### 2. Investigating Failed Queries

```javascript
// View all queries to identify errors
console.tron.reactQuery.logCache();

// Get detailed error information for a specific query
DebugUtils.debugReactQuery.logQuery(['api', 'user', 'profile']);

// Monitor a problematic query in real-time
DebugUtils.debugReactQuery.monitorQuery(['api', 'workouts']);
```

### 3. Performance Analysis

```javascript
// Check cache statistics for performance insights
DebugUtils.debugReactQuery.logCacheStats();

// Monitor query execution times
const unsubscribe = DebugUtils.debugReactQuery.monitorQuery(['heavy-query']);

// Clear cache to test cold loading performance
console.tron.reactQuery.clearCache();
```

### 4. Testing Cache Invalidation

```javascript
// Test invalidation of specific query patterns
DebugUtils.debugReactQuery.invalidateQueries(['users']);

// Test global invalidation
console.tron.reactQuery.invalidateAll();

// Verify cache state after invalidation
DebugUtils.debugReactQuery.logCacheStats();
```

## Custom Commands in Reactotron

The plugin automatically adds custom commands to Reactotron that you can execute directly from the desktop app:

### Available Commands

1. **Invalidate All Queries**: Invalidates all queries in the cache
2. **Refetch All Queries**: Refetches all active queries
3. **Clear Query Cache**: Completely clears the query cache
4. **Log Cache State**: Displays current cache state in timeline

### Using Custom Commands

1. Open Reactotron desktop app
2. Go to the "Custom Commands" section
3. Select the React Query command you want to execute
4. Click "Send" to execute the command
5. View the results in the timeline

## Integration with Your App

### Debugging in Components

```javascript
import { useQuery } from '@tanstack/react-query';
import { DebugUtils } from '../utils/debuggingUtils';

const UserProfile = ({ userId }) => {
  const queryKey = ['users', 'profile', userId];
  
  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchUserProfile(userId),
  });

  // Debug this specific query in development
  useEffect(() => {
    if (__DEV__) {
      DebugUtils.debugReactQuery.logQuery(queryKey);
    }
  }, [data, error]);

  // Monitor query state changes
  useEffect(() => {
    if (__DEV__) {
      const unsubscribe = DebugUtils.debugReactQuery.monitorQuery(queryKey);
      return unsubscribe;
    }
  }, []);

  return (
    // Your component JSX
  );
};
```

### Debugging Mutations

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data, variables) => {
      if (__DEV__) {
        console.tron?.success('Profile updated successfully', {
          data,
          variables,
        });
        
        // Log cache state after mutation
        DebugUtils.debugReactQuery.logCacheStats();
      }
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error, variables) => {
      if (__DEV__) {
        console.tron?.error('Profile update failed', {
          error: error.message,
          variables,
        });
      }
    },
  });
};
```

### Debugging Query Keys

```javascript
// Helper to debug query key construction
const debugQueryKey = (baseKey, params) => {
  const queryKey = [baseKey, params];
  
  if (__DEV__) {
    console.tron?.display({
      name: '🔑 Query Key Debug',
      value: {
        baseKey,
        params,
        finalKey: queryKey,
        serialized: JSON.stringify(queryKey),
      },
      preview: `Query Key: ${JSON.stringify(queryKey)}`,
    });
  }
  
  return queryKey;
};

// Usage
const queryKey = debugQueryKey('workouts', { userId, date: '2024-01-01' });
```

## Best Practices

### 1. Query Key Debugging

```javascript
// Always log query keys when debugging
const useWorkouts = (filters) => {
  const queryKey = ['workouts', filters];
  
  if (__DEV__) {
    console.tron?.log(`🔍 Using query key: ${JSON.stringify(queryKey)}`);
  }
  
  return useQuery({
    queryKey,
    queryFn: () => fetchWorkouts(filters),
  });
};
```

### 2. Cache State Monitoring

```javascript
// Monitor cache state during critical operations
const handleCriticalOperation = async () => {
  if (__DEV__) {
    console.tron?.log('🔄 Starting critical operation...');
    DebugUtils.debugReactQuery.logCacheStats();
  }
  
  try {
    await performOperation();
    
    if (__DEV__) {
      console.tron?.success('Critical operation completed');
      DebugUtils.debugReactQuery.logCacheStats();
    }
  } catch (error) {
    if (__DEV__) {
      console.tron?.error('Critical operation failed', error);
      DebugUtils.debugReactQuery.logCacheStats();
    }
  }
};
```

### 3. Performance Monitoring

```javascript
// Track query performance
const usePerformanceTrackedQuery = (queryKey, queryFn) => {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const startTime = Date.now();
      
      try {
        const result = await queryFn();
        const duration = Date.now() - startTime;
        
        if (__DEV__) {
          console.tron?.performance(`Query: ${JSON.stringify(queryKey)}`, duration, {
            queryKey,
            resultSize: JSON.stringify(result).length,
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        if (__DEV__) {
          console.tron?.error(`Query failed: ${JSON.stringify(queryKey)}`, {
            duration: `${duration}ms`,
            error: error.message,
          });
        }
        
        throw error;
      }
    },
  });
};
```

## Troubleshooting

### Common Issues

1. **Plugin Not Showing**: Ensure React Query plugin is properly configured in ReactotronConfig.js
2. **Queries Not Appearing**: Check that your QueryClient is properly passed to QueryClientManager
3. **Commands Not Working**: Verify that Reactotron is connected and the plugin is loaded

### Debug Steps

```javascript
// Verify plugin is working
console.tron?.reactQuery.logCache();

// Check if QueryClient is accessible
console.log('QueryClient:', queryClient);

// Verify queries exist
console.log('Query Cache:', queryClient.getQueryCache().getAll());
```

## Performance Considerations

- **Development Only**: All React Query debugging is automatically disabled in production
- **Memory Usage**: Monitor cache size in development to identify potential memory leaks
- **Network Impact**: Be aware that refetching all queries can generate significant network traffic

## Related Documentation

- [Reactotron Tips and Tricks Guide](./reactotron-tips-and-tricks.md)
- [Reactotron Global Error Tracking Guide](./reactotron-global-errors-guide.md)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools) 