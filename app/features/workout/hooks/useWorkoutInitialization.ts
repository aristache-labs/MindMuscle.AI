import { useEffect } from 'react';
import { ExerciseData } from '../types';
import type { UserProfile } from '../../../store/AuthContext';

interface UseWorkoutInitializationParams {
  user: UserProfile | null | undefined;
  cycleWeek: number;
  isLoading: boolean;
  isResumingPausedWorkout: boolean;
  clearAllTimers: () => void;
  fetchLastExerciseRecords: () => void;
  fetchMaxWeightDataForAllExercises: () => void;
  fetchCycleWeekInfo: () => void;
  workoutExercises: ExerciseData[];
}

export const useWorkoutInitialization = ({
  user,
  isLoading,
  isResumingPausedWorkout,
  clearAllTimers,
  fetchLastExerciseRecords,
  fetchMaxWeightDataForAllExercises,
  fetchCycleWeekInfo,
  workoutExercises,
}: UseWorkoutInitializationParams) => {
  // Effect to fetch data when exercises change
  useEffect(() => {
    // Add guard to prevent this effect from running during workout resumption
    if (workoutExercises.length > 0 && user && !isLoading && !isResumingPausedWorkout) {
      fetchLastExerciseRecords();
    }
  }, [
    workoutExercises.length,
    user?.id,
    isLoading,
    isResumingPausedWorkout,
    fetchLastExerciseRecords,
  ]);

  // Effect to fetch max weight data
  useEffect(() => {
    // Add guard to prevent this effect from running during workout resumption
    if (workoutExercises.length > 0 && user && !isLoading && !isResumingPausedWorkout) {
      fetchMaxWeightDataForAllExercises();
    }
  }, [
    workoutExercises.length,
    user?.id,
    isLoading,
    isResumingPausedWorkout,
    fetchMaxWeightDataForAllExercises,
  ]);

  // Effect to fetch cycle week info
  useEffect(() => {
    fetchCycleWeekInfo();
  }, [fetchCycleWeekInfo]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);
};

export default function disablewarn() {
  return null;
}
