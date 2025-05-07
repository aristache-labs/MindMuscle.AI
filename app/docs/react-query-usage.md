# React Query Implementation Guide

This guide explains how to use React Query for data fetching and caching in the MindMuscle.AI application.

## Setup

React Query has been set up with the following configuration:

- **QueryClient**: Configured with default settings for stale time and retry behavior
- **AsyncStorage Persistence**: Query cache is persisted to AsyncStorage for offline support
- **Query Provider**: Wraps the app to provide React Query context

## Using Query Hooks

The app provides custom hooks for common data fetching operations. Here are examples of how to use them:

### Exercise Hooks

```tsx
import { useExercises, useExerciseDetails, useToggleFavoriteExercise } from '../hooks/useExercises';

// In a component:
function ExercisesList() {
  // Fetch all exercises or by category
  const { data: exercises, isLoading, error } = useExercises('Chest');
  
  // Handle loading and error states
  if (isLoading) return <LoadingIndicator />;
  if (error) return <ErrorDisplay error={error} />;
  
  return (
    <FlatList
      data={exercises}
      renderItem={({ item }) => <ExerciseCard exercise={item} />}
      keyExtractor={item => item.id}
    />
  );
}

function ExerciseDetails({ exerciseId }) {
  // Fetch details for a specific exercise
  const { data: exercise, isLoading } = useExerciseDetails(exerciseId);
  
  // Toggle favorite mutation
  const { mutate: toggleFavorite, isLoading: isToggling } = useToggleFavoriteExercise();
  
  const handleToggleFavorite = () => {
    toggleFavorite({ exerciseId, isFavorite: !exercise?.is_favorite });
  };
  
  // Render component with data...
}
```

### Workout Plan Hooks

```tsx
import { useWorkoutPlans, useWorkoutPlanDetails, usePlanExercises } from '../hooks/useWorkoutPlans';

// In a component:
function WorkoutPlansList() {
  // Fetch all workout plans
  const { data: plans, isLoading, error } = useWorkoutPlans();
  
  // Or fetch by subcategory
  // const { data: plans } = useWorkoutPlansBySubcategory('strength_3_days_week');
  
  // Render component...
}

function PlanDetails({ planId }) {
  // Fetch plan details
  const { data: plan } = useWorkoutPlanDetails(planId);
  
  // Fetch exercises for this plan
  const { data: exercises } = usePlanExercises(planId);
  
  // Render component...
}
```

## Query Keys

Query keys are structured in a consistent way to allow for proper cache management:

- **Exercise Keys**: `['exercises', 'list', { category, favorite, query }]` or `['exercises', 'detail', id]`
- **Plan Keys**: `['plans', 'list', { subcategoryId }]` or `['plans', 'detail', id]`

## Mutations

Mutations are used for data modifications. They handle automatic cache invalidation and updates:

```tsx
import { useCreateExercise, useUpdateExercise } from '../hooks/useExercises';

function ExerciseForm() {
  // Create exercise mutation
  const { mutate: createExercise, isLoading, error } = useCreateExercise();
  
  const handleSubmit = (formData) => {
    createExercise(formData, {
      onSuccess: (newExercise) => {
        // Navigate to the new exercise or show success message
      },
      onError: (error) => {
        // Show error message
      }
    });
  };
  
  // Render form...
}
```

## Best Practices

1. **Always handle loading and error states** in components using React Query hooks
2. **Prefer custom hooks** over direct use of useQuery/useMutation
3. **Use TypeScript** with React Query for better type safety
4. **Set appropriate stale times** based on how frequently data changes
5. **Structure query keys** consistently using the provided patterns
6. **Leverage cache manipulation methods** like `invalidateQueries` and `setQueryData`

## Debugging

For debugging React Query state, you can install and use the React Query Devtools:

```tsx
// First install the devtools:
// npm install @tanstack/react-query-devtools

// Then in your app:
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Add at the bottom of your QueryProvider component
{__DEV__ && <ReactQueryDevtools initialIsOpen={false} />}
```

Note: The DevTools are not included by default to keep bundle size smaller. Install them separately when needed for debugging. 