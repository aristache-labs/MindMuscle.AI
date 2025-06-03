# Sentry Session Replay Usage Guide

## Overview

This guide demonstrates how to use Sentry's Session Replay for Mobile in the MindMuscle.AI React Native Expo app. Session Replay provides visual reproductions of user sessions to help debug issues and understand user behavior.

## Features Implemented

### 1. Session Replay Configuration

- **Frame Rate**: 1 frame per second (optimal for mobile performance)
- **Privacy Settings**: Configurable text, image, and vector masking
- **Sampling Rates**:
  - Development: 100% of sessions
  - Production: 10% of sessions, 100% of error sessions

### 2. Session Replay Utilities

#### User Interaction Tracking

```typescript
import { SentryDebug } from '@/services/sentry';

// Track user taps, swipes, scrolls, etc.
SentryDebug.sessionReplay.trackUserInteraction('tap', 'start-workout-button', 'workout-selection', {
  workout_id: 'workout_123',
});
```

#### Workout Session Context

```typescript
// Set workout context when starting a session
SentryDebug.sessionReplay.setWorkoutContext(
  'workout_123',
  'plan_456',
  8, // exercise count
  45, // estimated duration in minutes
);

// Track workout events
SentryDebug.sessionReplay.trackWorkoutEvent('start', 'workout_123', undefined, {
  user_id: 'user_789',
});

// Clear context when workout ends
SentryDebug.sessionReplay.clearWorkoutContext();
```

#### Network Request Monitoring

```typescript
// Track API calls for replay context
SentryDebug.sessionReplay.trackNetworkRequest(
  'POST',
  '/api/workouts',
  200,
  1250, // duration in ms
);

// Track failed requests
SentryDebug.sessionReplay.trackNetworkRequest(
  'GET',
  '/api/exercises',
  500,
  3000,
  'Internal Server Error',
);
```

#### App State Changes

```typescript
import { AppState } from 'react-native';

// Track app state changes
AppState.addEventListener('change', (nextAppState) => {
  SentryDebug.sessionReplay.trackAppStateChange(nextAppState);
});
```

## Integration Examples

### 1. Workout Session Screen

```typescript
// app/features/workout/screens/workout-session.tsx
import { SentryDebug } from '@/services/sentry';
import { useEffect } from 'react';

export default function WorkoutSessionScreen({ workoutId, planId }) {
  useEffect(() => {
    // Set workout context for replay
    SentryDebug.sessionReplay.setWorkoutContext(
      workoutId,
      planId,
      exercises.length,
      estimatedDuration,
    );

    // Track workout start
    SentryDebug.sessionReplay.trackWorkoutEvent('start', workoutId);

    return () => {
      // Clear context on unmount
      SentryDebug.sessionReplay.clearWorkoutContext();
    };
  }, [workoutId, planId]);

  const handleExerciseComplete = (exerciseId: string) => {
    // Track exercise completion
    SentryDebug.sessionReplay.trackWorkoutEvent('exercise_change', workoutId, exerciseId);
  };

  const handleWorkoutPause = () => {
    SentryDebug.sessionReplay.trackWorkoutEvent('pause', workoutId);
  };

  // ... rest of component
}
```

### 2. Navigation Tracking

```typescript
// app/_layout.tsx
import { SentryDebug } from '@/services/sentry';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = router.addListener('routeChange', (route) => {
      SentryDebug.sessionReplay.trackUserInteraction('navigation', route.name, 'app-navigation', {
        route_params: route.params,
      });
    });

    return unsubscribe;
  }, [router]);

  // ... rest of layout
}
```

### 3. User Authentication Context

```typescript
// app/store/AuthContext.tsx
import { SentryDebug } from '@/services/sentry';

export function AuthProvider({ children }) {
  const signIn = async (email: string) => {
    try {
      const user = await authService.signIn(email);

      // Set user context for replay
      SentryDebug.sessionReplay.setReplayUserContext(user.id, user.email, user.username);

      // Track successful login
      SentryDebug.sessionReplay.addReplayBreadcrumb('User signed in successfully', 'auth', {
        user_id: user.id,
      });
    } catch (error) {
      // Error will be automatically captured with replay context
      throw error;
    }
  };

  // ... rest of provider
}
```

### 4. Exercise Interaction Tracking

