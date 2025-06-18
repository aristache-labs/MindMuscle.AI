import { useCallback, useMemo } from 'react';
import { Exercise, ExerciseCategory } from '../../../services/exerciseService';
import { MUSCLE_GROUP_ALIASES, muscleGroups } from '../constants';

// Enhanced filtering hook for exercises
export const useExerciseFiltering = (exercises: Exercise[], searchQuery: string) => {
  const matchesMuscleGroup = useCallback((exercise: Exercise, query: string): boolean => {
    if (exercise.muscle_group && exercise.muscle_group.toLowerCase().includes(query)) {
      return true;
    }

    if (exercise.muscle_group) {
      const aliases = MUSCLE_GROUP_ALIASES[exercise.muscle_group as ExerciseCategory] || [];
      return aliases.some((alias: string) => alias.toLowerCase().includes(query));
    }

    return false;
  }, []);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;

    const query = searchQuery.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(query) ||
        (ex.muscle_group && ex.muscle_group.toLowerCase().includes(query)) ||
        matchesMuscleGroup(ex, query),
    );
  }, [exercises, searchQuery, matchesMuscleGroup]);

  return { filteredExercises };
};

// Muscle group filtering hook
export const useMuscleGroupFiltering = (searchQuery: string, currentView: 'front' | 'back') => {
  const filteredMuscleGroups = useMemo(() => {
    const viewFilteredMuscles = muscleGroups.filter((muscle) => muscle.view === currentView);

    if (!searchQuery.trim()) return viewFilteredMuscles;

    const query = searchQuery.toLowerCase().trim();
    return viewFilteredMuscles.filter((muscle) => {
      // Check muscle name
      if (muscle.name.toLowerCase().includes(query)) {
        return true;
      }

      // Check aliases
      const aliases = MUSCLE_GROUP_ALIASES[muscle.name] || [];
      return aliases.some((alias: string) => alias.toLowerCase().includes(query));
    });
  }, [searchQuery, currentView]);

  return { filteredMuscleGroups };
};
