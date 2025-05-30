# Sentry Tracing Implementation Guide

## Overview

This document outlines the comprehensive Sentry tracing implementation for the MindMuscle.AI React Native app, following the official [Sentry React Native Tracing documentation](https://docs.sentry.io/platforms/react-native/tracing/).

## Features Implemented

### 1. Basic Tracing Configuration

- **Traces Sample Rate**: Configured with environment-specific sampling
  - Development: 100% sampling (`tracesSampleRate: 1.0`)
  - Production: 20% sampling (`tracesSampleRate: 0.2`)
- **Profiles Sample Rate**: Performance profiling with lower production rates
  - Development: 100% profiling
  - Production: 10% profiling

### 2. Custom Tracing Utilities

The `SentryTracing` utility provides specialized tracking functions for different app features:

#### Workout Operations
```typescript
await SentryTracing.trackWorkoutOperation('start', workoutId, async () => {
  // Your workout start logic
  return await startWorkout(workoutId);
});
```

#### Exercise Operations
```typescript
await SentryTracing.trackExerciseOperation('complete_set', exerciseId, async () => {
  // Your exercise completion logic
  return await completeExerciseSet(exerciseId, setData);
});
```

#### Database Operations
```typescript
await SentryTracing.trackDatabaseOperation('insert', 'workout_sessions', async () => {
  // Your database operation
  return await database.insert('workout_sessions', sessionData);
});
```

#### API Calls
```typescript
await SentryTracing.trackApiCall('/api/ai-coaching', 'POST', async () => {
  // Your API call
  return await fetch('/api/ai-coaching', { method: 'POST', body: data });
});
```

#### Navigation Tracking
```typescript
// Track navigation events
SentryTracing.trackNavigation('WorkoutSession', { workoutId: '123' });
```

#### Performance Measurement
```typescript
await SentryTracing.measureAsync('complex_calculation', async () => {
  // Your performance-critical code
  return await performComplexCalculation();
}, { category: 'performance', tags: { feature: 'analytics' } });
```

### 3. Breadcrumb Integration

All tracking functions automatically create breadcrumbs for:
- Operation start/completion
- Performance timing
- Error tracking
- Navigation events

### 4. Error Context Enhancement

When errors occur, the tracking functions automatically:
- Capture timing information
- Add feature-specific tags
- Set relevant context data
- Create detailed breadcrumbs

## Usage Examples

### In Workout Components

```typescript
import { SentryTracing } from '@/services/sentry';

const WorkoutSession = () => {
  const startWorkout = async (workoutId: string) => {
    try {
      await SentryTracing.trackWorkoutOperation('start', workoutId, async () => {
        // Initialize workout session
        const session = await workoutService.startSession(workoutId);
        
        // Track navigation to workout screen
        SentryTracing.trackNavigation('WorkoutSession', { 
          workoutId, 
          sessionId: session.id 
        });
        
        return session;
      });
    } catch (error) {
      // Error is automatically captured with context
      console.error('Failed to start workout:', error);
    }
  };

  const completeExercise = async (exerciseId: string, setData: any) => {
    return await SentryTracing.trackExerciseOperation('complete_set', exerciseId, async () => {
      return await SentryTracing.trackDatabaseOperation('insert', 'exercise_sets', async () => {
        return await database.insertExerciseSet(setData);
      });
    });
  };

  return (
    // Your workout component JSX
  );
};
```

### In API Services

```typescript
import { SentryTracing } from '@/services/sentry';

export const aiCoachingService = {
  generateWorkoutPlan: async (userPreferences: any) => {
    return await SentryTracing.trackApiCall('/api/ai/workout-plan', 'POST', async () => {
      const response = await fetch('/api/ai/workout-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPreferences),
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      return await response.json();
    });
  },
};
```

### In Database Services

```typescript
import { SentryTracing } from '@/services/sentry';

export const workoutDatabase = {
  saveWorkoutSession: async (sessionData: WorkoutSession) => {
    return await SentryTracing.trackDatabaseOperation('insert', 'workout_sessions', async () => {
      const result = await database.insert('workout_sessions', sessionData);
      
      // Add performance mark for successful save
      SentryTracing.addPerformanceMark('workout_session_saved', {
        sessionId: result.id,
        exerciseCount: sessionData.exercises.length,
      });
      
      return result;
    });
  },
};
```

## Configuration Details

### Sample Rate Configuration

The tracing sample rate can be customized using the `tracesSampler` function for more granular control:

```typescript
// In sentry.ts - currently commented out but available
tracesSampler: (samplingContext) => {
  const { transactionContext } = samplingContext;
  
  // Sample critical transactions at higher rate
  if (transactionContext.name?.includes('workout') || 
      transactionContext.name?.includes('exercise')) {
    return 0.8; // 80% sampling for workout operations
  }
  
  // Sample navigation at medium rate
  if (transactionContext.op === 'navigation') {
    return 0.5; // 50% sampling for navigation
  }
  
  // Default sample rate
  return 0.2; // 20% for everything else
},
```

### Data Filtering

Sensitive data is automatically filtered in the `beforeSend` hook:
- Authorization headers
- Cookie headers
- Password query parameters
- Token query parameters

## Performance Considerations

1. **Sample Rates**: Production uses lower sample rates to reduce overhead
2. **Breadcrumbs**: Limited to 100 breadcrumbs maximum
3. **Automatic Cleanup**: Transactions auto-finish to prevent memory leaks
4. **Error Handling**: All tracking functions are non-blocking and won't crash the app

## Monitoring and Debugging

### Development Mode
- Full tracing enabled (100% sample rate)
- Console logging for transaction starts
- Debug mode enabled for detailed Sentry logs

### Production Mode
- Reduced sample rates for performance
- Error tracking with full context
- Performance monitoring for critical paths

## Integration with Existing Features

The tracing implementation integrates seamlessly with:
- **Workout System**: Track session start/end, exercise completion
- **Exercise Library**: Monitor exercise loading and interaction performance
- **AI Coaching**: Track API calls and response times
- **Database Operations**: Monitor query performance and errors
- **Navigation**: Track screen transitions and user flow

## Best Practices

1. **Use Specific Operation Names**: Be descriptive in operation names for better filtering
2. **Add Relevant Context**: Include IDs and relevant data in tracking calls
3. **Handle Errors Gracefully**: Let the tracking functions handle error capture
4. **Monitor Performance**: Use the timing data to identify bottlenecks
5. **Tag Appropriately**: Use consistent tags for feature-based filtering

## Troubleshooting

### Common Issues

1. **No Traces Appearing**: Check DSN configuration and sample rates
2. **Performance Impact**: Reduce sample rates in production
3. **Missing Context**: Ensure tracking functions wrap the relevant operations
4. **Error Spam**: Use appropriate error filtering in `beforeSend`

### Debug Commands

```typescript
// Check if Sentry is properly initialized
console.log('Sentry DSN:', Constants.expoConfig?.extra?.sentryDsn);

// Test breadcrumb creation
SentryTracing.addPerformanceMark('test_mark', { test: true });

// Test error capture with context
try {
  throw new Error('Test error');
} catch (error) {
  SentryDataCollection.captureException(error, { test_context: { value: 'test' } });
}
```

## Future Enhancements

1. **Custom Metrics**: Add custom performance metrics for specific app features
2. **User Journey Tracking**: Implement user flow tracking across screens
3. **Real User Monitoring**: Add RUM for production performance insights
4. **A/B Testing Integration**: Use Sentry data for feature flag decisions

## Related Documentation

- [Sentry Data Management](./sentry-data-management.md)
- [Sentry Setup Guide](./sentry-setup.md)
- [Performance Monitoring Best Practices](./performance-monitoring.md)

---

*Last updated: December 2024*
*Sentry React Native SDK Version: 6.14.0* 