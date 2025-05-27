import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { ExerciseData, ExerciseSet } from '../types';

export interface UseWorkoutNavigationParams {
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  setCurrentExerciseIndex: React.Dispatch<React.SetStateAction<number>>;
  exerciseSets: Record<string, ExerciseSet[]>;
  onWorkoutComplete: () => void;
}

export interface UseWorkoutNavigationReturn {
  moveToNextExercise: () => void;
  moveToPreviousExercise: () => void;
  moveToExercise: (index: number) => void;
  moveCurrentExerciseToEnd: () => void;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  isLastExercise: boolean;
  getWorkoutProgress: () => { completed: number; total: number; percentage: number };
}

export const useWorkoutNavigation = (params: UseWorkoutNavigationParams): UseWorkoutNavigationReturn => {
  const {
    exercises,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    exerciseSets,
    onWorkoutComplete
  } = params;

  const canMovePrevious = currentExerciseIndex > 0;
  const canMoveNext = currentExerciseIndex < exercises.length - 1;
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

  const getWorkoutProgress = useCallback(() => {
    const totalExercises = exercises.length;
    const completedExercises = exercises.filter(exercise => {
      const sets = exerciseSets[exercise.id] || [];
      return sets.length > 0 && sets.every(set => set.isCompleted);
    }).length;

    return {
      completed: completedExercises,
      total: totalExercises,
      percentage: totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0
    };
  }, [exercises, exerciseSets]);

  const moveToNextExercise = useCallback(() => {
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(prevIndex => prevIndex + 1);
    } else {
      // Check if all exercises have all their sets completed
      const allExercisesCompleted = exercises.every(exercise => {
        const sets = exerciseSets[exercise.id] || [];
        return sets.length > 0 && sets.every(set => set.isCompleted);
      });

      if (allExercisesCompleted) {
        // All exercises and all sets are completed, automatically complete workout
        setTimeout(() => {
          onWorkoutComplete();
        }, 500);
      } else {
        // Not all sets are completed, show completion alert
        Alert.alert(
          'Workout Complete',
          'You have reached the end of your workout!',
          [{ 
            text: 'Complete Workout', 
            onPress: () => {
              // Allow manual completion even if not all sets are done
              onWorkoutComplete();
            }
          }]
        );
      }
    }
  }, [currentExerciseIndex, exercises, exerciseSets, setCurrentExerciseIndex, onWorkoutComplete]);

  const moveToPreviousExercise = useCallback(() => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
    }
  }, [currentExerciseIndex, setCurrentExerciseIndex]);

  const moveToExercise = useCallback((index: number) => {
    if (index >= 0 && index < exercises.length) {
      setCurrentExerciseIndex(index);
    }
  }, [exercises.length, setCurrentExerciseIndex]);

  const moveCurrentExerciseToEnd = useCallback(() => {
    if (exercises.length <= 1) return;

    const currentExercise = exercises[currentExerciseIndex];
    const newExercises = [...exercises];
    
    // Remove current exercise from its position
    newExercises.splice(currentExerciseIndex, 1);
    // Add it to the end
    newExercises.push(currentExercise);

    // Update exercises order (this would need to be passed back to parent)
    // For now, we'll keep the current exercise index the same if possible
    if (currentExerciseIndex < newExercises.length - 1) {
      // Stay on the same index (which now has the next exercise)
      // No need to change currentExerciseIndex
    } else {
      // We were at the end, move to the previous exercise
      setCurrentExerciseIndex(prev => Math.max(0, prev - 1));
    }

    return newExercises;
  }, [exercises, currentExerciseIndex, setCurrentExerciseIndex]);

  return {
    moveToNextExercise,
    moveToPreviousExercise,
    moveToExercise,
    moveCurrentExerciseToEnd,
    canMovePrevious,
    canMoveNext,
    isLastExercise,
    getWorkoutProgress,
  };
}; 