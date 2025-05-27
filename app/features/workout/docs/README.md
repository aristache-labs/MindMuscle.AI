# Workout Feature

A comprehensive workout session management system built with React Native and Expo, featuring AI coaching, exercise customization, progress tracking, and advanced workout analytics.

## 🏗️ Architecture

This feature follows a **hooks-based architecture** that separates business logic from UI components, making the code more maintainable, testable, and reusable.

### Core Principles

- **Separation of Concerns**: Business logic in hooks, UI logic in components
- **Single Responsibility**: Each hook handles one specific aspect of workout functionality
- **Composability**: Hooks can be combined to create complex workflows
- **Type Safety**: Full TypeScript support with comprehensive interfaces

## 🔧 Hooks Overview

### State Management Hooks

#### `useWorkoutState`
Central state management for the entire workout session.

```typescript
const workoutState = useWorkoutState({
  planId: 'plan-123',
  workoutDay: 1,
  cycleWeek: 1,
  weekName: 'Adaptation'
});
```

**Manages:**
- Exercise data and current exercise index
- Exercise sets and totals (volume, reps)
- Recommendations and last exercise values
- Modal states and UI interactions
- Keyboard handling and input focus

#### `useWorkoutTimer`
Handles workout and rest timer functionality.

```typescript
const timer = useWorkoutTimer();
// timer.startWorkoutTimer(), timer.startRestTimer(60), timer.formatTime()
```

### Business Logic Hooks

#### `useExerciseSets`
Manages exercise set completion, auto-fill logic, and value calculations.

```typescript
const exerciseSets = useExerciseSets({
  exercises,
  currentExerciseIndex,
  recommendations,
  // ... other params
});
// exerciseSets.handleSetComplete(), exerciseSets.handleLogAllSets()
```

#### `useWorkoutNavigation`
Handles exercise navigation and workout progress tracking.

```typescript
const navigation = useWorkoutNavigation({
  exercises,
  currentExerciseIndex,
  setCurrentExerciseIndex,
  exerciseSets,
  onWorkoutComplete
});
// navigation.moveToNextExercise(), navigation.getWorkoutProgress()
```

#### `useExerciseCustomization`
Manages exercise customization (sets, reps ranges, etc.).

```typescript
const customization = useExerciseCustomization({
  exercises,
  setExercises,
  exerciseSets,
  setExerciseSets,
  // ... other params
});
// customization.customizeExercise(exerciseId, { sets: 4, reps_range: "8-12" })
```

#### `useWorkoutCompletion`
Handles workout completion, statistics calculation, and data persistence.

```typescript
const completion = useWorkoutCompletion({
  planId,
  workoutDay,
  exercises,
  exerciseSets,
  totalVolume,
  totalReps,
  // ... other params
});
// completion.completeWorkout(), completion.redoWorkout()
```

## 🚀 Quick Start

### Basic Integration

```typescript
export function WorkoutSessionScreen() {
  // 1. Get route parameters
  const params = useLocalSearchParams();
  const { planId, workoutDay, cycleWeek, weekName } = params;

  // 2. Initialize core state
  const workoutState = useWorkoutState({ planId, workoutDay, cycleWeek, weekName });
  const timer = useWorkoutTimer();

  // 3. Initialize business logic hooks
  const navigation = useWorkoutNavigation({ /* ... */ });
  const customization = useExerciseCustomization({ /* ... */ });
  const completion = useWorkoutCompletion({ /* ... */ });
  const exerciseSets = useExerciseSets({ /* ... */ });

  // 4. Render UI using hook data and functions
  return (
    <View>
      {/* Your UI components */}
    </View>
  );
}
```

### Advanced Usage

For a complete example, see [`examples/WorkoutSessionExample.tsx`](./examples/WorkoutSessionExample.tsx).

## 📁 File Structure

```
app/features/workout/
├── hooks/                          # Business logic hooks
│   ├── index.ts                    # Exports all hooks
│   ├── useWorkoutState.ts          # State management
│   ├── useWorkoutTimer.ts          # Timer functionality
│   ├── useExerciseSets.ts          # Set management
│   ├── useWorkoutNavigation.ts     # Exercise navigation
│   ├── useExerciseCustomization.ts # Exercise customization
│   └── useWorkoutCompletion.ts     # Workout completion
├── components/                     # UI components
│   ├── WorkoutHeader.tsx
│   ├── WorkoutExerciseCard.tsx
│   ├── WorkoutExerciseSetRow.tsx
│   ├── WorkoutTimerTabs.tsx
│   ├── WorkoutWarmupModal.tsx
│   └── WorkoutExitModal.tsx
├── screens/                        # Screen components
│   └── workout-session.tsx         # Main workout screen
├── types/                          # TypeScript definitions
│   └── index.ts
├── utils/                          # Utility functions
├── docs/                           # Documentation
│   ├── README.md                   # This file
│   └── workout-hooks-refactor.md   # Refactor details
└── examples/                       # Example implementations
    └── WorkoutSessionExample.tsx   # Complete hook integration example
```

## 🧪 Testing

Each hook can be tested independently:

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useWorkoutState } from '../hooks/useWorkoutState';

