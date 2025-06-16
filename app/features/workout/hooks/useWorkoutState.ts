import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import workoutPlanService from '../../../services/workoutPlanService';
import type { UserProfile } from '../../../store/AuthContext';
import { ExerciseData, ExerciseSet } from '../types';
import type { RecommendationData } from './useExerciseSets';

// Define more specific types for workout data
export interface CompletedWorkoutData {
  id?: string;
  date?: string;
  duration?: number | string; // Allow both number and string since the service might return either
  totalVolume?: number;
  totalReps?: number;
  exercises?: ExerciseData[];
  // Add any other properties that might be in the completed workout data
  [key: string]: unknown;
}

export interface PausedWorkoutData {
  exercises?: Array<ExerciseData | { isChangedExercise?: boolean | string }>;
  exerciseSets?: Record<string, ExerciseSet[]>;
  originalCycleWeek?: number | null;
  // Add any other properties that might be in the paused workout data
  [key: string]: unknown;
}

// Avoid type conflicts with the workoutPlanService return types
// by using more general types for external data

export interface UseWorkoutStateParams {
  user: UserProfile | null | undefined;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName?: string;
  forceStart?: boolean;
  forceResume?: boolean;
  onWorkoutStarted?: () => void;
  setWorkoutStartTime: (date: Date) => void;
  startWorkoutTimer: () => void;
  clearAllTimers: () => void;
  setWorkoutDuration: (duration: number) => void;
}

export interface UseWorkoutStateReturn {
  // Workout state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  exercises: ExerciseData[];
  setExercises: React.Dispatch<React.SetStateAction<ExerciseData[]>>;
  currentExerciseIndex: number;
  setCurrentExerciseIndex: React.Dispatch<React.SetStateAction<number>>;
  exerciseSets: Record<string, ExerciseSet[]>;
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;

  // Totals
  totalVolume: number;
  setTotalVolume: React.Dispatch<React.SetStateAction<number>>;
  totalReps: number;
  setTotalReps: React.Dispatch<React.SetStateAction<number>>;

  // Recommendations and data
  recommendations: Record<string, RecommendationData>;
  setRecommendations: React.Dispatch<React.SetStateAction<Record<string, RecommendationData>>>;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  setLastExerciseValues: React.Dispatch<
    React.SetStateAction<Record<string, Record<number, { weight: string; reps: string }>>>
  >;

  // User interaction state
  focusedInputs: Record<string, boolean>;
  setFocusedInputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  userEnteredValues: Record<string, boolean>;
  setUserEnteredValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  exerciseCustomized: Record<string, boolean>;
  setExerciseCustomized: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Modal states
  showWarmup: boolean;
  setShowWarmup: (show: boolean) => void;
  warmupCompleted: boolean;
  setWarmupCompleted: (completed: boolean) => void;
  showExitModal: boolean;
  setShowExitModal: (show: boolean) => void;
  showExerciseDetailsModal: boolean;
  setShowExerciseDetailsModal: (show: boolean) => void;
  showExerciseListModal: boolean;
  setShowExerciseListModal: (show: boolean) => void;
  showCustomizeExerciseModal: boolean;
  setShowCustomizeExerciseModal: (show: boolean) => void;

  // Keyboard and UI state
  keyboardHeight: number;
  setKeyboardHeight: (height: number) => void;
  activeInputPosition: number;
  setActiveInputPosition: (position: number) => void;
  textInputRefreshKey: number;
  setTextInputRefreshKey: React.Dispatch<React.SetStateAction<number>>;

  // Workout completion state
  isWorkoutCompleted: boolean;
  setIsWorkoutCompleted: (completed: boolean) => void;
  workoutState: 'in_progress' | 'completing' | 'completed';
  setWorkoutState: React.Dispatch<React.SetStateAction<'in_progress' | 'completing' | 'completed'>>;

  // Helper functions
  getCurrentExercise: () => ExerciseData | undefined;
  getCurrentSets: () => ExerciseSet[];
  resetWorkoutState: () => void;

