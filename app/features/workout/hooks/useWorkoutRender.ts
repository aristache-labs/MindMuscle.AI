import { useMemo, useCallback } from 'react';
import type { ExerciseData, ExerciseSet } from '../types'; // Import types

interface UseWorkoutRenderParams {
  workoutExercises: ExerciseData[];
  currentExerciseIndex: number;
  workoutExerciseSets: Record<string, ExerciseSet[]>;
  currentExercise: ExerciseData | undefined;
  showWarmup: boolean;
  warmupCompleted: boolean;
  isRestTimerVisible?: boolean; // Add rest timer state
}

export const useWorkoutRender = ({
  workoutExercises,
  currentExerciseIndex,
  workoutExerciseSets,
  currentExercise,
  showWarmup,
  warmupCompleted,
  isRestTimerVisible = false,
}: UseWorkoutRenderParams) => {
  // Compute current sets
  const currentSets = useMemo(() => {
    return currentExercise ? workoutExerciseSets[currentExercise.id] || [] : [];
  }, [currentExercise, workoutExerciseSets]);

  // Memoized calculation of active set index - only compute once per state change
  const activeSetIndex = useMemo(() => {
    /* console.log('🎯 calculateActiveSetIndex called:', {
      totalSets: currentSets.length,
      completedSets: currentSets.filter((s) => s.isCompleted).length,
      isRestTimerVisible,
      showWarmup,
      warmupCompleted,
    }); */

    // If warmup is showing and not completed, no set should be active
    if (showWarmup && !warmupCompleted) {
      /* console.log('🔥 Warmup active - no set should be active'); */
      return -1; // No set is active when warmup is showing
    }

    // If rest timer is visible, keep the last completed set active (don't advance to next)
    if (isRestTimerVisible) {
      // Find the last completed set and keep it completed during rest timer
      // This prevents the visual bug where the active card jumps to the next set
      const lastCompletedIndex = currentSets
        .map((s, index) => (s.isCompleted ? index : -1))
        .filter((index) => index !== -1)
        .pop();

      if (lastCompletedIndex !== undefined) {
        /* console.log('⏳ Rest timer visible - keeping last completed set visible:', {
          lastCompletedIndex,
          setStatus: 'completed',
        }); */
        return -1; // No set should be active during rest timer - all sets should be inactive/completed
      }
    }

    // Find the first incomplete set to make it active
    let calculatedActiveSetIndex = currentSets.findIndex((s: ExerciseSet) => !s.isCompleted);

    /* console.log('🎲 Normal calculation - first incomplete set:', {
      activeSetIndex: calculatedActiveSetIndex,
      firstIncompleteSet: calculatedActiveSetIndex >= 0 ? calculatedActiveSetIndex : 'none',
    }); */

    // If all sets are completed, no set should be active
    if (calculatedActiveSetIndex === -1) calculatedActiveSetIndex = currentSets.length;

    // Ensure activeSetIndex is within bounds (safety check for when sets are reduced)
    if (calculatedActiveSetIndex >= currentSets.length) {
      calculatedActiveSetIndex = -1; // No set should be active if index is out of bounds
    }

    /* console.log('✅ Final activeSetIndex:', calculatedActiveSetIndex); */
    return calculatedActiveSetIndex;
  }, [currentSets, isRestTimerVisible, showWarmup, warmupCompleted]);

  // Legacy function for backward compatibility - now just returns the memoized value
  const calculateActiveSetIndex = useCallback(() => {
    return activeSetIndex;
  }, [activeSetIndex]);

  // Check if we should show the next exercise or complete workout button
  const shouldShowCompleteWorkout = currentExerciseIndex === workoutExercises.length - 1;

  // Generate next exercise content if needed
  const getNextExerciseContent = useCallback(() => {
    if (shouldShowCompleteWorkout) {
      return null; // Will render the complete workout button instead
    }

    const nextExercise = workoutExercises[currentExerciseIndex + 1];
    if (!nextExercise) return null;

    return {
      name: nextExercise.name || 'Next Exercise',
      sets: nextExercise.sets || 4,
      reps: nextExercise.reps_range || '8-10',
      imageUrl: nextExercise.image_url || '',
      primaryMuscle:
        nextExercise.primary_muscles && nextExercise.primary_muscles.length > 0
          ? nextExercise.primary_muscles[0]
          : null,
      exerciseId: nextExercise.exercise_id,
      requiresWeight: nextExercise.requires_weight !== false,
    };
  }, [shouldShowCompleteWorkout, workoutExercises, currentExerciseIndex]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return ((currentExerciseIndex + 1) / workoutExercises.length) * 100;
  }, [currentExerciseIndex, workoutExercises.length]);

  return {
    currentSets,
    activeSetIndex, // Return the pre-calculated value
    calculateActiveSetIndex, // Keep for backward compatibility
    shouldShowCompleteWorkout,
    getNextExerciseContent,
    progressPercentage,
  };
};

export default function disablewarn() {
  return null;
}
