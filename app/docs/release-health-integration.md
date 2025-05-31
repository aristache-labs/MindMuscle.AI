# Sentry Release Health Integration

This document explains how to use the comprehensive Release Health monitoring features implemented in MindMuscle.AI, based on [Sentry's Release Health documentation](https://docs.sentry.io/product/releases/health/).

## Overview

Release Health monitoring helps you track:

- **User Adoption**: How users are adopting new releases
- **Crash-Free Sessions**: Percentage of sessions without crashes
- **Session Duration**: How long users engage with your app
- **App Lifecycle**: Foreground/background transitions
- **Workout Sessions**: App-specific fitness tracking

## Features Implemented

### 1. Automatic Session Tracking

- ✅ Auto session tracking enabled
- ✅ Out of memory tracking
- ✅ Watchdog termination tracking
- ✅ App hang tracking
- ✅ Session duration monitoring

### 2. Release Health Utilities (`SentryReleaseHealth`)

- ✅ Session status tracking (healthy, errored, crashed, abnormal)
- ✅ User adoption metrics
- ✅ App lifecycle monitoring
- ✅ Crash and error tracking with release context
- ✅ Workout session tracking (app-specific)
- ✅ Adoption stage tracking

### 3. React Hook (`useReleaseHealth`)

- ✅ Automatic app lifecycle tracking
- ✅ Session duration monitoring
- ✅ User context management
- ✅ Manual tracking utilities

## Usage Examples

### Basic Integration in App Root

```typescript
// app/_layout.tsx or your root component
import { useReleaseHealth } from '../hooks/useReleaseHealth';
import { useAuth } from '../store/AuthContext';

export default function RootLayout() {
  const { user } = useAuth();

  // Initialize Release Health monitoring
  const releaseHealth = useReleaseHealth({
    userId: user?.id,
    environment: __DEV__ ? 'development' : 'production',
    trackAppLifecycle: true,
    trackSessionDuration: true,
  });

  return (
    // Your app content
  );
}
```

### Workout Session Tracking

```typescript
// In your workout session component
import { useReleaseHealth } from '../hooks/useReleaseHealth';

export function WorkoutSession({ workoutId }: { workoutId: string }) {
  const { trackWorkoutSession } = useReleaseHealth();
  const [startTime, setStartTime] = useState<number>();

  const startWorkout = () => {
    setStartTime(Date.now());
    trackWorkoutSession(workoutId, 'start');
  };

  const completeWorkout = () => {
    const duration = startTime ? Date.now() - startTime : undefined;
    trackWorkoutSession(workoutId, 'complete', duration);
  };

  const abandonWorkout = () => {
    const duration = startTime ? Date.now() - startTime : undefined;
    trackWorkoutSession(workoutId, 'abandon', duration);
  };

  return (
    // Your workout UI
  );
}
```

### Error Handling with Release Health

```typescript
// In any component where you handle errors
import { useReleaseHealth } from '../hooks/useReleaseHealth';

export function ExerciseComponent() {
  const { trackError, trackCrash } = useReleaseHealth();

  const handleApiError = async () => {
    try {
      await fetchExerciseData();
    } catch (error) {
      // Track handled errors
      trackError(error as Error, {
        component: 'ExerciseComponent',
        action: 'fetchExerciseData',
      });
    }
  };

  const handleCriticalError = (error: Error) => {
    // Track crashes that might terminate the session
    trackCrash(error, true, {
      component: 'ExerciseComponent',
      critical: true,
    });
  };

  return (
    // Your component UI
  );
}
```

### Manual Session Status Updates

```typescript
// Track session health based on user actions
import { SentryReleaseHealth } from '../services/sentry';

// When user successfully completes an important action
SentryReleaseHealth.trackSessionStatus('healthy', {
  action_completed: 'workout_finished',
  success: true,
});

// When user encounters non-critical errors
SentryReleaseHealth.trackSessionStatus('errored', {
  error_type: 'network_timeout',
  recoverable: true,
});

// When app experiences abnormal behavior
SentryReleaseHealth.trackAbnormalTermination('memory_pressure', {
  available_memory: '50MB',
  background_apps: 15,
});
```

### User Adoption Tracking

```typescript
// In your authentication flow
import { SentryReleaseHealth } from '../services/sentry';

const handleUserLogin = async (userId: string, isFirstLogin: boolean) => {
  // Track user adoption
  SentryReleaseHealth.trackUserAdoption(userId, isFirstLogin);

  // Set release health context for the session
  SentryReleaseHealth.setReleaseHealthContext(userId, 'production');
};
```

## Testing Release Health

Use the built-in testing utilities to verify your Release Health setup:

```typescript
// In development, test all Release Health features
import { SentryTesting } from '../services/sentry';

// Test individual Release Health features
SentryTesting.testReleaseHealth();

// Test all Sentry features including Release Health
SentryTesting.testAll();
```

## Dashboard Metrics

After implementing Release Health, you'll see these metrics in your Sentry dashboard:

### Session Metrics

- **Active Sessions**: Sessions started in the last 24 hours
- **Active Users**: Users who started the app in the last 24 hours
- **Session Duration**: Average time users spend in the app

### Crash Metrics

- **Crash-Free Sessions**: Percentage of sessions without crashes
- **Crash-Free Users**: Percentage of users who didn't experience crashes
- **Crashed Users**: Number of users who experienced crashes

### Adoption Metrics

- **Release Adoption**: Percentage of sessions using each release
- **Adoption Stage**: Whether release is "Adopted", "Low Adoption", or "Replaced"
- **User-Based Adoption**: Number of users on each release

### Session Status Distribution

- **Healthy**: Sessions that ended normally without errors
- **Errored**: Sessions with handled errors but no crashes
- **Crashed**: Sessions that ended due to unhandled errors
- **Abnormal**: Sessions terminated by the OS (timeouts, force quit)

## Best Practices

### 1. Session Status Tracking

- Mark sessions as `healthy` when users complete key actions
- Use `errored` for recoverable issues that don't crash the app
- Reserve `crashed` for unhandled exceptions
- Use `abnormal` for OS-level terminations

### 2. User Adoption

- Track new vs returning users accurately
- Update adoption stage based on usage patterns
- Monitor adoption trends across releases

### 3. Workout-Specific Tracking

- Track workout completion rates
- Monitor workout abandonment patterns
- Correlate workout success with app stability

### 4. Performance Monitoring

- Track session durations to understand engagement
- Monitor app lifecycle transitions
- Identify patterns in background/foreground usage

## Configuration

The Release Health features are automatically configured when you initialize Sentry:

```typescript
// Automatically enabled in app/services/sentry.ts
{
  autoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  enableAutoSessionTracking: true,
  enableOutOfMemoryTracking: true,
  enableWatchdogTerminationTracking: true,
  enableAppHangTracking: true,
}
```

## Troubleshooting

### No Release Health Data

1. Ensure `autoSessionTracking: true` in Sentry config
2. Verify release version is set correctly
3. Check that sessions are being started/ended properly

### Incorrect Session Status

1. Review session status tracking calls
2. Ensure proper error handling
3. Verify crash detection is working

### Missing User Adoption Data

1. Confirm user ID is being set
2. Check user adoption tracking calls
3. Verify new vs returning user logic

## Links

- [Sentry Release Health Documentation](https://docs.sentry.io/product/releases/health/)
- [React Native SDK Documentation](https://docs.sentry.io/platforms/react-native/)
- [Session Tracking Guide](https://docs.sentry.io/product/releases/health/#sessions)
