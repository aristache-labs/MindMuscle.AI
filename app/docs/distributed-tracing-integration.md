# Sentry Distributed Tracing Integration

This document explains how to use the comprehensive Distributed Tracing features implemented in MindMuscle.AI, based on [Sentry's Distributed Tracing documentation](https://docs.sentry.io/product/sentry-basics/distributed-tracing/initialize-sentry-sdk-frontend/).

## Overview

Distributed Tracing helps you track requests and operations across your entire application stack, providing insights into:

- **Performance Bottlenecks**: Identify slow operations and API calls
- **Error Propagation**: See how errors spread across services
- **User Journey Tracking**: Follow user interactions through your app
- **Service Dependencies**: Understand how different parts of your app interact
- **API Performance**: Monitor external service calls (Supabase, OpenAI, Firebase)

## Features Implemented

### 1. Automatic Tracing Configuration

- ✅ React Navigation integration with route change tracking
- ✅ HTTP client integration for API call tracing
- ✅ Automatic performance tracing enabled
- ✅ Trace propagation to external services
- ✅ Custom span creation and management

### 2. Distributed Tracing Utilities (`SentryDistributedTracing`)

- ✅ API call tracing with automatic error handling
- ✅ Navigation tracing with duration tracking
- ✅ Workout operation tracing (app-specific)
- ✅ Database operation tracing (Supabase)
- ✅ AI operation tracing (OpenAI)
- ✅ Custom operation tracing
- ✅ Transaction management
- ✅ Context and tag management

### 3. React Hook (`useDistributedTracing`)

- ✅ Automatic tracing initialization
- ✅ Service-specific tracing utilities
- ✅ Configuration management
- ✅ Context and tag management

## Configuration

The distributed tracing features are automatically configured in your Sentry initialization:

```typescript
// Automatically enabled in app/services/sentry.ts
{
  enableAutoPerformanceTracing: true,
  enableTracing: true,
  enableAutoInstrumentation: true,
  tracesSampleRate: isDevelopment ? 1.0 : 0.2,
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/[^/]*\.supabase\.co/,
    /^https:\/\/api\.openai\.com/,
    /^https:\/\/[^/]*\.firebase\.com/,
    /^https:\/\/[^/]*\.googleapis\.com/,
  ],
  integrations: [
    Sentry.reactNavigationIntegration({
      enableTimeToInitialDisplay: true,
      routeChangeTimeoutMs: 5000,
    }),
    Sentry.httpClientIntegration(),
  ],
}
```

## Usage Examples

### Basic Integration in App Root

```typescript
// app/_layout.tsx or your root component
import { useDistributedTracing } from '../hooks/useDistributedTracing';

export default function RootLayout() {
  // Initialize distributed tracing
  const tracing = useDistributedTracing({
    enableAutoTracing: true,
    traceNavigation: true,
    traceApiCalls: true,
  });

  return (
    // Your app content
  );
}
```

### API Call Tracing

```typescript
// In any component or service
import { useDistributedTracing } from '../hooks/useDistributedTracing';

export function ExerciseService() {
  const { traceApiCall } = useDistributedTracing();

  const fetchExercises = async () => {
    return await traceApiCall(
      'https://api.supabase.co/exercises',
      'GET',
      async () => {
        const response = await fetch('/api/exercises');
        return response.json();
      },
      {
        service: 'supabase',
        operation: 'fetch_exercises',
      },
    );
  };

  return { fetchExercises };
}
```

### Navigation Tracing

```typescript
// In your navigation components
import { useDistributedTracing } from '../hooks/useDistributedTracing';
import { useRouter } from 'expo-router';

export function NavigationComponent() {
  const { traceNavigation } = useDistributedTracing();
  const router = useRouter();

  const navigateToWorkout = () => {
    const startTime = Date.now();

    router.push('/workout');

    // Track navigation performance
    const duration = Date.now() - startTime;
    traceNavigation('home', 'workout', duration);
  };

  return (
    // Your navigation UI
  );
}
```

### Workout Operation Tracing

```typescript
// In your workout components
import { useDistributedTracing } from '../hooks/useDistributedTracing';

export function WorkoutSession({ workoutId }: { workoutId: string }) {
  const { traceWorkoutOperation } = useDistributedTracing();

  const startWorkout = async () => {
    await traceWorkoutOperation(
      workoutId,
      'start',
      async () => {
        // Initialize workout session
        await initializeWorkoutSession(workoutId);
        return { success: true };
      },
      {
        user_id: 'current_user',
        workout_type: 'strength_training',
      }
    );
  };

  const completeWorkout = async () => {
    await traceWorkoutOperation(
      workoutId,
      'complete',
      async () => {
        // Save workout results
        await saveWorkoutResults(workoutId);
        return { completed: true };
      }
    );
  };

  return (
    // Your workout UI
  );
}
```

### Database Operation Tracing

```typescript
// In your database services
import { useDistributedTracing } from '../hooks/useDistributedTracing';

export function useExerciseData() {
  const { traceSupabaseOperation } = useDistributedTracing();

  const createExercise = async (exerciseData: Exercise) => {
    return await traceSupabaseOperation('INSERT', 'exercises', async () => {
      const { data, error } = await supabase.from('exercises').insert(exerciseData);

      if (error) throw error;
      return data;
    });
  };

  const fetchUserExercises = async (userId: string) => {
    return await traceSupabaseOperation('SELECT', 'user_exercises', async () => {
      const { data, error } = await supabase
        .from('user_exercises')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    });
  };

  return { createExercise, fetchUserExercises };
}
```

### AI Operation Tracing

```typescript
// In your AI coaching services
import { useDistributedTracing } from '../hooks/useDistributedTracing';

export function useAICoaching() {
  const { traceOpenAiOperation } = useDistributedTracing();

  const generateWorkoutPlan = async (userPreferences: UserPreferences) => {
    return await traceOpenAiOperation('generate_workout_plan', 'gpt-4', async () => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: `Generate a workout plan for: ${JSON.stringify(userPreferences)}`,
          },
        ],
      });

      return response.choices[0].message.content;
    });
  };

  const analyzeWorkoutForm = async (exerciseVideo: string) => {
    return await traceOpenAiOperation('analyze_form', 'gpt-4-vision', async () => {
      // Analyze workout form using AI
      const analysis = await analyzeFormWithAI(exerciseVideo);
      return analysis;
    });
  };

  return { generateWorkoutPlan, analyzeWorkoutForm };
}
```

### Custom Operation Tracing

```typescript
// For any custom operations
import { SentryDistributedTracing } from '../services/sentry';

export async function processWorkoutData(workoutId: string) {
  return await SentryDistributedTracing.traceCustomOperation(
    'Process Workout Data',
    'data.processing',
    async () => {
      // Complex data processing
      const rawData = await fetchWorkoutData(workoutId);
      const processedData = await processData(rawData);
      const insights = await generateInsights(processedData);

      return { processedData, insights };
    },
    {
      workout_id: workoutId,
      processing_type: 'full_analysis',
    },
  );
}
```

### Manual Transaction Management

```typescript
// For complex operations that need manual transaction control
import { SentryDistributedTracing } from '../services/sentry';

export function ComplexWorkoutFlow() {
  const startComplexWorkout = async () => {
    const transaction = SentryDistributedTracing.startTransaction(
      'Complex Workout Flow',
      'workout.complex_flow',
      {
        user_id: 'current_user',
        flow_type: 'advanced_training',
      },
    );

    try {
      // Step 1: Initialize
      transaction.setData('step', 'initialize');
      await initializeWorkout();

      // Step 2: Load exercises
      transaction.setData('step', 'load_exercises');
      await loadExercises();

      // Step 3: Start session
      transaction.setData('step', 'start_session');
      await startSession();

      transaction.setStatus('ok');
    } catch (error) {
      transaction.setStatus('internal');
      throw error;
    } finally {
      transaction.finish();
    }
  };

  return { startComplexWorkout };
}
```

## Testing Distributed Tracing

Use the built-in testing utilities to verify your distributed tracing setup:

```typescript
// In development, test all distributed tracing features
import { SentryTesting } from '../services/sentry';

// Test distributed tracing specifically
await SentryTesting.testDistributedTracing();

// Test all Sentry features including distributed tracing
await SentryTesting.testAll();
```

## Dashboard Metrics

After implementing distributed tracing, you'll see these metrics in your Sentry dashboard:

### Performance Metrics

- **Transaction Throughput**: Number of transactions per minute
- **Average Response Time**: Average duration of operations
- **95th Percentile**: Response time for 95% of requests
- **Error Rate**: Percentage of failed transactions

### Trace Visualization

- **Waterfall Charts**: Visual representation of operation timing
- **Span Details**: Individual operation performance
- **Error Propagation**: How errors spread through operations
- **Service Dependencies**: Visual map of service interactions

### Operation Breakdown

- **API Calls**: Performance of external service calls
- **Database Operations**: Supabase query performance
- **AI Operations**: OpenAI API call performance
- **Navigation**: Screen transition performance
- **Workout Operations**: App-specific operation performance

## Best Practices

### 1. Trace Sampling

- Use higher sampling rates in development (100%)
- Use lower sampling rates in production (20%) to reduce overhead
- Increase sampling for critical operations

### 2. Span Naming

- Use descriptive, consistent naming conventions
- Include operation type and target (e.g., "DB SELECT: exercises")
- Avoid dynamic values in span names

### 3. Context and Tags

- Add relevant context to spans for debugging
- Use tags for filtering and grouping
- Include user and session information

### 4. Error Handling

- Always handle errors within traced operations
- Set appropriate span status based on outcome
- Include error details in span attributes

### 5. Performance Considerations

- Don't trace every single operation
- Focus on critical user journeys
- Use conditional tracing based on environment

## Troubleshooting

### No Trace Data

1. Verify `enableTracing: true` in Sentry config
2. Check trace sampling rates
3. Ensure operations are being called
4. Verify network connectivity to Sentry

### Missing Spans

1. Check if operations are properly wrapped
2. Verify span creation and finishing
3. Review error handling in traced operations

### Performance Impact

1. Reduce sampling rates in production
2. Limit traced operations to critical paths
3. Monitor application performance metrics

## Integration with Other Features

### Release Health

Distributed tracing works seamlessly with Release Health monitoring:

```typescript
// Combine tracing with release health
const { traceApiCall } = useDistributedTracing();
const { trackError } = useReleaseHealth();

const fetchData = async () => {
  try {
    return await traceApiCall('api/data', 'GET', fetchDataOperation);
  } catch (error) {
    trackError(error as Error, { operation: 'fetch_data' });
    throw error;
  }
};
```

### Session Replay

Traces are automatically correlated with Session Replay data for complete debugging context.

## Links

- [Sentry Distributed Tracing Documentation](https://docs.sentry.io/product/sentry-basics/distributed-tracing/initialize-sentry-sdk-frontend/)
- [React Native Performance Monitoring](https://docs.sentry.io/platforms/react-native/performance/)
- [Sentry Tracing API](https://docs.sentry.io/platforms/javascript/performance/instrumentation/)
