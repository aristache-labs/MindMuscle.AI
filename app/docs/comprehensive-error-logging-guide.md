# Comprehensive Error Logging Guide for MindMuscle.AI

This guide shows you how to capture all errors, warnings, and issues from every file and folder in your MindMuscle.AI project and send them to Sentry.

## Overview

The error logging system consists of:

1. **SimpleErrorHandler** - Core error handling and automatic capture
2. **ErrorLogger Utility** - Easy-to-use functions for manual logging
3. **Automatic Capture** - Unhandled errors, promise rejections, and crashes
4. **Category-based Logging** - Specific handlers for different types of errors

## Quick Start

### 1. Basic Error Logging

```typescript
import { logError, logWarning, logInfo } from '../utils/errorLogger';

// Log an error
try {
  // Some risky operation
  throw new Error('Something went wrong');
} catch (error) {
  logError(error as Error, {
    component: 'MyComponent',
    screen: 'HomeScreen',
    userId: user?.id,
  });
}

// Log a warning
logWarning('User attempted invalid action', {
  action: 'delete_workout',
  userId: user?.id,
});

// Log info message
logInfo('User completed workout', {
  workoutId: 'workout_123',
  duration: 1800,
});
```

### 2. Category-Specific Logging

```typescript
import {
  logNavigationError,
  logDatabaseError,
  logAuthError,
  logWorkoutError,
  logUIError,
  logNetworkError,
  logStorageError,
  logAPIError,
  logValidationError,
  logPerformanceIssue,
} from '../utils/errorLogger';

// Navigation errors
try {
  router.push('/invalid-route');
} catch (error) {
  logNavigationError(error as Error, '/home', '/invalid-route');
}

// Database errors
try {
  await database.insert('users', userData);
} catch (error) {
  logDatabaseError(error as Error, 'users', 'insert');
}

// Authentication errors
try {
  await signIn(email, password);
} catch (error) {
  logAuthError(error as Error, 'sign_in');
}

// Workout errors
try {
  await saveWorkoutProgress(workoutData);
} catch (error) {
  logWorkoutError(error as Error, workoutData.id, exerciseData.id);
}

// UI errors
try {
  setModalVisible(true);
} catch (error) {
  logUIError(error as Error, 'WorkoutModal', 'WorkoutScreen');
}

// Network errors
try {
  const response = await fetch('/api/workouts');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (error) {
  logNetworkError(error as Error, '/api/workouts', 'GET', 500);
}

// Storage errors
try {
  await AsyncStorage.setItem('user_data', JSON.stringify(userData));
} catch (error) {
  logStorageError(error as Error, 'AsyncStorage', 'setItem');
}

// API errors
try {
  const data = await openAIService.generateWorkout(prompt);
} catch (error) {
  logAPIError(error as Error, '/v1/chat/completions', 'OpenAI');
}

// Validation errors
try {
  validateWorkoutForm(formData);
} catch (error) {
  logValidationError(error as Error, 'duration', formData.duration);
}

// Performance issues
if (loadTime > 3000) {
  logPerformanceIssue('Slow screen load', 'screen_load_time', loadTime);
}
```

### 3. Utility Functions for Common Scenarios

