import { useEffect } from 'react';
import workoutPlanService from '../../../services/workoutPlanService';
import { ExerciseData, ExerciseSet } from '../types';
import type { UserProfile } from '../../../store/AuthContext';

interface PausedWorkoutDataType {
  exercises?: Array<
    ExerciseData | { isChangedExercise?: boolean | string; [key: string]: unknown }
  >;
  exerciseSets?: Record<string, ExerciseSet[]>;
  originalCycleWeek?: number | null;
}

interface UseWorkoutInitializationParams {
  user: UserProfile | null | undefined;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  forceStart: boolean;
  forceResume: boolean;
  isLoading: boolean;
  isResumingPausedWorkout: boolean;
  setIsResumingPausedWorkout: (value: boolean) => void;
  setIsWorkoutCompleted: (value: boolean) => void;
  fetchWorkoutData: () => void;
  checkWorkoutCompletionOnly: () => void;
  checkWorkoutCompletion: () => void;
  resumePausedWorkout: (pausedWorkout: PausedWorkoutDataType) => void;
  setWorkoutStartTime: (date: Date) => void;
  startWorkoutTimer: () => void;
  clearAllTimers: () => void;
  fetchLastExerciseRecords: () => void;
  fetchMaxWeightDataForAllExercises: () => void;
  fetchCycleWeekInfo: () => void;
  workoutExercises: ExerciseData[];
}

export const useWorkoutInitialization = ({
  user,
  planId,
  workoutDay,
  cycleWeek: _cycleWeek,
  forceStart,
  forceResume,
  isLoading,
  isResumingPausedWorkout,
  setIsResumingPausedWorkout,
  setIsWorkoutCompleted,
  fetchWorkoutData,
  checkWorkoutCompletionOnly,
  checkWorkoutCompletion,
  resumePausedWorkout,
  setWorkoutStartTime,
  startWorkoutTimer,
  clearAllTimers,
  fetchLastExerciseRecords,
  fetchMaxWeightDataForAllExercises,
  fetchCycleWeekInfo,
  workoutExercises,
}: UseWorkoutInitializationParams) => {
  // Effect to initialize the workout
  useEffect(() => {
    if (forceStart) {
      // Force start means we want to start the workout even if it's already completed
      setIsWorkoutCompleted(false);
      fetchWorkoutData();

      // Start workout timer
      setWorkoutStartTime(new Date());
      startWorkoutTimer();
    } else {
      // Check for completion first, then proceed with normal flow
      checkWorkoutCompletionOnly();
    }
  }, []);

  // Effect to handle workout completion check or resume
  useEffect(() => {
    // Check if workout is already completed for today, but skip if forceStart is true
    if (!forceStart) {
      if (forceResume) {
        // If forceResume is true, directly try to load and resume the paused workout
        const resumePausedWorkoutDirectly = async () => {
          try {
            // Try to get the paused workout
            const pausedWorkout = await workoutPlanService.getPausedWorkout(
              user?.id || '',
              planId,
              workoutDay,
            );

            if (pausedWorkout) {
              // Directly resume the paused workout
              resumePausedWorkout(pausedWorkout);
            } else {
              // No paused workout found, fetch workout data normally
              setIsResumingPausedWorkout(false); // Make sure flag is cleared
              fetchWorkoutData();
              setWorkoutStartTime(new Date());
              startWorkoutTimer();
            }
          } catch {
            // If there's an error, fetch workout data normally
            setIsResumingPausedWorkout(false); // Make sure flag is cleared
            fetchWorkoutData();
            setWorkoutStartTime(new Date());
            startWorkoutTimer();
          }
        };

        resumePausedWorkoutDirectly();
      } else {
        // Normal flow - check if workout is completed or paused
        checkWorkoutCompletion();
      }
    } else {
      // If forceStart is true, always fetch workout data and start the timer
      fetchWorkoutData();
      setWorkoutStartTime(new Date());
      startWorkoutTimer();
    }

    // Cleanup
    return () => {
      clearAllTimers();
    };
  }, [planId, workoutDay, forceStart, clearAllTimers]);

  // Effect to fetch data when exercises change
  useEffect(() => {
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
    if (workoutExercises.length > 0 && user && !isLoading) {
      fetchMaxWeightDataForAllExercises();
    }
  }, [workoutExercises.length, user?.id, isLoading, fetchMaxWeightDataForAllExercises]);

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
