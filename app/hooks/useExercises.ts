import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';

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

  return useQuery({
    queryKey,
    queryFn: () =>
      category
        ? exerciseService.getExercisesByCategory(category)
        : exerciseService.getAllExercises(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useExerciseSearch(query: string) {
  return useQuery({
    queryKey: exerciseKeys.list({ query }),
    queryFn: () => exerciseService.searchExercises(query),
    enabled: query.length > 2, // Only run query if search term is at least 3 characters
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useFavoriteExercises() {
  return useQuery({
    queryKey: exerciseKeys.list({ favorite: true }),
    queryFn: () => exerciseService.getFavoriteExercises(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useExerciseDetails(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: () => exerciseService.getExerciseById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useToggleFavoriteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exerciseId, isFavorite }: { exerciseId: string; isFavorite: boolean }) =>
      exerciseService.toggleFavoriteExercise(exerciseId, isFavorite),
    onSuccess: () => {
      // Invalidate and refetch favorite exercises list
      queryClient.invalidateQueries({ queryKey: exerciseKeys.list({ favorite: true }) });
      // Also invalidate all exercise lists as they might contain favorite status
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exercise: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>) =>
      exerciseService.createExercise(exercise),
    onSuccess: () => {
      // Invalidate and refetch all exercise lists
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Exercise> }) =>
      exerciseService.updateExercise(id, updates),
    onSuccess: (updatedExercise) => {
      // Update the exercise in the cache
      queryClient.setQueryData(exerciseKeys.detail(updatedExercise.id), updatedExercise);
      // Invalidate related lists
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => exerciseService.deleteExercise(id),
    onSuccess: (_, deletedId) => {
      // Remove the exercise from the cache
      queryClient.removeQueries({ queryKey: exerciseKeys.detail(deletedId) });
      // Invalidate and refetch all exercise lists
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
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
