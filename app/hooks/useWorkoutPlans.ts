import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import workoutPlanService, { WorkoutPlan, PlanExercise } from '../services/workoutPlanService';

// Query keys
export const planKeys = {
  all: ['plans'] as const,
  lists: () => [...planKeys.all, 'list'] as const,
  list: (filters: { subcategoryId?: string }) => 
    [...planKeys.lists(), filters] as const,
  details: () => [...planKeys.all, 'detail'] as const,
  detail: (id: string) => [...planKeys.details(), id] as const,
  exercises: () => [...planKeys.all, 'exercises'] as const,
  planExercises: (planId: string) => [...planKeys.exercises(), planId] as const,
};

// Hooks
export function useWorkoutPlans() {
  return useQuery({
    queryKey: planKeys.lists(),
    queryFn: () => workoutPlanService.getAllPlans(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useWorkoutPlansBySubcategory(subcategoryId: string) {
  return useQuery({
    queryKey: planKeys.list({ subcategoryId }),
    queryFn: () => workoutPlanService.getPlansBySubcategory(subcategoryId),
    enabled: !!subcategoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useWorkoutPlanDetails(planId: string) {
  return useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => workoutPlanService.getPlanById(planId),
    enabled: !!planId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function usePlanExercises(planId: string) {
  return useQuery({
    queryKey: planKeys.planExercises(planId),
    queryFn: () => workoutPlanService.getPlanExercises(planId),
    enabled: !!planId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateWorkoutPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (plan: Omit<WorkoutPlan, 'id' | 'created_at' | 'updated_at'>) => 
      workoutPlanService.createPlan(plan),
    onSuccess: (newPlan) => {
      // Add the new plan to appropriate cache entries
      queryClient.invalidateQueries({ queryKey: planKeys.lists() });
      if (newPlan.subcategory_id) {
        queryClient.invalidateQueries({ 
          queryKey: planKeys.list({ subcategoryId: newPlan.subcategory_id }) 
        });
      }
    },
  });
}

export function useUpdateWorkoutPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ planId, updates }: { planId: string; updates: Partial<WorkoutPlan> }) => 
      workoutPlanService.updatePlan(planId, updates),
    onSuccess: (updatedPlan) => {
      // Update the plan in the cache
      queryClient.setQueryData(
        planKeys.detail(updatedPlan.id),
        updatedPlan
      );
      // Invalidate lists that may contain this plan
      queryClient.invalidateQueries({ queryKey: planKeys.lists() });
      if (updatedPlan.subcategory_id) {
        queryClient.invalidateQueries({ 
          queryKey: planKeys.list({ subcategoryId: updatedPlan.subcategory_id }) 
        });
      }
    },
  });
}

export function useUploadPlanImage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ imageUri, planId }: { imageUri: string; planId: string }) => 
      workoutPlanService.uploadPlanImage(imageUri, planId),
    onSuccess: (_, variables) => {
      // Invalidate the plan details to refetch with the new image
      queryClient.invalidateQueries({ 
        queryKey: planKeys.detail(variables.planId)
      });
    },
  });
}

export function useDeletePlanImage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (planId: string) => workoutPlanService.deletePlanImage(planId),
    onSuccess: (_, planId) => {
      // Invalidate the plan details to refetch without the image
      queryClient.invalidateQueries({ 
        queryKey: planKeys.detail(planId)
      });
    },
  });
} 