```typescript
import {
  logTryCatchError,
  logAsyncError,
  logComponentError,
  logHookError,
  logServiceError,
  logUserActionError,
  logFormValidationError,
  logDataLoadingError,
  logTimeoutError,
  addDebugBreadcrumb,
} from '../utils/errorLogger';

// Try-catch errors
try {
  processWorkoutData(data);
} catch (error) {
  logTryCatchError(error, 'processWorkoutData', {
    dataSize: data.length,
  });
}

// Async operation errors
const loadWorkouts = async () => {
  try {
    const workouts = await workoutService.getAll();
    return workouts;
  } catch (error) {
    logAsyncError(error, 'loadWorkouts', {
      userId: user?.id,
    });
    return [];
  }
};

// Component lifecycle errors
useEffect(() => {
  try {
    initializeComponent();
  } catch (error) {
    logComponentError(error as Error, 'WorkoutComponent', 'mount', { workoutId });
  }
}, []);

// Hook errors
const useWorkoutData = (workoutId: string) => {
  try {
    // Hook logic
    return data;
  } catch (error) {
    logHookError(error as Error, 'useWorkoutData', { workoutId });
    return null;
  }
};

// Service errors
class WorkoutService {
  async createWorkout(data: WorkoutData) {
    try {
      return await this.api.post('/workouts', data);
    } catch (error) {
      logServiceError(error as Error, 'WorkoutService', 'createWorkout', {
        workoutType: data.type,
      });
      throw error;
    }
  }
}

// User action errors
const handleDeleteWorkout = async (workoutId: string) => {
  try {
    await deleteWorkout(workoutId);
  } catch (error) {
    logUserActionError(error as Error, 'delete_workout', 'WorkoutListScreen', { workoutId });
  }
};

// Form validation errors
const validateForm = (formData: FormData) => {
  try {
    if (!formData.name) {
      throw new Error('Name is required');
    }
  } catch (error) {
    logFormValidationError(error as Error, 'WorkoutForm', 'name', formData.name);
  }
};

// Data loading errors
const loadUserData = async () => {
  try {
    return await userService.getCurrentUser();
  } catch (error) {
    logDataLoadingError(error as Error, 'user_profile', 'api', { endpoint: '/user/profile' });
    return null;
  }
};

// Timeout errors
const fetchWithTimeout = async (url: string, timeoutMs: number = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logTimeoutError('API request', timeoutMs, { url });
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Debug breadcrumbs for tracking user flow
const handleUserAction = (action: string) => {
  addDebugBreadcrumb(`User performed action: ${action}`, {
    timestamp: new Date().toISOString(),
    screen: 'WorkoutScreen',
    action,
  });
};
```

### 4. Setting Context for Better Debugging

```typescript
import {
  setUserContext,
  setCurrentScreen,
  setCurrentComponent
} from '../utils/errorLogger';

// Set user context when user logs in
const handleLogin = async (user: User) => {
  setUserContext(user.id, user.email, user.username);
};

// Set current screen in navigation
const WorkoutScreen = () => {
  useEffect(() => {
    setCurrentScreen('WorkoutScreen');
  }, []);

  return (
    // Screen content
  );
};

// Set current component in complex components
const WorkoutTimer = () => {
  useEffect(() => {
    setCurrentComponent('WorkoutTimer');
  }, []);

  return (
    // Component content
  );
};
```

## Implementation Examples by File Type

### React Components

```typescript
// app/components/WorkoutCard.tsx
import React from 'react';
import { logUIError, setCurrentComponent, addDebugBreadcrumb } from '../utils/errorLogger';

const WorkoutCard = ({ workout }: { workout: Workout }) => {
  useEffect(() => {
    setCurrentComponent('WorkoutCard');
  }, []);

  const handlePress = () => {
    try {
      addDebugBreadcrumb('User tapped workout card', {
        workoutId: workout.id,
        workoutType: workout.type
      });

      // Navigation logic
      router.push(`/workout/${workout.id}`);
    } catch (error) {
      logUIError(error as Error, 'WorkoutCard', 'WorkoutListScreen');
    }
  };

  return (
    // Component JSX
  );
};
```

### Services

```typescript
// app/services/workoutService.ts
import { logServiceError, logAPIError, logDatabaseError } from '../utils/errorLogger';

export class WorkoutService {
  async getWorkouts(): Promise<Workout[]> {
    try {
      const response = await fetch('/api/workouts');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError) {
        logAPIError(error, '/api/workouts', 'WorkoutService');
      } else {
        logServiceError(error as Error, 'WorkoutService', 'getWorkouts');
      }
      throw error;
    }
  }

  async saveWorkout(workout: Workout): Promise<void> {
    try {
      await database.insert('workouts', workout);
    } catch (error) {
      logDatabaseError(error as Error, 'workouts', 'insert');
      throw error;
    }
  }
}
```

### Hooks

```typescript
// app/hooks/useWorkoutData.ts
import { logHookError, logDataLoadingError } from '../utils/errorLogger';

export const useWorkoutData = (workoutId: string) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const workoutData = await workoutService.getWorkout(workoutId);
        setData(workoutData);
      } catch (err) {
        logDataLoadingError(err as Error, 'workout_data', 'api', { workoutId });
        setError(err);
      }
    };

    loadData().catch((err) => {
      logHookError(err as Error, 'useWorkoutData', { workoutId });
    });
  }, [workoutId]);

  return { data, error };
};
```

### Context Providers

