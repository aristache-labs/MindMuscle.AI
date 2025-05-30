# Reactotron API Monitoring Guide

This guide explains how to use Reactotron with the `reactotron-apisauce` plugin to monitor API calls in the MindMuscle.AI app.

## Setup

The `reactotron-apisauce` plugin is already configured in `ReactotronConfig.js` and will automatically monitor API calls when you use the provided utilities.

## API Monitor Utility

Use the `apiMonitor` utility from `app/utils/apiMonitor.ts` to wrap your API calls:

### Supabase Calls

```typescript
import { apiMonitor } from '../utils/apiMonitor';
import supabase from './supabase';

// Monitor workout data operations
const getWorkouts = async (userId: string) => {
  return apiMonitor.monitorSupabaseCall(
    'select',
    'workouts',
    () => supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId),
    { userId }
  );
};

// Monitor exercise records
const getExerciseRecords = async (exerciseId: string) => {
  return apiMonitor.monitorSupabaseCall(
    'select',
    'user_exercise_records',
    () => supabase
      .from('user_exercise_records')
      .select('*')
      .eq('exercise_id', exerciseId),
    { exerciseId }
  );
};

// Monitor workout plan creation
const createWorkoutPlan = async (planData: any) => {
  return apiMonitor.monitorSupabaseCall(
    'insert',
    'workout_plans',
    () => supabase
      .from('workout_plans')
      .insert(planData),
    planData
  );
};
```

### Firebase Storage Calls

```typescript
import { apiMonitor } from '../utils/apiMonitor';

// Monitor progress photo uploads
const uploadProgressPhoto = async (photoUri: string, userId: string) => {
  return apiMonitor.monitorFetch(`firebase://storage/progress-photos/${userId}`, {
    method: 'POST',
    body: photoUri,
  });
};
```

### Generic Fetch Calls

```typescript
import { apiMonitor } from '../utils/apiMonitor';

const fetchExerciseData = async (url: string) => {
  return apiMonitor.monitorFetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
```

### Manual Logging

For cases where you can't wrap the API call, use manual logging:

```typescript
import { apiMonitor } from '../utils/apiMonitor';

const syncWorkoutData = async () => {
  const startTime = Date.now();
  try {
    const response = await fetch('/api/sync-workout');
    const data = await response.json();
    
    apiMonitor.logApiCall(
      'POST',
      '/api/sync-workout',
      null,
      { status: response.status, data },
      Date.now() - startTime
    );
    
    return data;
  } catch (error) {
    apiMonitor.logApiCall(
      'POST',
      '/api/sync-workout',
      null,
      { error },
      Date.now() - startTime
    );
    throw error;
  }
};
```

## Reactotron Logger Integration

Use the enhanced Reactotron logger for additional API logging:

```typescript
import { logSupabaseCall, logApiCall } from '../utils/reactotronLogger';

// Log Supabase operations
logSupabaseCall('select', 'workouts', { userId: '123' });
logSupabaseCall('insert', 'exercise_records', { exerciseId: 'abc' });

// Log generic API calls
logApiCall('/api/exercises', 'GET', { category: 'strength' });
```

## What You'll See in Reactotron

When API monitoring is active, you'll see:

1. **Request Details**: Method, URL, headers, and request body
2. **Response Data**: Status code, response body, and timing
3. **Error Information**: Error details if the request fails
4. **Performance Metrics**: Request duration and timing

## Configuration Options

The apisauce plugin is configured in `ReactotronConfig.js` with:

```javascript
apisaucePlugin({
  // Skip printing the body of image requests to keep logs clean
  ignoreContentTypes: /^(image)\/.*$/i,
})
```

## Best Practices

1. **Truncate Large Payloads**: For logging purposes, truncate large request/response bodies
2. **Sensitive Data**: Avoid logging sensitive information like passwords or tokens
3. **Development Only**: API monitoring only works in development mode (`__DEV__`)
4. **Performance**: The monitoring adds minimal overhead but be mindful in performance-critical paths

## Common Use Cases in MindMuscle.AI

- **Workout Data Sync**: Monitor Supabase calls for workout sessions and exercise records
- **Progress Photos**: Track Firebase storage uploads and downloads
- **Exercise Library**: Monitor exercise data fetching and caching
- **User Measurements**: Track measurement data operations
- **Authentication**: Monitor auth-related API calls

## Troubleshooting

- Ensure Reactotron desktop app is running and connected
- Check that `__DEV__` is true
- Verify the apisauce plugin is properly configured
- Look for console logs indicating Reactotron connection status 