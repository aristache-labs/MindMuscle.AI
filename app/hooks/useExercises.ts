import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import { useSentryDataCollection } from './useSentryDataCollection';

// Query keys
export const exerciseKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: (filters: { category?: ExerciseCategory; favorite?: boolean; query?: string }) =>
    [...exerciseKeys.lists(), filters] as const,
  details: () => [...exerciseKeys.all, 'detail'] as const,
  detail: (id: string) => [...exerciseKeys.details(), id] as const,
};

// Hooks
export function useExercises(category?: ExerciseCategory) {
  const queryKey = category ? exerciseKeys.list({ category }) : exerciseKeys.lists();

  const sentry = useSentryDataCollection({
    componentName: 'useExercises',
    autoSetUser: false,
  });

  return useQuery({
    queryKey,
    queryFn: async () => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Fetching exercises',
          category: 'exercise-query',
          level: 'info',
          data: { category: category || 'all' },
        });

        sentry.setContext('exercise_query', {
          type: 'list',
          category: category || 'all',
          timestamp: new Date().toISOString(),
        });

        const result = category
          ? await exerciseService.getExercisesByCategory(category)
          : await exerciseService.getAllExercises();

        const duration = Date.now() - startTime;

        sentry.trackPerformance('exercise_query_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercises fetched successfully',
          category: 'exercise-query',
          level: 'info',
          data: {
            category: category || 'all',
            count: result.length,
            duration,
          },
        });

        sentry.setContext('exercise_query_result', {
          success: true,
          count: result.length,
          duration,
          category: category || 'all',
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          exercise_query_failed: true,
          category: category || 'all',
          duration,
        });

        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useExerciseSearch(query: string) {
  const sentry = useSentryDataCollection({
    componentName: 'useExerciseSearch',
    autoSetUser: false,
  });

  return useQuery({
    queryKey: exerciseKeys.list({ query }),
    queryFn: async () => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Searching exercises',
          category: 'exercise-search',
          level: 'info',
          data: { query, queryLength: query.length },
        });

        sentry.setContext('exercise_search', {
          query,
          queryLength: query.length,
          timestamp: new Date().toISOString(),
        });

        const result = await exerciseService.searchExercises(query);

        const duration = Date.now() - startTime;

        sentry.trackPerformance('exercise_search_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercise search completed',
          category: 'exercise-search',
          level: 'info',
          data: {
            query,
            resultCount: result.length,
            duration,
          },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          exercise_search_failed: true,
          query,
          duration,
        });

        throw error;
      }
    },
    enabled: query.length > 2, // Only run query if search term is at least 3 characters
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useFavoriteExercises() {
  const sentry = useSentryDataCollection({
    componentName: 'useFavoriteExercises',
    autoSetUser: false,
  });

  return useQuery({
    queryKey: exerciseKeys.list({ favorite: true }),
    queryFn: async () => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Fetching favorite exercises',
          category: 'exercise-favorites',
          level: 'info',
        });

        const result = await exerciseService.getFavoriteExercises();

        const duration = Date.now() - startTime;

        sentry.trackPerformance('favorite_exercises_query_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Favorite exercises fetched',
          category: 'exercise-favorites',
          level: 'info',
          data: { count: result.length, duration },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          favorite_exercises_query_failed: true,
          duration,
        });

        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useExerciseDetails(id: string) {
  const sentry = useSentryDataCollection({
    componentName: 'useExerciseDetails',
    autoSetUser: false,
  });

  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: async () => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Fetching exercise details',
          category: 'exercise-details',
          level: 'info',
          data: { exerciseId: id },
        });

        const result = await exerciseService.getExerciseById(id);

        const duration = Date.now() - startTime;

        sentry.trackPerformance('exercise_details_query_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercise details fetched',
          category: 'exercise-details',
          level: 'info',
          data: { exerciseId: id, duration },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          exercise_details_query_failed: true,
          exerciseId: id,
          duration,
        });

        throw error;
      }
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useToggleFavoriteExercise() {
  const queryClient = useQueryClient();

  const sentry = useSentryDataCollection({
    componentName: 'useToggleFavoriteExercise',
    autoSetUser: false,
  });

  return useMutation({
    mutationFn: async ({ exerciseId, isFavorite }: { exerciseId: string; isFavorite: boolean }) => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Toggling exercise favorite status',
          category: 'exercise-favorite',
          level: 'info',
          data: { exerciseId, isFavorite },
        });

        const result = await exerciseService.toggleFavoriteExercise(exerciseId, isFavorite);

        const duration = Date.now() - startTime;

        sentry.trackPerformance('toggle_favorite_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercise favorite status updated',
          category: 'exercise-favorite',
          level: 'info',
          data: { exerciseId, isFavorite, duration },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          toggle_favorite_failed: true,
          exerciseId,
          isFavorite,
          duration,
        });

        throw error;
      }
    },
    onSuccess: (_, { exerciseId, isFavorite }) => {
      sentry.addBreadcrumb({
        message: 'Cache invalidation after favorite toggle',
        category: 'cache',
        level: 'debug',
        data: { exerciseId, isFavorite },
      });

      // Invalidate and refetch favorite exercises list
      queryClient.invalidateQueries({ queryKey: exerciseKeys.list({ favorite: true }) });
      // Also invalidate all exercise lists as they might contain favorite status
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
    onError: (error, { exerciseId, isFavorite }) => {
      sentry.captureException(error as Error, {
        mutation_type: 'toggle_favorite',
        exercise_id: exerciseId,
        is_favorite: isFavorite,
      });
    },
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();

  const sentry = useSentryDataCollection({
    componentName: 'useCreateExercise',
    autoSetUser: false,
  });

  return useMutation({
    mutationFn: async (exercise: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>) => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Creating new exercise',
          category: 'exercise-create',
          level: 'info',
          data: {
            name: exercise.name,
            muscleGroups:
              (exercise as Exercise & { muscle_groups?: string[] }).muscle_groups?.length || 0,
          },
        });

        const result = await exerciseService.createExercise(exercise);

        const duration = Date.now() - startTime;

        sentry.trackPerformance('create_exercise_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercise created successfully',
          category: 'exercise-create',
          level: 'info',
          data: {
            exerciseId: result.id,
            name: exercise.name,
            duration,
          },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          create_exercise_failed: true,
          exerciseName: exercise.name,
          duration,
        });

        throw error;
      }
    },
    onSuccess: (newExercise) => {
      sentry.addBreadcrumb({
        message: 'Cache invalidation after exercise creation',
        category: 'cache',
        level: 'debug',
        data: { exerciseId: newExercise.id },
      });

      // Invalidate and refetch all exercise lists
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
    onError: (error, exercise) => {
      sentry.captureException(error as Error, {
        mutation_type: 'create_exercise',
        exercise_name: exercise.name,
      });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();

  const sentry = useSentryDataCollection({
    componentName: 'useUpdateExercise',
    autoSetUser: false,
  });

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Exercise> }) => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Updating exercise',
          category: 'exercise-update',
          level: 'info',
          data: {
            exerciseId: id,
            updateFieldsCount: Object.keys(updates).length,
          },
        });

        const result = await exerciseService.updateExercise(id, updates);

        const duration = Date.now() - startTime;

        sentry.trackPerformance('update_exercise_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercise updated successfully',
          category: 'exercise-update',
          level: 'info',
          data: { exerciseId: id, duration },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          update_exercise_failed: true,
          exerciseId: id,
          duration,
        });

        throw error;
      }
    },
    onSuccess: (updatedExercise) => {
      sentry.addBreadcrumb({
        message: 'Cache update after exercise modification',
        category: 'cache',
        level: 'debug',
        data: { exerciseId: updatedExercise.id },
      });

      // Update the exercise in the cache
      queryClient.setQueryData(exerciseKeys.detail(updatedExercise.id), updatedExercise);
      // Invalidate related lists
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
    onError: (error, { id }) => {
      sentry.captureException(error as Error, {
        mutation_type: 'update_exercise',
        exercise_id: id,
      });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();

  const sentry = useSentryDataCollection({
    componentName: 'useDeleteExercise',
    autoSetUser: false,
  });

  return useMutation({
    mutationFn: async (id: string) => {
      const startTime = Date.now();

      try {
        sentry.addBreadcrumb({
          message: 'Deleting exercise',
          category: 'exercise-delete',
          level: 'info',
          data: { exerciseId: id },
        });

        const result = await exerciseService.deleteExercise(id);

        const duration = Date.now() - startTime;

        sentry.trackPerformance('delete_exercise_duration', duration, 'ms');

        sentry.addBreadcrumb({
          message: 'Exercise deleted successfully',
          category: 'exercise-delete',
          level: 'info',
          data: { exerciseId: id, duration },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        sentry.captureException(error as Error, {
          delete_exercise_failed: true,
          exerciseId: id,
          duration,
        });

        throw error;
      }
    },
    onSuccess: (_, deletedId) => {
      sentry.addBreadcrumb({
        message: 'Cache cleanup after exercise deletion',
        category: 'cache',
        level: 'debug',
        data: { exerciseId: deletedId },
      });

      // Remove the exercise from the cache
      queryClient.removeQueries({ queryKey: exerciseKeys.detail(deletedId) });
      // Invalidate and refetch all exercise lists
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
    onError: (error, id) => {
      sentry.captureException(error as Error, {
        mutation_type: 'delete_exercise',
        exercise_id: id,
      });
    },
  });
}

// Default export for Expo Router compatibility
export default {
  useExercises,
  useExerciseSearch,
  useFavoriteExercises,
  useExerciseDetails,
  useToggleFavoriteExercise,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
  exerciseKeys,
};