```typescript
// app/store/WorkoutContext.tsx
import { logError, logWarning } from '../utils/errorLogger';

export const WorkoutProvider = ({ children }: { children: React.ReactNode }) => {
  const [workouts, setWorkouts] = useState([]);

  const addWorkout = async (workout: Workout) => {
    try {
      await workoutService.create(workout);
      setWorkouts(prev => [...prev, workout]);
    } catch (error) {
      logError(error as Error, {
        category: 'workout_error',
        component: 'WorkoutProvider',
        operation: 'addWorkout',
        workoutType: workout.type
      });
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    try {
      await workoutService.delete(workoutId);
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));
    } catch (error) {
      logWarning('Failed to delete workout', {
        category: 'workout_error',
        component: 'WorkoutProvider',
        workoutId
      });
    }
  };

  return (
    <WorkoutContext.Provider value={{ workouts, addWorkout, deleteWorkout }}>
      {children}
    </WorkoutContext.Provider>
  );
};
```

### Utility Functions

```typescript
// app/utils/workoutCalculations.ts
import { logError, logPerformanceIssue } from './errorLogger';

export const calculateWorkoutStats = (exercises: Exercise[]) => {
  const startTime = Date.now();

  try {
    // Complex calculations
    const stats = performCalculations(exercises);

    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logPerformanceIssue('Slow workout calculation', 'calculation_time', duration);
    }

    return stats;
  } catch (error) {
    logError(error as Error, {
      category: 'performance_error',
      component: 'workoutCalculations',
      exerciseCount: exercises.length,
    });
    return null;
  }
};
```

## Automatic Error Capture

The system automatically captures:

1. **Unhandled Promise Rejections**
2. **Global JavaScript Errors**
3. **React Error Boundary Errors**
4. **Navigation Errors**
5. **Network Request Failures**

No additional code needed - these are captured automatically when the error handler is initialized.

## Testing Error Logging

```typescript
import { testErrorLogging } from '../utils/errorLogger';

// Test all error logging functionality
testErrorLogging();
```

## Best Practices

### 1. Always Include Context

```typescript
// Good
logError(error, {
  component: 'WorkoutTimer',
  screen: 'WorkoutScreen',
  workoutId: workout.id,
  userId: user.id,
});

// Bad
logError(error);
```

### 2. Use Appropriate Log Levels

```typescript
// Use logError for actual errors
logError(new Error('Failed to save workout'));

// Use logWarning for recoverable issues
logWarning('Workout data incomplete, using defaults');

// Use logInfo for important events
logInfo('User completed workout');
```

### 3. Add Breadcrumbs for User Flow

```typescript
const handleWorkoutStart = () => {
  addDebugBreadcrumb('User started workout', {
    workoutId: workout.id,
    exerciseCount: workout.exercises.length,
  });
};
```

### 4. Set Context Early

```typescript
// In your main app component
useEffect(() => {
  if (user) {
    setUserContext(user.id, user.email, user.username);
  }
}, [user]);
```

### 5. Use Category-Specific Functions

```typescript
// Use specific functions for better categorization
logDatabaseError(error, 'users', 'update'); // Better than logError
logNetworkError(error, '/api/workouts', 'POST', 500); // Better than logError
```

## Viewing Errors in Sentry

1. Go to your Sentry dashboard
2. Navigate to Issues to see all errors
3. Use tags to filter by:
   - `error_category` (navigation_error, database_error, etc.)
   - `component` (specific component name)
   - `screen` (current screen)
   - `platform` (ios/android)
   - `session_id` (unique session identifier)

## Performance Considerations

- Errors are batched and sent asynchronously
- Large objects are automatically truncated
- Breadcrumbs are limited to 100 entries
- Sampling rates can be configured for production

## Troubleshooting

### No Errors Appearing in Sentry

1. Check Sentry DSN configuration in `app.json`
2. Verify network connectivity
3. Check console for Sentry initialization messages
4. Test with `testErrorLogging()`

### Too Many Errors

1. Adjust sampling rates in production
2. Filter out known non-critical errors
3. Use appropriate log levels (info vs error)

### Missing Context

1. Ensure `setUserContext()` is called after login
2. Use `setCurrentScreen()` in navigation
3. Include relevant data in error context

This comprehensive error logging system ensures that all issues in your MindMuscle.AI app are captured and sent to Sentry for monitoring and debugging.
