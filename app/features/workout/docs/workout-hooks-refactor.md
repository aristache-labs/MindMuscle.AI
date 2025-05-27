# Workout Feature Hooks Refactor

## Overview

The workout session functionality has been significantly improved by extracting complex business logic into specialized hooks. This refactor addresses the main issues with the original 1962-line workout session component.

## Problems Solved

### 1. **State Management Complexity**
- **Before**: 20+ useState hooks cluttering the main component
- **After**: Organized state management through `useWorkoutState` hook

### 2. **Mixed Business Logic & UI**
- **Before**: Complex workout logic mixed with UI rendering
- **After**: Clean separation through specialized hooks

### 3. **Exercise Navigation Complexity**
- **Before**: Complex navigation logic embedded in the main component
- **After**: Dedicated `useWorkoutNavigation` hook

### 4. **Exercise Customization Issues**
- **Before**: Incomplete and scattered customization logic
- **After**: Comprehensive `useExerciseCustomization` hook

### 5. **Workout Completion Logic**
- **Before**: Multiple completion paths that were hard to follow
- **After**: Unified `useWorkoutCompletion` hook

## New Hooks Architecture

### `useWorkoutState`
**Purpose**: Centralized state management for the entire workout session.

**Key Features**:
- Manages all workout-related state (exercises, sets, totals, etc.)
- Provides helper functions for common operations
- Includes reset functionality for workout restart
- Organizes modal states and UI interactions

```typescript
const workoutState = useWorkoutState({
  planId,
  workoutDay,
  cycleWeek,
  weekName
});
```

### `useWorkoutNavigation`
**Purpose**: Handles all exercise navigation and progress tracking.

**Key Features**:
- Move between exercises with proper validation
- Calculate workout progress percentage
- Handle workout completion when reaching the end
- Move exercises to different positions

```typescript
const navigation = useWorkoutNavigation({
  exercises,
  currentExerciseIndex,
  setCurrentExerciseIndex,
  exerciseSets,
  onWorkoutComplete
});
```

### `useExerciseCustomization`
**Purpose**: Manages exercise customization (sets, reps, etc.).

**Key Features**:
- Modify exercise properties (sets count, reps range)
- Update exercise sets when customization changes
- Track which exercises have been customized
- Reset customizations when needed

```typescript
const customization = useExerciseCustomization({
  exercises,
  setExercises,
  exerciseSets,
  setExerciseSets,
  exerciseCustomized,
  setExerciseCustomized,
  userEnteredValues,
  setUserEnteredValues,
  textInputRefreshKey,
  setTextInputRefreshKey
});
```

### `useWorkoutCompletion`
**Purpose**: Handles workout completion logic and data persistence.

**Key Features**:
- Calculate workout statistics (volume, reps, calories, duration)
- Save workout data to database
- Handle different completion scenarios
- Provide redo workout functionality

```typescript
const completion = useWorkoutCompletion({
  planId,
  workoutDay,
  cycleWeek,
  weekName,
  exercises,
  exerciseSets,
  totalVolume,
  totalReps,
  workoutDuration,
  workoutStartTime,
  onNavigateHome
});
```

### Existing Hooks (Enhanced)

#### `useWorkoutTimer`
- Already handles workout and rest timer functionality
- No changes needed - working well

#### `useExerciseSets`
- Handles set completion, weight/reps changes, auto-fill logic
- Already well-structured - no changes needed

## Benefits of This Refactor

### 1. **Improved Testability**
- Each hook can be tested independently
- Business logic is separated from UI concerns
- Easier to mock dependencies for testing

### 2. **Better Code Organization**
- Related functionality grouped together
- Clear separation of concerns
- Easier to understand and maintain

### 3. **Reusability**
- Hooks can be reused in other workout-related components
- Business logic is not tied to specific UI implementation

### 4. **Performance Improvements**
- Better memoization opportunities
- Reduced re-renders through focused state management
- More efficient update patterns

### 5. **Developer Experience**
- Clearer code structure
- Easier to add new features
- Better IDE support with TypeScript interfaces

## Integration with Main Component

The main workout session component will now use these hooks instead of managing state directly:

```typescript
export default function WorkoutSessionScreen() {
  // Route params
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  const workoutDay = parseInt(params.workoutDay as string, 10);
  // ...

  // Use the new hooks
  const workoutState = useWorkoutState({ planId, workoutDay, cycleWeek, weekName });
  const timer = useWorkoutTimer();
  const exerciseSets = useExerciseSets({ /* params */ });
  const navigation = useWorkoutNavigation({ /* params */ });
  const customization = useExerciseCustomization({ /* params */ });
  const completion = useWorkoutCompletion({ /* params */ });

  // Much cleaner component focused on UI rendering
  return (
    // UI components using hook data and functions
  );
}
```

## Next Steps

1. **Refactor Main Component**: Update the workout session component to use these new hooks
2. **Add Error Boundaries**: Implement proper error handling around each hook
3. **Add Loading States**: Improve user experience with better loading indicators
4. **Performance Testing**: Verify the performance improvements
5. **Integration Testing**: Ensure all hooks work together correctly

## File Structure

```
app/features/workout/hooks/
├── index.ts                      # Export all hooks
├── useWorkoutTimer.ts           # Timer functionality (existing)
├── useExerciseSets.ts           # Set management (existing)
├── useWorkoutState.ts           # State management (new)
├── useWorkoutNavigation.ts      # Navigation logic (new)
├── useExerciseCustomization.ts  # Customization logic (new)
└── useWorkoutCompletion.ts      # Completion logic (new)
```

This refactor transforms the workout session from a monolithic component into a well-organized, maintainable, and testable feature module. 