```typescript
// app/components/ExerciseCard.tsx
import { SentryDebug } from '@/services/sentry';

export function ExerciseCard({ exercise, onPress }) {
  const handlePress = () => {
    // Track exercise selection
    SentryDebug.sessionReplay.trackUserInteraction(
      'tap',
      `exercise-${exercise.id}`,
      'exercise-library',
      {
        exercise_name: exercise.name,
        muscle_group: exercise.muscle_group,
        difficulty: exercise.difficulty,
      },
    );

    onPress(exercise);
  };

  // ... rest of component
}
```

## Privacy and Security

### Default Privacy Settings

- **Text Masking**: Disabled (can be enabled for sensitive data)
- **Image Masking**: Disabled (can be enabled for user photos)
- **Vector Masking**: Disabled (can be enabled for diagrams)

### Enabling Privacy Protection

```typescript
// In app/services/sentry.ts, modify the mobileReplayIntegration:
Sentry.mobileReplayIntegration({
  maskAllText: true,     // Enable to redact all text
  maskAllImages: true,   // Enable to redact all images
  maskAllVectors: true,  // Enable to redact all vector graphics
}),
```

## Performance Considerations

### Optimizations Implemented

- **Frame Rate**: Limited to 1 FPS to minimize performance impact
- **Sampling**: Only 10% of production sessions recorded
- **Error Focus**: 100% of error sessions captured for debugging
- **Expo Go**: Session Replay disabled in Expo Go for compatibility

### Monitoring Performance Impact

```typescript
// Track performance impact of replay
SentryDebug.trackIOSPerformance('session_replay_overhead', replayProcessingTime, {
  frame_count: frameCount,
});
```

## Debugging with Session Replay

### What You'll See in Sentry

1. **Visual Playback**: 1 FPS video of user interactions
2. **Breadcrumbs**: Detailed timeline of user actions
3. **Network Requests**: All API calls with timing and status
4. **Error Context**: Exact user actions leading to errors
5. **Performance Data**: Transaction timing and spans
6. **Device Context**: Platform, app version, device info

### Key Benefits for MindMuscle.AI

- **Workout Issues**: See exactly how users interact with workout sessions
- **Navigation Problems**: Understand user flow and navigation issues
- **Performance Bottlenecks**: Identify slow operations during workouts
- **Error Reproduction**: Reproduce bugs with exact user context
- **User Experience**: Understand how users actually use the app

## Best Practices

### 1. Contextual Breadcrumbs

Always add relevant context to breadcrumbs:

```typescript
SentryDebug.sessionReplay.addReplayBreadcrumb('Exercise timer started', 'workout', {
  exercise_id: exerciseId,
  timer_duration: duration,
  set_number: currentSet,
});
```

### 2. User Journey Tracking

Track complete user journeys:

```typescript
// Start of workout flow
SentryDebug.sessionReplay.trackUserInteraction('tap', 'start-workout', 'home');
SentryDebug.sessionReplay.trackUserInteraction('navigation', 'workout-selection', 'app');
SentryDebug.sessionReplay.trackUserInteraction('tap', 'select-workout', 'workout-selection');
```

### 3. Error Context Enhancement

Provide rich context for errors:

```typescript
try {
  await saveWorkoutProgress(workoutData);
} catch (error) {
  // Add context before error is captured
  SentryDebug.sessionReplay.addReplayBreadcrumb('Failed to save workout progress', 'error', {
    workout_id: workoutData.id,
    exercise_count: workoutData.exercises.length,
    completion_percentage: workoutData.progress,
  });
  throw error; // Error will be captured with replay
}
```

## Troubleshooting

### Session Replay Not Working

1. **Check Expo Go**: Session Replay is disabled in Expo Go
2. **Verify DSN**: Ensure Sentry DSN is configured correctly
3. **Check Sampling**: Verify sampling rates in development vs production
4. **Platform Support**: Ensure you're using supported SDK versions

### Performance Issues

1. **Reduce Sampling**: Lower `replaysSessionSampleRate` in production
2. **Enable Privacy**: Use masking to reduce data processing
3. **Monitor Impact**: Track performance metrics during replay sessions

### Missing Context

1. **Add Breadcrumbs**: Ensure key user actions are tracked
2. **Set User Context**: Always set user information for authenticated sessions
3. **Workout Context**: Set workout-specific context for fitness-related issues

## SDK Version Requirements

- **iOS**: 8.43.0+
- **Android**: 7.20.0+
- **React Native**: 6.5.0+
- **Flutter**: 8.12.0+

Current implementation supports all required versions for comprehensive Session Replay functionality.
