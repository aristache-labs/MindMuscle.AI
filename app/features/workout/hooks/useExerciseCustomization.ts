import { useCallback } from 'react';
import type { ExerciseData, ExerciseSet } from '../types';

export interface UseExerciseCustomizationParams {
  exercises: ExerciseData[];
  setExercises: React.Dispatch<React.SetStateAction<ExerciseData[]>>;
  exerciseSets: Record<string, ExerciseSet[]>;
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;
  exerciseCustomized: Record<string, boolean>;
  setExerciseCustomized: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  userEnteredValues: Record<string, boolean>;
  setUserEnteredValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  textInputRefreshKey: number;
  setTextInputRefreshKey: (key: number) => void;
}

export interface UseExerciseCustomizationReturn {
  customizeExercise: (exerciseId: string, updates: { sets?: number; reps_range?: string }) => void;
  isExerciseCustomized: (exerciseId: string) => boolean;
  getCustomizedExercise: (exerciseId: string) => ExerciseData | undefined;
  resetExerciseCustomization: (exerciseId: string) => void;
  resetAllCustomizations: () => void;
}

export const useExerciseCustomization = (params: UseExerciseCustomizationParams): UseExerciseCustomizationReturn => {
  const {
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
  } = params;

  const customizeExercise = useCallback((exerciseId: string, updates: { sets?: number; reps_range?: string }) => {
    // Update the exercise
    setExercises(prev => prev.map(exercise => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: updates.sets !== undefined ? updates.sets : exercise.sets,
          reps_range: updates.reps_range !== undefined ? updates.reps_range : exercise.reps_range
        };
      }
      return exercise;
    }));

    // Mark exercise as customized
    setExerciseCustomized(prev => ({
      ...prev,
      [exerciseId]: true
    }));

    // Update exercise sets if number of sets changed
    if (updates.sets !== undefined) {
      setExerciseSets(prev => {
        const currentSets = prev[exerciseId] || [];
        const targetSets = updates.sets!;
        
        if (currentSets.length === targetSets) {
          // Same number of sets, just update reps_range if provided
          if (updates.reps_range !== undefined) {
            return {
              ...prev,
              [exerciseId]: currentSets.map(set => ({
                ...set,
                reps: set.isCompleted ? set.reps : updates.reps_range!
              }))
            };
          }
          return prev;
        }

        let newSets: ExerciseSet[];
        
        if (currentSets.length < targetSets) {
          // Add more sets
          const additionalSets = Array.from({ length: targetSets - currentSets.length }, (_, index) => ({
            id: `${exerciseId}-set-${currentSets.length + index + 1}`,
            setNumber: currentSets.length + index + 1,
            weight: '',
            reps: updates.reps_range || '',
            isCompleted: false
          }));
          newSets = [...currentSets, ...additionalSets];
        } else {
          // Remove excess sets (keep only the first targetSets)
          newSets = currentSets.slice(0, targetSets);
        }

        // Update reps_range for all uncompleted sets if provided
        if (updates.reps_range !== undefined) {
          newSets = newSets.map(set => ({
            ...set,
            reps: set.isCompleted ? set.reps : updates.reps_range!
          }));
        }

        return {
          ...prev,
          [exerciseId]: newSets
        };
      });
    } else if (updates.reps_range !== undefined) {
      // Only reps_range changed, update uncompleted sets
      setExerciseSets(prev => ({
        ...prev,
        [exerciseId]: (prev[exerciseId] || []).map(set => ({
          ...set,
          reps: set.isCompleted ? set.reps : updates.reps_range!
        }))
      }));
    }

    // Clear user-entered flags for reps inputs of this exercise since customization overrides user input
    setUserEnteredValues(prev => {
      const updated = { ...prev };
      const currentSets = exerciseSets[exerciseId] || [];
      
      currentSets.forEach((set, index) => {
        const repsInputKey = `${exerciseId}-${index}-reps`;
        if (updated[repsInputKey]) {
          delete updated[repsInputKey];
        }
      });
      
      return updated;
    });

    // Force TextInput re-render to show updated values
    setTextInputRefreshKey(textInputRefreshKey + 1);
  }, [exercises, exerciseSets, setExercises, setExerciseSets, setExerciseCustomized, setUserEnteredValues, textInputRefreshKey, setTextInputRefreshKey]);

  const isExerciseCustomized = useCallback((exerciseId: string) => {
    return exerciseCustomized[exerciseId] || false;
  }, [exerciseCustomized]);

  const getCustomizedExercise = useCallback((exerciseId: string) => {
    return exercises.find(exercise => exercise.id === exerciseId);
  }, [exercises]);

  const resetExerciseCustomization = useCallback((exerciseId: string) => {
    // Mark exercise as not customized
    setExerciseCustomized(prev => {
      const updated = { ...prev };
      delete updated[exerciseId];
      return updated;
    });

    // Note: This doesn't restore the original exercise data
    // You would need to store original exercise data to fully reset
    // For now, we just mark it as not customized
  }, [setExerciseCustomized]);

  const resetAllCustomizations = useCallback(() => {
    setExerciseCustomized({});
    setUserEnteredValues({});
    setTextInputRefreshKey(textInputRefreshKey + 1);
  }, [setExerciseCustomized, setUserEnteredValues, setTextInputRefreshKey, textInputRefreshKey]);

  return {
    customizeExercise,
    isExerciseCustomized,
    getCustomizedExercise,
    resetExerciseCustomization,
    resetAllCustomizations,
  };
}; 