test('should initialize workout state correctly', () => {
  const { result } = renderHook(() => useWorkoutState({
    planId: 'test-plan',
    workoutDay: 1,
    cycleWeek: 1,
    weekName: 'Test Week'
  }));

  expect(result.current.isLoading).toBe(true);
  expect(result.current.exercises).toEqual([]);
  expect(result.current.currentExerciseIndex).toBe(0);
});
```

## 🔄 Migration from Legacy Code

The original workout session component (1962 lines) has been refactored using these hooks:

### Before (Monolithic Component)
```typescript
export default function WorkoutSessionScreen() {
  // 20+ useState hooks
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  // ... 17+ more useState hooks

  // Complex business logic mixed with UI
  const handleSetComplete = (exerciseId, setIndex) => {
    // 100+ lines of complex logic
  };

  // 1900+ lines of mixed logic and UI
  return (/* Complex JSX */);
}
```

### After (Hook-Based Architecture)
```typescript
export default function WorkoutSessionScreen() {
  // Clean, focused hooks
  const workoutState = useWorkoutState(params);
  const timer = useWorkoutTimer();
  const navigation = useWorkoutNavigation(params);
  const customization = useExerciseCustomization(params);
  const completion = useWorkoutCompletion(params);
  const exerciseSets = useExerciseSets(params);

  // UI-focused component
  return (/* Clean JSX using hook data */);
}
```

## 🏆 Benefits

- **📊 Reduced Complexity**: Main component reduced from 1962 lines to ~200 lines
- **🧪 Better Testing**: Each hook can be unit tested independently
- **⚡ Performance**: Better memoization and reduced re-renders
- **🔄 Reusability**: Hooks can be used in other workout components
- **🛠️ Maintainability**: Clear separation of concerns
- **📱 Developer Experience**: Better IDE support and debugging

## 📚 API Reference

For detailed API documentation of each hook, see their respective TypeScript interfaces in the hook files.

## 🤝 Contributing

When adding new workout functionality:

1. **Follow the hook pattern**: Create focused, single-responsibility hooks
2. **Maintain type safety**: Use TypeScript interfaces for all parameters
3. **Add tests**: Unit tests for hooks, integration tests for combinations
4. **Update documentation**: Keep this README and hook interfaces up to date

## 🐛 Troubleshooting

### Common Issues

1. **State not updating**: Ensure all hooks are properly connected with correct parameters
2. **TypeScript errors**: Check that all required properties are included in hook parameters
3. **Performance issues**: Use React DevTools to check for unnecessary re-renders

### Debug Mode

Enable debug logging in development:

```typescript
const workoutState = useWorkoutState(params);
console.log('Workout State:', workoutState); // Debug current state
```

## 🔧 Exercise Switching and Paused Workout Display

### Issue Description

When a user switches an exercise during a workout session and then pauses the workout, the `my-plan.tsx` screen was showing the original exercise name instead of the switched exercise name in the paused workout section.

### Root Cause

The issue was in the `renderExerciseItem` function in `my-plan.tsx`. When displaying paused workout information:

1. **Correct Data Storage**: The switched exercise data was being correctly saved to the database with the `isChangedExercise: true` flag
2. **Correct Data Retrieval**: The `updatePausedWorkoutWithCustomizations` function was correctly preserving switched exercise data
3. **Display Issue**: The UI was using `item.name` (original exercise) instead of `pausedExercise.name` (switched exercise)

### The Fix

**Before (Incorrect)**:
```typescript
// Finding paused exercise with OR condition
const pausedExerciseIndex = pausedWorkout.exercises.findIndex(
  (e: any) => e.id === item.id || e.exercise_id === item.exercise_id  // Problem: could match wrong exercise
);

// Using original exercise data for display
<Text>{item.name}</Text>  // Always showed original exercise name
```

**After (Fixed)**:
```typescript
// Finding paused exercise by ID only (same workout plan slot)
const pausedExerciseIndex = pausedWorkout.exercises.findIndex(
  (e: any) => e.id === item.id  // Correct: matches by workout plan exercise slot
);

// Using paused exercise data for display
let displayName = item.name;
let displayImageUrl = item.image_url;
let displayPrimaryMuscles = item.primary_muscles;

if (pausedExerciseIndex !== -1) {
  const pausedExercise = pausedWorkout.exercises[pausedExerciseIndex];
  displayName = pausedExercise.name || item.name;  // Use switched exercise name
  displayImageUrl = pausedExercise.image_url || item.image_url;
  displayPrimaryMuscles = pausedExercise.primary_muscles || item.primary_muscles;
}

<Text>{displayName}</Text>  // Now shows correct exercise name
```

### Key Changes Made

1. **Simplified Exercise Matching**: Only match by `e.id === item.id` (workout plan exercise slot)
2. **Added Display Variables**: Created `displayName`, `displayImageUrl`, and `displayPrimaryMuscles` variables
3. **Prioritized Paused Data**: Use paused exercise data when available, fallback to original exercise data
4. **Updated UI Rendering**: Use display variables instead of original `item` properties throughout the component

### Files Modified

- `app/(stack)/my-plan.tsx` - Fixed `renderExerciseItem` function to properly display switched exercise data

### Testing

To test this fix:

1. Start a workout session
2. Switch an exercise to a different exercise
3. Pause the workout
4. Navigate back to My Plan screen
5. Verify that the paused workout section shows the switched exercise name, image, and muscle groups
6. Resume the workout to ensure the switched exercise is correctly loaded

### Related Functions

- `updatePausedWorkoutWithCustomizations()` - Preserves switched exercise data when updating from database
- `savePausedWorkout()` - Saves switched exercise data with `isChangedExercise` flag
- `getPausedWorkout()` - Properly handles `isChangedExercise` flag when retrieving from database
- `handleExerciseChange()` - Marks exercises as switched with `isChangedExercise: true` flag 