  // Additional state
  completedWorkoutData: unknown;
  setCompletedWorkoutData: React.Dispatch<React.SetStateAction<unknown>>;
  originalCycleWeek: number | null;
  setOriginalCycleWeek: React.Dispatch<React.SetStateAction<number | null>>;
  isResumingPausedWorkout: boolean;
  setIsResumingPausedWorkout: React.Dispatch<React.SetStateAction<boolean>>;
  exerciseSetsLocked: boolean;
  setExerciseSetsLocked: React.Dispatch<React.SetStateAction<boolean>>;
  fetchWorkoutData: () => Promise<void>;
  checkWorkoutCompletionOnly: () => Promise<void>;
  resumePausedWorkout: (pausedWorkout: unknown) => Promise<void>;
  checkWorkoutCompletion: () => Promise<void>;
}

export const useWorkoutState = ({
  user,
  planId,
  workoutDay,
  cycleWeek,
  weekName: _weekName, // eslint-disable-line @typescript-eslint/no-unused-vars, no-unused-vars
  forceStart = false,
  forceResume = false,
  onWorkoutStarted,
  setWorkoutStartTime,
  startWorkoutTimer,
  clearAllTimers,
  setWorkoutDuration,
}: UseWorkoutStateParams): UseWorkoutStateReturn => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseSets, setExerciseSets] = useState<Record<string, ExerciseSet[]>>({});
  const [recommendations, setRecommendations] = useState<Record<string, RecommendationData>>({});
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<unknown>(null);
  const [originalCycleWeek, setOriginalCycleWeek] = useState<number | null>(null);
  const [isResumingPausedWorkout, setIsResumingPausedWorkout] = useState(false);
  const [exerciseSetsLocked, setExerciseSetsLocked] = useState(false);

  // Totals
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [totalReps, setTotalReps] = useState<number>(0);

  // Recommendations and data
  const [lastExerciseValues, setLastExerciseValues] = useState<
    Record<string, Record<number, { weight: string; reps: string }>>
  >({});

  // User interaction state
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({});
  const [userEnteredValues, setUserEnteredValues] = useState<Record<string, boolean>>({});
  const [exerciseCustomized, setExerciseCustomized] = useState<Record<string, boolean>>({});

  // Modal states
  // Initialize showWarmup based on whether we're resuming a workout
  const [showWarmup, setShowWarmup] = useState(!forceResume);
  const [warmupCompleted, setWarmupCompleted] = useState(forceResume);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showExerciseDetailsModal, setShowExerciseDetailsModal] = useState(false);
  const [showExerciseListModal, setShowExerciseListModal] = useState(false);
  const [showCustomizeExerciseModal, setShowCustomizeExerciseModal] = useState(false);

  // Keyboard and UI state
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeInputPosition, setActiveInputPosition] = useState(0);
  const [textInputRefreshKey, setTextInputRefreshKey] = useState(0);

  // Workout completion state
  const [workoutState, setWorkoutState] = useState<'in_progress' | 'completing' | 'completed'>(
    'in_progress',
  );

  // Helper functions
  const getCurrentExercise = useCallback(() => {
    return exercises[currentExerciseIndex];
  }, [exercises, currentExerciseIndex]);

  const getCurrentSets = useCallback(() => {
    const currentExercise = getCurrentExercise();
    return currentExercise ? exerciseSets[currentExercise.id] || [] : [];
  }, [getCurrentExercise, exerciseSets]);

  const resetWorkoutState = useCallback(() => {
    setCurrentExerciseIndex(0);
    setTotalVolume(0);
    setTotalReps(0);
    setUserEnteredValues({});
    setExerciseCustomized({});
    setIsWorkoutCompleted(false);
    setWorkoutState('in_progress');
    setTextInputRefreshKey((prev) => prev + 1);

    // Reset all sets to not completed and empty values
    setExerciseSets((prev) => {
      const resetSets = { ...prev };
      Object.keys(resetSets).forEach((exerciseId) => {
        resetSets[exerciseId] = resetSets[exerciseId].map((set) => ({
          ...set,
          isCompleted: false,
          weight: '',
          reps: '',
        }));
      });
      return resetSets;
    });
  }, []);

  // Function to fetch workout data
  const fetchWorkoutData = useCallback(async () => {
    if (!planId || Number.isNaN(workoutDay) || !user?.id) {
      console.error('Invalid workout parameters:', { planId, workoutDay, user: !!user });
      Alert.alert('Error', 'Invalid workout parameters');
      return;
    }

    // Don't fetch workout data if we're currently resuming a paused workout
    if (isResumingPausedWorkout) {
      console.log('FETCH: Skipping fetchWorkoutData because we are resuming a paused workout');
      return;
    }

    try {
      setIsLoading(true);
      console.log('FETCH: Starting fetchWorkoutData');

      // Check if this is a redo workout
      const isRedoWorkout = forceStart === true;

      // Use the service function to fetch workout data
      const {
        exercises: formattedExercises,
        exerciseSets: initialSets,
        recommendations: fetchedRecommendations,
      } = await workoutPlanService.fetchWorkoutData(
        planId,
        workoutDay,
        user.id,
        cycleWeek,
        isRedoWorkout,
      );

      // Set exercises state
      setExercises(formattedExercises);

      // Set exercise sets state
      setExerciseSets(initialSets);

      // Set recommendations state
      setRecommendations(fetchedRecommendations as Record<string, RecommendationData>);

      console.log('FETCH: fetchWorkoutData completed successfully');
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching workout data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        planId,
        workoutDay,
        cycleWeek,
        userId: user?.id,
      });
      setIsLoading(false);

      // Show alert and navigate back on error
      Alert.alert('Error', `Failed to load workout data: ${errorMessage}`, [
        {
          text: 'Go Back',
          onPress: () => router.back(),
          style: 'default',
        },
        {
          text: 'Retry',
          onPress: () => {
            setIsLoading(true);
            fetchWorkoutData();
          },
          style: 'default',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [planId, workoutDay, cycleWeek, user, forceStart, router, isResumingPausedWorkout]);

  // This function only checks if workout is completed without paused workout logic
  const checkWorkoutCompletionOnly = useCallback(async () => {
    if (!user?.id || !planId) return;

    // Don't check completion if we're currently resuming a paused workout
    if (isResumingPausedWorkout) {
      console.log(
        'CHECK: Skipping checkWorkoutCompletionOnly because we are resuming a paused workout',
      );
      return;
    }

    try {
      setIsLoading(true);
      console.log('CHECK: Starting checkWorkoutCompletionOnly');

      // Use the service function to check workout completion for specific cycle week
      const { isCompleted, completedWorkoutData: workoutData } =
        await workoutPlanService.checkWorkoutCompletionForCycleWeek(
          user.id,
          planId,
          workoutDay,
          cycleWeek, // Pass the cycle week to check for completion in the specific week
        );

      if (isCompleted && workoutData) {
        // Workout is already completed for this specific cycle week
        setIsWorkoutCompleted(true);
        setCompletedWorkoutData(workoutData);
        setIsLoading(false);
      } else {
        // Workout is not completed for this cycle week, fetch workout data
        setIsWorkoutCompleted(false);
        fetchWorkoutData();

        // Start workout timer
        setWorkoutStartTime(new Date());
        startWorkoutTimer();
        if (onWorkoutStarted) onWorkoutStarted();
      }
    } catch {
      // If there's an error, proceed with normal workout
      setIsLoading(false);
      setIsWorkoutCompleted(false);
      fetchWorkoutData();

      // Start workout timer
      setWorkoutStartTime(new Date());
      startWorkoutTimer();
      if (onWorkoutStarted) onWorkoutStarted();
    }
  }, [
    user,
    planId,
    workoutDay,
    cycleWeek,
    fetchWorkoutData,
    setWorkoutStartTime,
    startWorkoutTimer,
    onWorkoutStarted,
    isResumingPausedWorkout,
  ]);

  // Helper function to restore workout state from paused data
  const restoreWorkoutState = useCallback(
    (workout: {
      exercises?: Array<{ isChangedExercise?: boolean | string; [key: string]: unknown }>;
      exerciseSets?: Record<string, ExerciseSet[]>;
      originalCycleWeek?: number | null;
      currentExerciseIndex?: number;
      totalVolume?: number;
      totalReps?: number;
      workoutDuration?: number;
      exerciseCustomized?: Record<string, boolean>;
      userEnteredValues?: Record<string, boolean>;
      focusedInputs?: Record<string, boolean>;
    }) => {
      // Set flag to prevent effects from overwriting paused workout data
      setIsResumingPausedWorkout(true);
      setExerciseSetsLocked(true); // Lock exercise sets to prevent regeneration

      // Ensure all exercises have the correct isChangedExercise flag
      if (workout.exercises) {
        workout.exercises = workout.exercises.map((ex) => {
          if (ex.isChangedExercise === 'true' || ex.isChangedExercise === true) {
            return { ...ex, isChangedExercise: true };
          }
          return ex;
        });
      }

      // Log detailed information about what we're restoring
      console.log('RESUME: About to restore exercises:', JSON.stringify(workout.exercises));
      console.log('RESUME: About to restore exerciseSets:', JSON.stringify(workout.exerciseSets));

      // Log each exercise's sets count for debugging
      if (workout.exercises) {
        workout.exercises.forEach((ex) => {
          console.log(
            `RESUME: Exercise ${ex.name} (${ex.id}) has ${ex.sets} sets in exercise definition`,
          );
        });
      }

      // Log each exercise's actual sets data
      if (workout.exerciseSets) {
        Object.entries(workout.exerciseSets).forEach(([exerciseId, sets]) => {
          console.log(
            `RESUME: Exercise ${exerciseId} has ${sets.length} actual sets in saved data`,
          );
        });
      }

      // Set workout state using React's functional state updates to ensure atomicity
      // Use functional updates to ensure state is set correctly
      setExercises((prev) => {
        console.log(
          'RESUME: Setting exercises - prev length:',
          prev.length,
          'new length:',
          workout.exercises?.length || 0,
        );
        return workout.exercises as unknown as ExerciseData[];
      });

      setExerciseSets((prev) => {
        console.log(
          'RESUME: Setting exercise sets - prev keys:',
          Object.keys(prev),
          'new keys:',
          Object.keys(workout.exerciseSets || {}),
        );
        const newSets = workout.exerciseSets || {};

        // Log detailed comparison for debugging
        Object.entries(newSets).forEach(([exerciseId, sets]) => {
          console.log(`RESUME: Setting exercise ${exerciseId} to have ${sets.length} sets`);
          const prevSets = prev[exerciseId];
          if (prevSets) {
            console.log(
              `RESUME: Previous sets for ${exerciseId}: ${prevSets.length}, new sets: ${sets.length}`,
            );
          }
        });

        return newSets;
      });

      // SIMPLIFIED: No need to restore customization tracking
      // Exercises already contain their customized values
      console.log(
        'RESUME: Using simplified approach - exercises contain their customized sets/reps directly',
      );
    },
    [],
  );

  // Helper function to restore numeric values
  const restoreNumericValues = useCallback(
    (workout: {
      currentExerciseIndex?: number;
      totalVolume?: number;
      totalReps?: number;
      originalCycleWeek?: number | null;
      workoutDuration?: number;
    }) => {
      // Restore current exercise index
      if (workout.currentExerciseIndex !== undefined && workout.currentExerciseIndex !== null) {
        console.log('RESUME: Setting currentExerciseIndex to:', workout.currentExerciseIndex);
        setCurrentExerciseIndex(workout.currentExerciseIndex);
      } else {
        console.warn('RESUME: No currentExerciseIndex found, defaulting to 0');
        setCurrentExerciseIndex(0);
      }

      // Restore totals
      if (workout.totalVolume !== undefined && workout.totalVolume !== null) {
        setTotalVolume(workout.totalVolume);
        console.log('RESUME: Restored totalVolume to:', workout.totalVolume);
      }

      if (workout.totalReps !== undefined && workout.totalReps !== null) {
        setTotalReps(workout.totalReps);
        console.log('RESUME: Restored totalReps to:', workout.totalReps);
      }

      if (workout.originalCycleWeek !== null && workout.originalCycleWeek !== undefined) {
        setOriginalCycleWeek(workout.originalCycleWeek);
      }

      // Restore workout duration
      if (workout.workoutDuration !== undefined && workout.workoutDuration !== null) {
        setWorkoutDuration(workout.workoutDuration);
        console.log('RESUME: Restored workoutDuration to:', workout.workoutDuration);
      }
    },
    [setWorkoutDuration],
  );

  // Helper function to handle post-resume cleanup
  const handlePostResumeCleanup = useCallback(() => {
    setIsLoading(false);

    // Clear the paused workout since we're resuming it now
    workoutPlanService.clearPausedWorkout(user?.id || '', planId, workoutDay);

    // Verify state restoration and clear resuming flag
    setTimeout(() => {
      console.log('RESUME: Verifying state after restoration...');
      // Add verification logic here if needed
    }, 100);

    // Add verification to check if exercise sets match what was saved
    setTimeout(() => {
      console.log('RESUME: Final verification - checking exercise sets...');

      // Force a verification callback to check the current state
      const verifyRestoredState = () => {
        console.log('RESUME: Final state verification triggered');
        // This will be filled in with actual verification logic if needed
      };

      verifyRestoredState();
    }, 200);

    setTimeout(() => {
      setIsResumingPausedWorkout(false);
      setExerciseSetsLocked(false); // Unlock exercise sets after restoration is complete
      console.log(
        'RESUME: Cleared isResumingPausedWorkout flag and unlocked exercise sets - effects can now run normally',
      );
    }, 5000); // Extended from 3 to 5 seconds to ensure all restoration is complete
  }, [user, planId, workoutDay]);

  // Function to resume a paused workout
  const resumePausedWorkout = useCallback(
    async (pausedWorkout: unknown) => {
      if (!user?.id) {
        console.error('User not available for resuming paused workout.');
        Alert.alert('Error', 'User not available. Cannot resume workout.');
        return;
      }

      try {
        // Cast to a type we can work with internally
        const workout = pausedWorkout as {
          exercises?: Array<{ isChangedExercise?: boolean | string; [key: string]: unknown }>;
          exerciseSets?: Record<string, ExerciseSet[]>;
          originalCycleWeek?: number | null;
          currentExerciseIndex?: number;
          totalVolume?: number;
          totalReps?: number;
          workoutDuration?: number;
          exerciseCustomized?: Record<string, boolean>;
          userEnteredValues?: Record<string, boolean>;
          focusedInputs?: Record<string, boolean>;
        };

        console.log('Resuming paused workout:', JSON.stringify(workout.exercises));
        console.log(
          'Resuming paused workout - currentExerciseIndex:',
          workout.currentExerciseIndex,
        );
        console.log('Resuming paused workout - totalVolume:', workout.totalVolume);
        console.log('Resuming paused workout - totalReps:', workout.totalReps);

        console.log(
          'RESUME: Using simplified approach - exercises already contain customized values',
        );

        // Restore workout state using helper functions
        restoreWorkoutState(workout);
        restoreNumericValues(workout);

        // Skip warmup when resuming a paused workout
        setShowWarmup(false);
        setWarmupCompleted(true);

        // Start the workout timer (which will continue from the restored duration)
        setWorkoutStartTime(new Date());
        startWorkoutTimer();
        if (onWorkoutStarted) onWorkoutStarted();

        // Handle cleanup
        handlePostResumeCleanup();
      } catch (error) {
        console.error('Error resuming paused workout:', error);
        // If there's an error, proceed with normal workout
        setIsLoading(false);
        fetchWorkoutData();
        setWorkoutStartTime(new Date());
        startWorkoutTimer();
        if (onWorkoutStarted) onWorkoutStarted();
      }
    },
    [
      user,
      planId,
      workoutDay,
      setWorkoutStartTime,
      startWorkoutTimer,
      fetchWorkoutData,
      onWorkoutStarted,
      restoreWorkoutState,
      restoreNumericValues,
      handlePostResumeCleanup,
    ],
  );

  // Original function to check for workout completion and handle paused workouts
  const checkWorkoutCompletion = useCallback(async () => {
    if (!user?.id || !planId) {
      console.warn('User or Plan ID missing, cannot check workout completion.');
      return;
    }

    // Don't check completion if we're currently resuming a paused workout
    if (isResumingPausedWorkout) {
      console.log(
        'CHECK: Skipping checkWorkoutCompletion because we are resuming a paused workout',
      );
      return;
    }

    try {
      console.log('CHECK: Starting checkWorkoutCompletion');
      // First check if there's a paused workout to resume
      const pausedWorkout = await workoutPlanService.getPausedWorkout(user.id, planId, workoutDay);

      if (pausedWorkout) {
        // No longer show the alert dialog - directly resume the paused workout
        console.log('CHECK: Found paused workout, resuming...');
        // Skip warmup when resuming a paused workout
        setShowWarmup(false);
        setWarmupCompleted(true);
        resumePausedWorkout(pausedWorkout);
      } else {
        // No paused workout, continue with normal flow
        console.log('CHECK: No paused workout found, checking completion...');
        checkWorkoutCompletionOnly();
      }
    } catch {
      setIsLoading(false);
      // If there's an error, proceed with normal workout
      checkWorkoutCompletionOnly();
    }
  }, [
    user,
    planId,
    workoutDay,
    resumePausedWorkout,
    checkWorkoutCompletionOnly,
    isResumingPausedWorkout,
  ]);

  // Single effect to handle all workout initialization to prevent race conditions
  useEffect(() => {
    const initializeWorkout = async () => {
      if (forceStart) {
        // Force start means we want to start the workout even if it's already completed
        setIsWorkoutCompleted(false);
        fetchWorkoutData();

        // Start workout timer
        setWorkoutStartTime(new Date());
        startWorkoutTimer();
        if (onWorkoutStarted) onWorkoutStarted();
      } else if (forceResume) {
        // If forceResume is true, directly try to load and resume the paused workout
        try {
          setIsLoading(true);

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
            if (onWorkoutStarted) onWorkoutStarted();
          }
        } catch {
          // If there's an error, fetch workout data normally
          setIsResumingPausedWorkout(false); // Make sure flag is cleared
          fetchWorkoutData();
          setWorkoutStartTime(new Date());
          startWorkoutTimer();
          if (onWorkoutStarted) onWorkoutStarted();
        }
      } else {
        // Normal flow - check if workout is completed or paused
        checkWorkoutCompletion();
      }
    };

    initializeWorkout();

    // Cleanup
    return () => {
      clearAllTimers();
    };
  }, [planId, workoutDay, forceStart, forceResume]);

  return {
    // Core state
    isLoading,
    setIsLoading,
    exercises,
    setExercises,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    exerciseSets,
    setExerciseSets,

    // Totals
    totalVolume,
    setTotalVolume,
    totalReps,
    setTotalReps,

    // Recommendations and data
    recommendations,
    setRecommendations,
    lastExerciseValues,
    setLastExerciseValues,

    // User interaction state
    focusedInputs,
    setFocusedInputs,
    userEnteredValues,
    setUserEnteredValues,
    exerciseCustomized,
    setExerciseCustomized,

    // Modal states
    showWarmup,
    setShowWarmup,
    warmupCompleted,
    setWarmupCompleted,
    showExitModal,
    setShowExitModal,
    showExerciseDetailsModal,
    setShowExerciseDetailsModal,
    showExerciseListModal,
    setShowExerciseListModal,
    showCustomizeExerciseModal,
    setShowCustomizeExerciseModal,

    // Keyboard and UI state
    keyboardHeight,
    setKeyboardHeight,
    activeInputPosition,
    setActiveInputPosition,
    textInputRefreshKey,
    setTextInputRefreshKey,

    // Workout completion state
    isWorkoutCompleted,
    setIsWorkoutCompleted,
    workoutState,
    setWorkoutState,

    // Helper functions
    getCurrentExercise,
    getCurrentSets,
    resetWorkoutState,

    // Additional state
    completedWorkoutData,
    setCompletedWorkoutData,
    originalCycleWeek,
    setOriginalCycleWeek,
    isResumingPausedWorkout,
    setIsResumingPausedWorkout,
    exerciseSetsLocked,
    setExerciseSetsLocked,
    fetchWorkoutData,
    checkWorkoutCompletionOnly,
    resumePausedWorkout,
    checkWorkoutCompletion,
  };
};

export default useWorkoutState;
