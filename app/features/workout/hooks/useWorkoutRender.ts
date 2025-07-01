import { useMemo } from 'react';
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

  // Calculate active set index
  const calculateActiveSetIndex = (sets: ExerciseSet[]) => {
    /* console.log('🎯 calculateActiveSetIndex called:', {
      totalSets: sets.length,
      completedSets: sets.filter((s) => s.isCompleted).length,
      isRestTimerVisible,
      showWarmup,
      warmupCompleted,
    }); */

    // If rest timer is visible, keep current active set (don't advance)
    if (isRestTimerVisible) {
      // Find the last completed set and keep it active during rest timer
      const lastCompletedIndex =
        sets.findIndex((s: ExerciseSet) => {
          // Find the first incomplete set and return the one before it
          return !s.isCompleted;
        }) - 1;

      /* console.log('⏳ Rest timer visible - keeping last completed set active:', {
        lastCompletedIndex: Math.max(0, lastCompletedIndex),
      }); */

      return Math.max(0, lastCompletedIndex);
    }

    // Find the first incomplete set to make it active
    let activeSetIndex = sets.findIndex((s: ExerciseSet) => !s.isCompleted);

    /* console.log('🎲 Normal calculation - first incomplete set:', {
      activeSetIndex,
      firstIncompleteSet: activeSetIndex >= 0 ? activeSetIndex : 'none',
    }); */

    // If all sets are completed, no set should be active
    if (activeSetIndex === -1) activeSetIndex = sets.length;

    // If warmup is showing and not completed, no set should be active
    if (showWarmup && !warmupCompleted) {
      activeSetIndex = -1; // No set is active when warmup is showing
    }

    // Ensure activeSetIndex is within bounds (safety check for when sets are reduced)
    if (activeSetIndex >= sets.length) {
      activeSetIndex = -1; // No set should be active if index is out of bounds
    }

    /* console.log('✅ Final activeSetIndex:', activeSetIndex); */
    return activeSetIndex;
  };

  // Check if we should show the next exercise or complete workout button
  const shouldShowCompleteWorkout = currentExerciseIndex === workoutExercises.length - 1;

  // Generate next exercise content if needed
  const getNextExerciseContent = () => {
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
  };

  // Calculate progress percentage
  const progressPercentage = ((currentExerciseIndex + 1) / workoutExercises.length) * 100;

  return {
    currentSets,
    calculateActiveSetIndex,
    shouldShowCompleteWorkout,
    getNextExerciseContent,
    progressPercentage,
  };
};
export default function disablewarn() {
  return null;
}
