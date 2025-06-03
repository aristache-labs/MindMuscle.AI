import React from 'react';
import { Alert } from 'react-native';
import { ExerciseData, ExerciseSet } from '../types';

interface UseWorkoutNavigationParams {
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  currentExerciseIndex: number;
  setCurrentExerciseIndex: React.Dispatch<React.SetStateAction<number>>;
  onCompleteWorkout: () => void;
}

export const useWorkoutNavigation = ({
  exercises,
  exerciseSets,
  currentExerciseIndex,
  setCurrentExerciseIndex,
  onCompleteWorkout,
}: UseWorkoutNavigationParams) => {
  /**
   * Move to the next exercise in the workout
   */
  const moveToNextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      // Use a function to update state to avoid closure issues
      setCurrentExerciseIndex((prevIndex) => prevIndex + 1);

      // No notification when moving to next exercise for better UX flow
    } else {
      // Check if all exercises have all their sets completed
      const allExercisesCompleted = exercises.every((exercise) => {
        const sets = exerciseSets[exercise.id] || [];
        return sets.length > 0 && sets.every((set) => set.isCompleted);
      });

      if (allExercisesCompleted) {
        // All exercises and all sets are completed, automatically save data
        // Use setTimeout to ensure UI updates complete before saving
        setTimeout(() => {
          onCompleteWorkout();
        }, 500);
      } else {
        // Not all sets are completed, show regular completion alert
        Alert.alert('Workout Complete', 'You have reached the end of your workout!', [
          {
            text: 'Complete Workout',
            onPress: () => {
              // Allow the user to manually complete the workout even if not all sets are done
              onCompleteWorkout();
            },
          },
        ]);
      }
    }
  };

  /**
   * Move to the previous exercise in the workout
   */
  const moveToPreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex((prev) => prev - 1);
    }
  };

  /**
   * Move current exercise to the end of the workout
   */
  const moveCurrentExerciseToEnd = () => {
    if (currentExerciseIndex >= 0 && currentExerciseIndex < exercises.length - 1) {
      const currentExercise = exercises[currentExerciseIndex];

      // Create new exercises array with current exercise moved to end
      const newExercises = [...exercises];
      newExercises.splice(currentExerciseIndex, 1); // Remove current exercise
      newExercises.push(currentExercise); // Add it to the end

      return newExercises;
    }
    return exercises;
  };

  /**
   * Get the current exercise data
   */
  const getCurrentExercise = (): ExerciseData | undefined => {
    return exercises[currentExerciseIndex];
  };

  /**
   * Get the sets for the current exercise
   */
  const getCurrentSets = (): ExerciseSet[] => {
    const currentExercise = getCurrentExercise();
    return currentExercise ? exerciseSets[currentExercise.id] || [] : [];
  };

  return {
    currentExerciseIndex,
    setCurrentExerciseIndex,
    moveToNextExercise,
    moveToPreviousExercise,
    moveCurrentExerciseToEnd,
    getCurrentExercise,
    getCurrentSets,
  };
};
export default function disablewarn() {
  return null;
}
